import { useState } from 'react';
import { Button, CameraCaptureButton, detectDeviceType, DOC, DocumentCaptureActions, FilePagesPreview, forgetDocumentFile, Icon, IconButton, pdfFromImageFiles, pdfPageCountOfFile, PRINT_ICON, readFileAsDataUrl, rememberDocumentFile, scannedFileName, TRASH, uploadFileProblem, useConfirmedRemoval, useDocumentScan } from 'dxp-ui';
import { UPLOAD_RULES } from '../domain/documentUploadRules';
import { formatBytes } from '../../lib/format';

/** A signed paper copy that was uploaded: the metadata is kept with the journey, the content in the session's file store (by id). */
export interface PaperCafCopy {
  id: string;
  fileName: string;
  sizeBytes: number;
  /** A PDF's page count, when it could be read. */
  pageCount?: number;
}

/** One form to print and to take back signed. */
export interface PaperCafForm {
  key: 'primary' | 'secondary';
  title: string;
  /** Names the document for a scan and the controls. */
  documentType: string;
  /** The signed documents added so far (one or several), and where the list is kept. */
  copies: PaperCafCopy[];
  onCopies: (copies: PaperCafCopy[]) => void;
}

/**
 * Sign on paper: print the CAF for the customer's pen signature and take the signed copy back (a scan or an upload). One row per form - the Primary CAF always, and the
 * Supplementary CAF when a Secondary Contact is on the connection. The page counts as signed only once every form has its signed copy.
 */
/**
 * Under the pages being reviewed. A scan just taken is pending: Accept keeps it, Rescan replaces it (only it). Once every page shown is accepted: Add Another Page scans one more
 * into the same document, and Done saves all the accepted pages as ONE document.
 */
function ReviewActions({ documentType, pending, onAccept, onAddPage, onRescan, onDone }: { documentType: string; pending: boolean; onAccept: () => void; onAddPage: (file: File) => void; onRescan: (file: File) => void; onDone: () => void }) {
  const { scanning, error, scan } = useDocumentScan(documentType);
  const tablet = detectDeviceType() === 'tablet';
  // The second action: take a page again (pending) or take another one (accepted) - the camera on a tablet, the scanner otherwise.
  const again = (label: string, onPage: (file: File) => void) =>
    tablet ? (
      <CameraCaptureButton documentType={documentType} label={label} onCapture={onPage} />
    ) : (
      <Button variant="secondary" size="sm" disabled={scanning} onClick={() => void scan(onPage)}>
        {scanning ? 'Scanning…' : label}
      </Button>
    );
  return (
    <div className="stack gap-2 items-center">
      <div className="row gap-2 flex-wrap justify-center">
        {pending ? (
          <>
            <Button size="sm" onClick={onAccept}>
              Accept
            </Button>
            {again('Rescan', onRescan)}
          </>
        ) : (
          <>
            <Button size="sm" onClick={onDone}>
              Done
            </Button>
            {again('Add Another Page', onAddPage)}
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-danger text-[length:var(--fs-caption)]">
          {error}
        </p>
      )}
    </div>
  );
}

