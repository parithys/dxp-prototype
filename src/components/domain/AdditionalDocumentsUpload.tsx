import { Button, Card, CHEVRON_DOWN, detectDeviceType, DOC, DocumentCaptureActions, DocumentFileMeta, documentFileOf, Drawer, FileImagePreview, FilePagesPreview, forgetDocumentFile, Icon, IconButton, Input, pdfFromImageFiles, pdfPageCountOfFile, readFileAsDataUrl, rememberDocumentFile, RemoveDocumentDialog, scannedFileName, Select, SORT_ASC_ICON, TRASH, uploadFileProblem, useDocumentScan } from 'dxp-ui';
import { scannerTypeFor } from '../../engines/documentScanner';
import { fileSizeLabel, pagesLabel } from '../../lib/format';
import { useEffect, useRef, useState } from 'react';
import { ScannedIdPreview } from './ScannedIdPreview';
import { UPLOAD_RULES } from './documentUploadRules';
import type { DocumentRequirement, JourneyDocument } from '../../engines/journeyDocuments';
import { mandatoryDocumentLabels } from '../../engines/journeyDocuments';

const escapeXml = (t: string) => t.replace(/[<>&"']/g, '');
/** Stand-in for a scan whose image was not kept: says what it is and that it is a specimen. */
const scanSpecimen = (label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" rx="16" fill="whitesmoke" stroke="gray" stroke-width="2"/><text x="320" y="190" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="dimgray">${escapeXml(label)}</text><text x="320" y="230" text-anchor="middle" font-family="sans-serif" font-size="18" fill="gray">Specimen - the scanner kept no image of this capture</text></svg>`,
  )}`;
/** "QID Document (Front)" -> "QID Document"; the side is shown on the tile. */
/** Whether this section may remove the document: only one attached in this section. */
const removableHere = (d: AdditionalDocument) => d.origin === 'additional-documents';
const kindOf = (label: string) => label.replace(/\s*\((Front|Back|Both Sides)\)$/, '');
const sideOf = (label: string) => /\((Front|Back|Both Sides)\)$/.exec(label)?.[1] ?? label;

export interface AdditionalDocument {
  /** Local id - a session artefact, not a persisted record, same as CafDocument. */
  id: string;
  /** Agent-typed, not from a fixed vocabulary (2026-09-28 request) - e.g.
   * "Employer Letter", "Utility Bill". Unlike CafDocumentUpload's signed-
   * paperwork types, this app has no fixed taxonomy for post-signature
   * supporting documents, so the agent names each one as it is added. */
  label: string;
  fileName: string;
  sizeBytes: number;
  /** The document's page count, when it is a PDF whose pages could be counted (an image has none). */
  pageCount?: number;
  /** The requirement this document satisfies (see engines/journeyDocuments.ts), when it was uploaded for one. */
  requirementId?: string;
  /**
   * Set by this uploader on a document attached in its own section. Only such a document can be removed here: one collected earlier in the journey (the Star Number Discount
   * Approval, the VAT certificate, an exception's evidence) carries no origin, is listed to be opened, and belongs to the step that collected it.
   */
  origin?: 'additional-documents';
}

interface AdditionalDocumentsUploadProps {
  documents: AdditionalDocument[];
  onChange: (documents: AdditionalDocument[]) => void;
  /** When given, the label is picked from this list of values instead of typed. */
  labelOptions?: string[];
  /**
   * With `labelOptions`: no Document Type dropdown. Each type gets its own row with its own Upload Document / Initiate Scan, so the documents are uploaded one at a time and
   * an uploaded type keeps its container, showing the file. An uploaded file is attached to its row's type at once; a scan (or camera capture) is shown in its container first, to Accept or Retake.
   */
  separateUploads?: boolean;
  /** With `separateUploads`: the types that must be uploaded: marked * and listed first; the others carry no marker. */
  mandatoryLabels?: string[];
  /** Overrides the default 10-document cap. */
  maxDocuments?: number;
  /** No card around it and no heading: the uploader sits directly on the page, under the heading of whatever section holds it. */
  bare?: boolean;
  /** Asks "Remove this document?" before a document is removed (the one uploaded here, or one chosen and not yet uploaded). */
  confirmRemove?: boolean;
  /**
   * A scan (or a camera capture) is shown at once with Accept and Rescan, and Accept attaches it under the chosen Document Type: there is no separate Upload Document step.
   * (A scan is one image here: the flatbed's Add Page is not used.)
   */
  reviewScan?: boolean;
  /** Called with true while a document type is chosen but its document has not been uploaded yet. */
  onPendingChange?: (pending: boolean) => void;
  /** The documents this order requires, for its scenario and the role working it: each is asked for here, once. */
  requirements?: DocumentRequirement[];
  /** Called with how many required documents are still missing; the caller holds Continue until it is 0. */
  onMissingRequiredChange?: (missing: number) => void;
  /** Every document the journey already holds (ID scans, evidence, the signed CAF): listed here to be viewed and downloaded. */
  journeyDocuments?: JourneyDocument[];
}

const MAX_DOCUMENTS = 10;
const RULES = UPLOAD_RULES.supporting;


/** A data URL as an object URL: browsers will not open a data: URL as a page, but they open a blob. */
function blobUrlOf(dataUrl: string): string | undefined {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return undefined;
  const bytes = m[2] ? Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[3]));
  return URL.createObjectURL(new Blob([bytes], { type: m[1] || 'application/octet-stream' }));
}

// Additional Documents: the end of the journey, after the CAF is signed. It holds (1) what this order requires the agent to attach, decided by
// its scenario and the role - asked for here and nowhere earlier; (2) every document the journey holds, consolidated, each one viewable; and (3) anything else the agent wants to attach, labelled by type. No signature is needed for any of it.
export function AdditionalDocumentsUpload({
  documents,
  onChange,
  labelOptions,
  separateUploads = false,
  mandatoryLabels: requiredTypes,
  maxDocuments = MAX_DOCUMENTS,
  bare = false,
  confirmRemove = true,
  reviewScan = true,
  onPendingChange,
  requirements = [],
  onMissingRequiredChange,
  journeyDocuments = [],
}: AdditionalDocumentsUploadProps) {
  const [label, setLabel] = useState('');
  // The file chosen or dropped but not uploaded yet.
  const [staged, setStaged] = useState<File | null>(null);
  // A flatbed scan: the pages scanned so far, to be combined into one PDF when the document is uploaded.
  const [pages, setPages] = useState<File[]>([]);
  // The document opened from Journey Documents, shown in the side drawer.
  const documentsRef = useRef(documents);
  useEffect(() => {
    documentsRef.current = documents;
  });
  const onPendingChangeRef = useRef(onPendingChange);
  const onMissingRequiredChangeRef = useRef(onMissingRequiredChange);
  useEffect(() => {
    onPendingChangeRef.current = onPendingChange;
    onMissingRequiredChangeRef.current = onMissingRequiredChange;
  });
  const [journeyOpen, setJourneyOpen] = useState(false);
  // 0-100 while a document is being uploaded; undefined when none is.
  const [progress, setProgress] = useState<number | undefined>();
  // The document open in the viewer drawer: ALL of its images (front and back, every page), shown one under another on a single page.
  const [viewing, setViewing] = useState<{ title: string; pages: { label?: string; dataUrl?: string; scan?: JourneyDocument['scan'] }[] } | undefined>();
  // A type picked with no file yet is an unfinished upload: the caller blocks Continue until it is uploaded.
  useEffect(() => {
    onPendingChangeRef.current?.(Boolean(label.trim() || staged));
  }, [label, staged]);
  useEffect(() => () => onPendingChangeRef.current?.(false), []);
  const [error, setError] = useState<string | null>(null);
  const atLimit = documents.length >= maxDocuments;
  // A configured list with nothing left to offer for this role, journey and customer: there is nothing to upload as, so the panel is not shown.
  // With separate uploads the mandatory types come first (the others keep their order).
  const orderedOptions = labelOptions && requiredTypes ? [...labelOptions].sort((x, y) => Number(requiredTypes.includes(y)) - Number(requiredTypes.includes(x))) : labelOptions ?? [];
  const noTypesToOffer = labelOptions !== undefined && labelOptions.every((o) => documents.some((d) => d.label === o));

  // The mandatory documents uploaded here are shown under Uploaded Documents only, until Continue saves them to the journey.
  const mandatoryLabels = mandatoryDocumentLabels();
  const pendingHere = documents.filter((d) => mandatoryLabels.includes(d.label));
  const uploadedFor = (requirementId: string) => documents.find((d) => d.requirementId === requirementId);
  const missing = requirements.filter((r) => !uploadedFor(r.id));
  useEffect(() => {
    onMissingRequiredChangeRef.current?.(missing.length);
  }, [missing.length]);
  useEffect(() => () => onMissingRequiredChangeRef.current?.(0), []);

  const add = async (file: File, doc: { label: string; requirementId?: string }) => {
    const problem = uploadFileProblem(file, RULES);
    if (problem) {
      setError(problem);
      return false;
    }
    setError(null);
    const pageCount = await pdfPageCountOfFile(file);
    // oxlint-disable-next-line react/purity -- runs in the upload handler, not during render
    const id = `${Date.now()}-${file.name}`;
    // The content is kept in memory for viewing and download; only the name, size and label go with the draft.
    try {
      rememberDocumentFile(id, await readFileAsDataUrl(file), file.type);
    } catch {
      /* the document is still attached; it just cannot be opened */
    }
    // Appended to what is held NOW, not to the list this render saw: the file is read asynchronously, and a stale list would drop a document added meanwhile.
    onChange([...documentsRef.current, { id, label: doc.label, fileName: file.name, sizeBytes: file.size, pageCount, requirementId: doc.requirementId, origin: 'additional-documents' }]);
    return true;
  };

  // Choosing or dropping a file only stages it; "Upload documents" attaches it under the chosen type.
  const stageFile = (file: File | undefined) => {
    if (!file) return;
    if (reviewScan) {
      setReviewing(file);
      return;
    }
    const problem = uploadFileProblem(file, RULES);
    if (problem) {
      setStaged(null);
      setError(problem);
      return;
    }
    setError(null);
    setStaged(file);
  };

  // Which scanner takes this document: decided by the device and the chosen type. A flatbed scan takes several pages (Add Page), kept as pages until Upload Document.
  const flatbed = label.trim() !== '' && scannerTypeFor(label, detectDeviceType()) === 'flatbed';
  const pageScan = useDocumentScan(label);
  // Scans taken for this document so far (a deleted page does not give its number back), so each scan image carries its own number.
  const scansTaken = useRef(0);
  const firstPage = (file: File | undefined) => {
    if (!file) return;
    if (reviewScan) {
      setReviewing(file);
      return;
    }
    // A new Initiate Scan starts a new document.
    scansTaken.current = 1;
    setStaged(null);
    setPages([file]);
    setError(null);
  };
  const hasFile = Boolean(staged) || pages.length > 0;
  // An UPLOADED file needs no review: it is attached at once under the chosen type (only a scan waits for Accept / Rescan).
  const attachUpload = async (file: File | undefined) => {
    if (!file || !label.trim()) return;
    const problem = uploadFileProblem(file, RULES);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (await add(file, { label: label.trim() })) {
      setReviewing(undefined);
      setLabel('');
    }
  };
  // reviewScan: the scan taken, waiting for the agent's Accept (which attaches it) or Rescan.
  const [reviewing, setReviewing] = useState<File | undefined>();
  const acceptReview = async () => {
    if (!reviewing || !label.trim()) return;
    if (await add(reviewing, { label: label.trim() })) {
      setReviewing(undefined);
      setLabel('');
    }
  };

  const uploadStaged = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError(labelOptions ? 'Select a document type before uploading.' : 'Enter a label for this document before uploading.');
      return;
    }
    if (!hasFile) {
      setError('Choose a file to upload.');
      return;
    }
    // The bar climbs while the file is read and attached (never past 90 until it is done), then fills and clears. A larger file takes visibly longer.
    setProgress(0);
    // A flatbed scan goes up as ONE PDF of all its pages, named for the document type.
    let file = staged;
    if (pages.length > 0) {
      try {
        file = await pdfFromImageFiles(pages, scannedFileName(new Date(), trimmed, 'pdf'));
      } catch (e) {
        setProgress(undefined);
        setError(e instanceof Error ? e.message : 'The pages could not be combined into one document.');
        return;
      }
    }
    if (!file) {
      setProgress(undefined);
      return;
    }
    const step = Math.max(2, Math.round(60000 / Math.max(file.size, 60000) * 6));
    const timer = window.setInterval(() => setProgress((p) => (p === undefined ? p : Math.min(90, p + step))), 80);
    const ok = await add(file, { label: trimmed });
    window.clearInterval(timer);
    if (!ok) {
      setProgress(undefined);
      return;
    }
    setProgress(100);
    await new Promise((r) => window.setTimeout(r, 350));
    setProgress(undefined);
    setLabel('');
    setStaged(null);
    setPages([]);
  };

  // The removal waiting for the agent's answer, when `confirmRemove` is on.
  const [removing, setRemoving] = useState<{ name: string; run: () => void } | undefined>();
  const askRemove = (name: string, run: () => void) => (confirmRemove ? setRemoving({ name, run }) : run());
  const remove = (id: string) => {
    forgetDocumentFile(id);
    onChange(documentsRef.current.filter((d) => d.id !== id));
  };

  // Everything the journey holds, then what was uploaded here.
  // With separate uploads each document is shown in its own container, so the list below holds only the others.
  const listed = separateUploads && labelOptions ? documents.filter((d) => !labelOptions.includes(d.label)) : documents;
  const rows: (JourneyDocument & { removable?: boolean; sizeBytes?: number })[] = [
    ...journeyDocuments,
    ...documents.map((d) => ({ id: `upload-${d.id}`, label: d.label, source: d.requirementId ? 'Additional Documents · Required' : 'Additional Documents · Uploaded', fileName: d.fileName, fileId: d.id, removable: true, sizeBytes: d.sizeBytes })),
  ];

  // One section per kind of document within the page that produced it: "Customer Verification: QID Document".
  const sections = (() => {
    const out: { key: string; name: string; kind: string; title: string; how: string; items: typeof rows }[] = [];
    // Journey documents only: what the journey scanned or signed. They can be opened, never removed; what was uploaded here is listed apart, with Remove.
    for (const d of rows.filter((r) => !r.removable)) {
      const name = d.source.split(' · ')[0];
      const kind = kindOf(d.label);
      let g = out.find((x) => x.name === name && x.kind === kind);
      if (!g) out.push((g = { key: `${name}|${kind}`, name, kind, title: `${name}: ${kind}`, how: '', items: [] }));
      g.items.push(d);
    }
    // How the section was captured, from its documents: all scanned, all uploaded, or a mix.
    for (const g of out) {
      const hows = new Set(g.items.map((d) => d.source.split(' · ')[1]).filter(Boolean));
      g.how = hows.size === 1 ? [...hows][0].toLowerCase() : 'scanned or uploaded';
    }
    return out;
  })();

  // What a document shows in the viewer: the file held for it, else - for a capture the reader kept no image of (the demo scanner) - a labelled
  // specimen drawn again from what the reader showed (`scan`), never someone's real document.
  const imageOf = (d: (typeof rows)[number]): { dataUrl?: string; scan?: JourneyDocument['scan'] } => {
    const held = d.dataUrl ?? (d.fileId ? documentFileOf(d.fileId)?.dataUrl : undefined);
    const dataUrl = held ?? (d.source.endsWith('Scanned') && !d.scan ? scanSpecimen(d.label) : undefined);
    return { dataUrl, scan: dataUrl ? undefined : d.scan };
  };

  const body = (
    <>
      <RemoveDocumentDialog
        fileName={removing?.name}
        onCancel={() => setRemoving(undefined)}
        onConfirm={() => {
          removing?.run();
          setRemoving(undefined);
        }}
      />
      {!bare && (
        <div>
          <h4 className="title title-sm">Additional Documents</h4>
        </div>
      )}

      {missing.length > 0 && (
        <section aria-label="Required documents" className="space-y-3">
          <p role="status" className="sr-only">
            {missing.length === 1 ? '1 required document is still to be uploaded.' : `${missing.length} required documents are still to be uploaded.`}
          </p>
          {missing.map((r) => (
            <div key={r.id} className="upload-section row px-3 py-3">
              <Icon path={DOC} className="icon-sm text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block title title-sm font-semibold">{r.label}</span>
                <span className="block caption-muted">{r.reason}</span>
              </span>
              {/* Captured the way the device does it (scan on the web, camera on a tablet) or uploaded, straight under this requirement. */}
              <span className="cluster">
                <DocumentCaptureActions what={r.label.toLowerCase()} documentType={r.label} uploadOnWeb onFile={(f) => void add(f, { label: r.label, requirementId: r.id })} />
              </span>
            </div>
          ))}
        </section>
      )}

      <div className="@container">
        <div className="fields items-start">
        {noTypesToOffer && !separateUploads ? null : separateUploads && labelOptions ? (
          <section aria-label="Upload documents" className="doc-columns">
            {/* Two independent stacks (the 1st, 3rd ... and the 2nd, 4th ...): a container that grows - a scan preview - moves only the ones under it in its own stack, never the one beside it. */}
            {[0, 1].map((column) => (
              <div key={column} className="doc-column">
                {orderedOptions.map((o, index) => ({ o, index })).filter(({ index }) => index % 2 === column).map(({ o, index }) => {
              // Once uploaded, the document is shown in its own container (opened, or removed, from there); the container stays.
              const held = documents.find((d) => d.label === o);
              const heldUrl = held ? documentFileOf(held.id)?.dataUrl : undefined;
              // A scan just taken for this type, waiting for Accept (attaches it) or Retake.
              const previewing = reviewScan && reviewing !== undefined && label === o;
              return (
                <div key={o} style={{ order: index }} className="upload-section row items-start p-4">
                  <span className="detail-icon-tile icon-tile">
                    <Icon path={DOC} className="size-[var(--size-detail-icon)]" />
                  </span>
                  {/* The icon on the left; the name, the format line and the buttons share one left edge beside it. */}
                  <span className="stack gap-3 min-w-0 flex-1">
                    <span className="min-w-0">
                      <span className="block title title-sm font-semibold">
                        {o}
                        {requiredTypes &&
                          (requiredTypes.includes(o) ? <span className="text-[var(--field-border-error)]" aria-hidden="true">{' *'}</span> : null)}
                      </span>
                      {!held && <span className="block caption-muted">{RULES.formatsLabel}, up to {RULES.maxLabel}</span>}
                    </span>
                    {held ? (
                      <span className="split-nowrap data-row">
                        <span className="value-text truncate">
                          {heldUrl ? (
                            <Button variant="link" type="button" className="underline text-left" onClick={() => setViewing({ title: `${held.label} - ${held.fileName}`, pages: [{ dataUrl: heldUrl }] })}>
                              {held.fileName}
                            </Button>
                          ) : (
                            <span className="text-fg-2">{held.fileName}</span>
                          )}
                          <span className="block caption-muted">{fileSizeLabel(held.sizeBytes, held.pageCount)}</span>
                        </span>
                        <IconButton icon={TRASH} tone="danger" label={`Remove ${held.fileName}`} onClick={() => askRemove(held.fileName, () => remove(held.id))} />
                      </span>
                    ) : previewing && reviewing ? (
                      <span className="stack gap-3" aria-label="Scanned document preview">
                        <FileImagePreview file={reviewing} />
                        <span className="line-fg-caption"><DocumentFileMeta file={reviewing} /></span>
                        <span className="cluster">
                          <Button size="sm" onClick={() => void acceptReview()}>
                            Accept
                          </Button>
                          <Button variant="secondary" size="sm" disabled={pageScan.scanning} onClick={() => (detectDeviceType() === 'tablet' ? setReviewing(undefined) : void pageScan.scan(setReviewing))}>
                            Retake
                          </Button>
                        </span>
                        {pageScan.error && (
                          <span role="alert" className="text-danger text-[length:var(--fs-caption)]">
                            {pageScan.error}
                          </span>
                        )}
                      </span>
                    ) : (
                      !atLimit && (
                        <span className="cluster">
                          <DocumentCaptureActions
                            what={o.toLowerCase()}
                            documentType={o}
                            uploadOnWeb
                            // A scan or camera capture is reviewed first (Accept / Retake); an uploaded file is attached at once.
                            onFile={(f) => {
                              if (!reviewScan) return void add(f, { label: o });
                              setLabel(o);
                              setReviewing(f);
                            }}
                            onUpload={(f) => void add(f, { label: o })}
                          />
                        </span>
                      )
                    )}
                  </span>
                </div>
              );
            })}
              </div>
            ))}
          </section>
        ) : !atLimit ? (
          <section aria-label="Upload new documents" className="space-y-4">
              {/* The Document Type (or label) in full width, the capture buttons (Upload Document, Initiate Scan) below it, then the helper, or the chosen file. */}
              <div className="stack">
                <div className="min-w-0">
                  {labelOptions ? (
                    <Select
                      label="Document Type" required
                      // A type already uploaded is not offered again.
                      options={[
                        { value: '', label: 'Choose Document Type' },
                        ...labelOptions.filter((o) => !documents.some((d) => d.label === o)).map((o) => ({ value: o, label: o })),
                      ]}
                      value={label}
                      onChange={(e) => {
                        setLabel(e.target.value);
                        setError(null);
                        // The type comes first: a scan or file taken under another type is not carried over, so nothing is shown until the agent initiates a scan for THIS type.
                        setStaged(null);
                        setPages([]);
                        setReviewing(undefined);
                      }}
                    />
                  ) : (
                    <Input
                      label="Document Label"
                      placeholder="e.g. Employer Letter"
                      value={label}
                      onChange={(e) => {
                        setLabel(e.target.value);
                        setError(null);
                      }}
                    />
                  )}
                </div>
                <span className="cluster">
                  <DocumentCaptureActions
                    what="document to upload"
                    documentType={label}
                    hasDocument={hasFile}
                    disabled={!label.trim()}
                    disabledTitle={labelOptions ? 'Choose a Document Type first' : 'Enter a Document Label first'}
                    uploadOnWeb
                    onFile={flatbed ? firstPage : stageFile}
                    onUpload={reviewScan ? (f) => void attachUpload(f) : stageFile}
                  />
                </span>
              </div>
              {reviewScan && reviewing && (
                <Card className="p-4 space-y-3" aria-label="Scanned document preview">
                  <FileImagePreview file={reviewing} />
                  <p className="line-fg-caption text-center">{reviewing.name} <DocumentFileMeta file={reviewing} /></p>
                  <div className="cluster justify-center gap-3">
                    <Button size="sm" onClick={() => void acceptReview()} disabled={!label.trim()}>
                      Accept
                    </Button>
                    {detectDeviceType() !== 'tablet' && (
                      <Button variant="secondary" size="sm" disabled={pageScan.scanning} onClick={() => void pageScan.scan(setReviewing)}>
                        Rescan
                      </Button>
                    )}
                  </div>
                </Card>
              )}
              {reviewScan && !reviewing && <span className="caption-muted">{RULES.formatsLabel}, up to {RULES.maxLabel}</span>}
              {reviewScan && pageScan.error && (
                <p role="alert" className="text-danger text-[length:var(--fs-caption)]">
                  {pageScan.error}
                </p>
              )}
              {!reviewScan && (
                <>
              <div className="cluster">
                {pages.length > 0 ? (
                  <span className="line-fg-caption">
                    Scanned document <span className="text-muted">({pages.length} {pages.length === 1 ? 'page' : 'pages'}, uploaded as one PDF)</span>
                  </span>
                ) : staged ? (
                  <span className="line-fg-caption">
                    {staged.name} <DocumentFileMeta file={staged} />
                  </span>
                ) : (
                  <span className="caption-muted">{RULES.formatsLabel}, up to {RULES.maxLabel}</span>
                )}
                {hasFile && (
                  <IconButton icon={TRASH} tone="danger" label="Remove the Attached Document" onClick={() => askRemove(staged?.name ?? 'Scanned document', () => { setStaged(null); setPages([]); setError(null); }) } />
                )}
              </div>
              {/* What was just scanned (or photographed, or chosen) is shown here, before it is attached. */}
              {pages.length > 0 ? <FilePagesPreview files={pages} onDelete={(i) => setPages((p) => p.filter((_, k) => k !== i))} /> : <FileImagePreview file={staged} />}
              {pageScan.error && (
                <p role="alert" className="text-danger text-[length:var(--fs-caption)]">
                  {pageScan.error}
                </p>
              )}
              {progress !== undefined && (
                <div className="space-y-1">
                  <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="meter-track-lg w-full">
                    <div className="meter-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="caption-muted">Uploading {pages.length > 0 ? 'scanned document' : staged?.name} - {progress}%</p>
                </div>
              )}
              {/* The flatbed scanner takes more than one page: Add Page scans the next page onto the same document, beside Upload Document in one row (Add Page first). */}
              <div className="flex gap-3">
                {flatbed && (
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={pages.length === 0 || pageScan.scanning || progress !== undefined}
                    title={pages.length === 0 ? 'Initiate Scan first' : undefined}
                    onClick={() => {
                      scansTaken.current += 1;
                      void pageScan.scan((f) => setPages((p) => [...p, f]), scansTaken.current);
                    }}
                  >
                    {pageScan.scanning ? 'Scanning…' : 'Add Page'}
                  </Button>
                )}
                <Button className="flex-1" onClick={() => void uploadStaged()} disabled={!label.trim() || !hasFile || progress !== undefined}>
                  Upload Document
                </Button>
              </div>
                </>
              )}
          </section>
        ) : (
          <p className="caption-muted">Maximum of {maxDocuments} documents reached. Remove one to upload another.</p>
        )}
        {(rows.some((r) => !r.removable) || listed.length > 0) && (
          // One flat list of every document scanned or uploaded earlier in the journey: no container per document or per group.
          <section aria-label="Journey documents" className="space-y-2">
            {listed.length > 0 && (
              <div className="space-y-1.5" aria-label="Uploaded documents" role="group">
                <ul className="stack gap-1 data-rows-ruled">
                  {listed.map((d) => {
                    const dataUrl = documentFileOf(d.id)?.dataUrl;
                    const name = dataUrl ? (
                      <Button variant="link" type="button" className="underline text-left" onClick={() => setViewing({ title: `${d.label} - ${d.fileName}`, pages: [{ dataUrl }] })}>
                        {d.label}
                      </Button>
                    ) : (
                      <span className="text-fg-2">{d.label}</span>
                    );
                    // Rows, everywhere a document list is shown: the document and its file on the left, Remove at the right, a rule between.
                    return (
                      <li key={d.id} className="split-nowrap data-row">
                        <span className="value-text truncate">
                          {name}
                          <span className="block caption-muted">{[d.fileName, pagesLabel(d.pageCount)].filter(Boolean).join(' · ')}</span>
                        </span>
                        {removableHere(d) && (
                          <IconButton icon={TRASH} tone="danger" label={`Remove ${d.fileName}`} onClick={() => askRemove(d.fileName, () => remove(d.id))} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {/* Collapsed until asked for: one toggle under the upload, then the list of everything the journey scanned or uploaded. The mandatory documents uploaded here stay under Uploaded Documents until Continue saves them; they are not repeated in this list. */}
            {/* A button, with the arrow up while the list is open and down while it is closed. */}
            {/* Not on a page of its own (bare): there the documents attached here are all the agent needs, so the journey's other documents are not offered. */}
            {!bare && (
            <Button variant="secondary" size="sm" aria-expanded={journeyOpen} aria-controls="journey-documents-list" onClick={() => setJourneyOpen((o) => !o)}>
              View All Journey Documents <span className="caption-muted font-normal">({rows.length - pendingHere.length})</span>
              <Icon path={journeyOpen ? SORT_ASC_ICON : CHEVRON_DOWN} className="size-4 " />
            </Button>
            )}
            <ul id="journey-documents-list" hidden={!journeyOpen || bare} className="stack gap-1 data-rows-ruled">
              {sections.flatMap((g) => {
                // Only the document, not the journey step it came from ("QID Document", not "Customer Verification: QID Document").
                const docTitle = g.title.includes(': ') ? g.title.slice(g.title.indexOf(': ') + 2) : g.title;
                // Every image the document has (its front and back ...), each labelled by its side when there are several: opening any side shows them all.
                const pages = g.items.map((d) => ({ label: g.items.length > 1 || g.kind !== d.label ? sideOf(d.label) : undefined, ...imageOf(d) })).filter((x) => x.dataUrl || x.scan);
                return g.items.map((d) => {
                  const viewable = Boolean(imageOf(d).dataUrl || imageOf(d).scan);
                  // The document, then which side when the group holds several.
                  const title = g.items.length > 1 || g.kind !== d.label ? `${docTitle} - ${sideOf(d.label)}` : docTitle;
                  return (
                    // A plain text link that opens the document; a document no copy is held of is just its name.
                    <li key={d.id} className="data-row value-text">
                      {viewable ? (
                        <Button variant="link" type="button" className="underline text-left" onClick={() => setViewing({ title: docTitle, pages })}>
                          {title}
                        </Button>
                      ) : (
                        <span className="text-fg-2">{title}</span>
                      )}
                    </li>
                  );
                });
              })}
              {/* Whatever was uploaded here (the Under-18 Exception's Court Order included) belongs to the task and is opened from here too. */}
              {documents.filter((d) => !pendingHere.includes(d)).map((d) => {
                const dataUrl = documentFileOf(d.id)?.dataUrl;
                const title = `Additional Documents: ${d.label}`;
                return (
                  <li key={`all-${d.id}`} className="split-nowrap data-row value-text">
                    {dataUrl ? (
                      <Button variant="link" type="button" className="underline text-left" onClick={() => setViewing({ title: `${d.label} - ${d.fileName}`, pages: [{ dataUrl }] })}>
                        {title}
                      </Button>
                    ) : (
                      <span className="text-fg-2">{title}</span>
                    )}
                    {/* Only a document added in this section can be deleted from here (the others belong to the steps that collected them). */}
                    {removableHere(d) && (
                      <IconButton icon={TRASH} tone="danger" label={`Remove ${d.fileName}`} onClick={() => askRemove(d.fileName, () => remove(d.id))} />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        </div>
      </div>

      {/* The whole document on one page: every image (front, back, each page) one under another, each captioned by its side when there are several. */}
      <Drawer open={Boolean(viewing)} onClose={() => setViewing(undefined)} title={viewing?.title ?? 'Document'}>
        {viewing && (
          <div className="stack gap-6">
            {viewing.pages.map((page, i) => {
              const name = page.label ? `${viewing.title} - ${page.label}` : viewing.title;
              return (
                <figure key={`${page.label ?? ''}-${i}`} className="stack gap-2">
                  {page.scan ? (
                    <div className="mx-auto max-w-md w-full">
                      <ScannedIdPreview side={page.scan.side} documentType={page.scan.documentType} variant={page.scan.variant} clear />
                    </div>
                  ) : page.dataUrl && /^data:application\/pdf/.test(page.dataUrl) ? (
                    <iframe title={name} src={blobUrlOf(page.dataUrl)} className="h-[70vh] w-full panel-soft" />
                  ) : page.dataUrl ? (
                    <img src={page.dataUrl} alt={name} className="mx-auto max-w-full panel-soft" />
                  ) : null}
                  {page.label && <figcaption className="caption-secondary text-center">{page.label}</figcaption>}
                </figure>
              );
            })}
          </div>
        )}
      </Drawer>

      {error && (
        <p role="alert" className="text-danger text-[length:var(--fs-caption)]">
          {error}
        </p>
      )}
    </>
  );
  // Every document upload container carries the one upload fill (--upload-section-bg). Bare (on the page, under its own heading) or with separate uploads the uploader has no frame of its own:
  // each document's row is its own container. Otherwise the one upload block is the container.
  return <div className={bare || (separateUploads && labelOptions) ? 'space-y-4' : 'upload-section p-4 space-y-4'}>{body}</div>;
}