export function CafPaperPanel({ forms, onPrintFullTerms }: { forms: PaperCafForm[]; onPrintFullTerms?: () => void }) {
  const { confirmRemoval, dialog } = useConfirmedRemoval();
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const setError = (key: string, message: string | undefined) => setErrors((e) => ({ ...e, [key]: message }));
  // A scan (or camera photo) waits here, shown with Accept and Rescan; only Accept adds it. An uploaded file needs no review and is added at once.
  const [review, setReview] = useState<Record<string, File[] | undefined>>({});
  const setPages = (key: string, pages: File[] | undefined) => setReview((r) => ({ ...r, [key]: pages && pages.length > 0 ? pages : undefined }));
  // Changes the pages as they are NOW (not as the render that made the click handler saw them): a scan finishes a moment after the button was pressed.
  const updatePages = (key: string, change: (pages: File[]) => File[]) =>
    setReview((r) => {
      const next = change(r[key] ?? []);
      return { ...r, [key]: next.length > 0 ? next : undefined };
    });
  // How many of the pages shown are accepted (the rest - at most the one just scanned - are pending Accept / Rescan).
  const [accepted, setAccepted] = useState<Record<string, number>>({});
  const acceptedOf = (key: string) => accepted[key] ?? 0;
  const pagesOf = (key: string) => review[key] ?? [];
  const checked = (key: string, files: File[]): boolean => {
    const problem = files.map((f) => uploadFileProblem(f, UPLOAD_RULES.supporting)).find(Boolean);
    setError(key, problem ?? undefined);
    return !problem;
  };
  // Accept: one page is the document as it is; several pages (scanned, or chosen together) become ONE PDF.
  const acceptPages = async (form: PaperCafForm) => {
    const pages = pagesOf(form.key);
    if (pages.length === 0) return;
    try {
      const file = pages.length === 1 ? pages[0] : await pdfFromImageFiles(pages, scannedFileName(new Date(), form.documentType, 'pdf'));
      setPages(form.key, undefined);
      setAccepted((a) => ({ ...a, [form.key]: 0 }));
      await take(form, file);
    } catch (e) {
      setError(form.key, e instanceof Error ? e.message : 'The pages could not be combined into one document.');
    }
  };

  // Documents added to the ones already held, in ONE update (several PDFs chosen together must not overwrite each other).
  const takeFiles = async (form: PaperCafForm, files: File[]) => {
    const problem = files.map((file) => uploadFileProblem(file, UPLOAD_RULES.supporting)).find(Boolean);
    if (problem) return setError(form.key, problem);
    setError(form.key, undefined);
    const added: PaperCafCopy[] = [];
    for (const file of files) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        // oxlint-disable-next-line react/purity -- runs in the upload handler, not during render
        const id = `caf-paper-${form.key}-${Date.now()}-${added.length}`;
        rememberDocumentFile(id, dataUrl, file.type);
        added.push({ id, fileName: file.name, sizeBytes: file.size, pageCount: await pdfPageCountOfFile(file) });
      } catch {
        setError(form.key, `${file.name} could not be read.`);
      }
    }
    // Another document is added to the ones already held.
    if (added.length > 0) form.onCopies([...form.copies, ...added]);
  };
  const take = (form: PaperCafForm, file: File) => takeFiles(form, [file]);

  return (
    <div className="stack gap-3">
      {dialog}
      {/* First: the complete Terms & Conditions, one consolidated document (both contacts, the terms, a signature line for each), to hand to the customer. */}
      {onPrintFullTerms && (
        <div>
          <Button size="sm" onClick={onPrintFullTerms}>
            <Icon path={PRINT_ICON} className="size-4" />
            Print Full T&amp;C
          </Button>
        </div>
      )}
      {/* The signed documents, each in a container of its own (General Terms & Conditions; Supplementary Terms & Conditions with a Secondary Contact), side by side as two independent stacks. Every one is mandatory. */}
      <div className="doc-columns">
        {[0, 1].map((column) => (
          <div key={column} className="doc-column">
            {forms.map((f, index) => ({ f, index })).filter(({ index }) => index % 2 === column).map(({ f, index }) => (
          <div key={f.key} style={{ order: index }} className="upload-section row items-start p-4">
            <span className="detail-icon-tile icon-tile">
              <Icon path={DOC} className="size-[var(--size-detail-icon)]" />
            </span>
            <span className="stack gap-3 min-w-0 flex-1">
            <span className="min-w-0">
              <span className="block title title-sm font-semibold">
                {f.title}
                <span className="text-[var(--field-border-error)]" aria-hidden="true">{' *'}</span>
              </span>
              <span className="block caption-muted">{UPLOAD_RULES.supporting.formatsLabel}, up to {UPLOAD_RULES.supporting.maxLabel}</span>
            </span>
            <span className="cluster">
              <DocumentCaptureActions
                what={`signed ${f.title}`}
                documentType={f.documentType}
                hideCapture={pagesOf(f.key).length > 0}
                uploadOnWeb
                onFile={(file) => {
                  // A new scan starts a new document: it waits for Accept.
                  if (checked(f.key, [file])) {
                    setPages(f.key, [file]);
                    setAccepted((a) => ({ ...a, [f.key]: 0 }));
                  }
                }}
                multiple
                onUploadMany={(files) => {
                  // Several files chosen together: each PDF is a signed document of its own and is added at once; JPG images are the pages of one document, shown to Accept.
                  if (!checked(f.key, files)) return;
                  const pdfs = files.filter((x) => /\.pdf$/i.test(x.name));
                  const images = files.filter((x) => /\.jpe?g$/i.test(x.name));
                  if (pdfs.length + images.length < files.length) return setError(f.key, 'Choose PDF documents or JPG images.');
                  if (pdfs.length > 0) void takeFiles(f, pdfs);
                  // Images the agent chose are already accepted: Done saves them, Add Another Page adds a scan.
                  if (images.length > 0) {
                    setPages(f.key, images);
                    setAccepted((a) => ({ ...a, [f.key]: images.length }));
                  }
                }}
                onUpload={(file) => {
                  setPages(f.key, undefined);
                  void take(f, file);
                }}
              />
            </span>
            {/* The scan as taken, with Accept (adds it) and Rescan (the scan button above, now reading Rescan). */}
            {pagesOf(f.key).length > 0 && (
              <div className="stack gap-3 items-center" aria-label={`Scanned ${f.title}`}>
                <FilePagesPreview
                  files={pagesOf(f.key)}
                  onDelete={(i) => {
                    updatePages(f.key, (pages) => pages.filter((_, k) => k !== i));
                    if (i < acceptedOf(f.key)) setAccepted((a) => ({ ...a, [f.key]: acceptedOf(f.key) - 1 }));
                  }}
                />
                <ReviewActions
                  documentType={f.documentType}
                  pending={pagesOf(f.key).length > acceptedOf(f.key)}
                  onAccept={() => setAccepted((x) => ({ ...x, [f.key]: pagesOf(f.key).length }))}
                  onDone={() => void acceptPages(f)}
                  onAddPage={(file) => {
                    // Added as the pending page of the same document; Accept keeps it, Rescan replaces it.
                    if (checked(f.key, [file])) updatePages(f.key, (pages) => [...pages, file]);
                  }}
                  onRescan={(file) => {
                    // Rescan replaces ONLY the page scanned last; every earlier page stays.
                    if (checked(f.key, [file])) updatePages(f.key, (pages) => [...pages.slice(0, -1), file]);
                  }}
                />
              </div>
            )}
            {/* After Accept only the document is added: its name and size, with Remove. */}
            {pagesOf(f.key).length === 0 && f.copies.length > 0 && (
              <ul className="stack gap-1 data-rows-ruled" aria-label={`Signed ${f.title}`}>
                {f.copies.map((c) => (
                <li key={c.id} className="split-nowrap data-row">
                  <Icon path={DOC} className="icon-sm text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="line-body">{c.fileName}</span>
                    <span className="block caption-muted">{formatBytes(c.sizeBytes)}{c.pageCount ? ` · ${c.pageCount} ${c.pageCount === 1 ? 'page' : 'pages'}` : ''}</span>
                  </span>
                  <IconButton
                    tone="danger"
                    icon={TRASH}
                    label={`Remove ${c.fileName}`}
                    onClick={() =>
                      confirmRemoval(c.fileName, () => {
                        forgetDocumentFile(c.id);
                        f.onCopies(f.copies.filter((x) => x.id !== c.id));
                      })
                    }
                  />
                </li>
                ))}
              </ul>
            )}
            {errors[f.key] && (
              <p role="alert" className="text-danger text-[length:var(--fs-caption)]">
                {errors[f.key]}
              </p>
            )}
            </span>
          </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
