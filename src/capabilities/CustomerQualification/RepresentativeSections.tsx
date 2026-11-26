import { Button, Card, detectDeviceType, DocumentFileMeta, FileImagePreview, fileTypeOfMime, forgetDocumentFile, Icon, IconButton, pdfPageCountOfFile, readFileAsDataUrl, rememberDocumentFile, RemoveDocumentDialog, SCAN_CORNERS, scannedFileName, TRASH, useDocumentScan } from 'dxp-ui';
import { useEffect, useRef, useState } from 'react';
import { CustomerIdentification } from '../CustomerIdentification/CustomerIdentification';
import { AdditionalDocumentsUpload, DocumentCaptureActions, UPLOAD_RULES, uploadFileProblem } from '../DocumentUpload';
import type { AdditionalDocument } from '../DocumentUpload';
import { useDemoReaderCustomer } from '../ActualUser/useDemoReaderCustomer';
import { fileSizeLabel } from '../../lib/format';
import { idTypesFor } from '../../data/idTypes';
import { AUTHORIZATION_DOCUMENT_TYPES, MANDATORY_AUTHORIZATION_DOCUMENT, DEMO_AUTHORIZED_PERSON_IDS, representativeProblem } from './representative';
import { listEntities } from '../../services/entityOps';
import type { CustomerRepresentativeValue } from './representative';
import type { IdLookupValue } from '../../components/patterns/idLookupModel';

/** The actual customer's ID documents: any number, scanned (the desk scanner or the device camera) or uploaded - originals, printed copies or digital copies. */
function ActualCustomerIdDocuments({ documents, onChange }: { documents: AdditionalDocument[]; onChange: (d: AdditionalDocument[]) => void }) {
  const [error, setError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  // The documents in hand while files are still being read: several files chosen together are added together.
  const held = useRef(documents);
  useEffect(() => {
    held.current = documents;
  });
  // A scan (or camera capture) just taken: shown at once, and attached only when the agent accepts it.
  const [pending, setPending] = useState<File | undefined>();
  // The document the agent asked to remove, until they confirm.
  const [removing, setRemoving] = useState<AdditionalDocument | undefined>();
  const cameraRef = useRef<HTMLInputElement>(null);
  const { scanning, error: scanError, scan } = useDocumentScan('Actual Customer ID');
  const tablet = detectDeviceType() === 'tablet';
  // Another pass over the scanner (the desk scanner, or the device camera on a tablet).
  const scanAgain = () => (tablet ? cameraRef.current?.click() : void scan(setPending));
  const add = async (files: File[]) => {
    const problems: string[] = [];
    const added: AdditionalDocument[] = [];
    for (const file of files) {
      const problem = uploadFileProblem(file, UPLOAD_RULES.supporting);
      if (problem) {
        problems.push(problem);
        continue;
      }
      const id = `${Date.now()}-${added.length}-${file.name}`;
      try {
        rememberDocumentFile(id, await readFileAsDataUrl(file), file.type);
      } catch {
        /* the document is still attached; it just cannot be opened */
      }
      added.push({ id, label: 'Actual Customer ID', fileName: file.name, sizeBytes: file.size, pageCount: await pdfPageCountOfFile(file) });
    }
    setError(problems.length ? problems.join(' ') : null);
    if (added.length) onChange([...held.current, ...added]);
  };
  return (
    <div className="space-y-2">
      <div className="document-slot">
        {/* Each scan adds a document; the web's capture actions are the scanner only, so the upload sits beside it (a tablet's already include it). */}
        {tablet ? (
          <DocumentCaptureActions what="actual customer ID" documentType="Actual Customer ID" hasDocument={false} onFile={setPending} />
        ) : (
          // The desk scanner, with the same button the ID scan has: primary, with the scan icon.
          <Button size="sm" className="shrink-0" disabled={scanning} onClick={scanAgain}>
            <Icon path={SCAN_CORNERS} className="size-4 " />
            Initiate scan
          </Button>
        )}
        {detectDeviceType() !== 'tablet' && (
          <>
            <input ref={uploadRef} type="file" multiple accept={UPLOAD_RULES.supporting.accept} className="sr-only" tabIndex={-1} aria-label="Upload the actual customer ID documents" onChange={(e) => { const f = [...(e.currentTarget.files ?? [])]; e.currentTarget.value = ''; void add(f); }} />
            <Button variant="secondary" size="sm" onClick={() => uploadRef.current?.click()}>
              Upload Documents
            </Button>
          </>
        )}
        <span className="caption-muted">
          {UPLOAD_RULES.supporting.formatsLabel}, up to {UPLOAD_RULES.supporting.maxLabel} each
        </span>
      </div>
      {tablet && <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Capture the actual customer ID with the camera again" onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) setPending(new File([f], scannedFileName(new Date(), 'Actual Customer ID', fileTypeOfMime(f.type)), { type: f.type })); }} />}
      {pending && (
        <Card className="p-4 space-y-3" aria-label="Scanned document preview">
          <FileImagePreview file={pending} />
          <p className="line-fg-caption text-center">{pending.name} <DocumentFileMeta file={pending} /></p>
          <div className="cluster justify-center gap-3">
            <Button size="sm" onClick={() => { void add([pending]); setPending(undefined); }}>
              Accept
            </Button>
            <Button variant="secondary" size="sm" disabled={scanning} onClick={scanAgain}>
              Rescan
            </Button>
          </div>
        </Card>
      )}
      {scanError && (
        <p role="alert" className="text-danger text-[length:var(--fs-caption)]">
          {scanError}
        </p>
      )}
      {documents.length > 0 && (
        <ul aria-label="Actual customer ID documents" className="stack gap-1 data-rows-ruled">
          {documents.map((d) => (
            <li key={d.id} className="split-nowrap data-row">
              <span className="value-text truncate">
                {d.fileName} <span className="text-muted">({fileSizeLabel(d.sizeBytes, d.pageCount)})</span>
              </span>
              <IconButton icon={TRASH} tone="danger" label={`Remove ${d.fileName}`} onClick={() => setRemoving(d)} />
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-danger text-[length:var(--fs-caption)]">
          {error}
        </p>
      )}
      <RemoveDocumentDialog
        fileName={removing?.fileName}
        onCancel={() => setRemoving(undefined)}
        onConfirm={() => {
          if (removing) {
            forgetDocumentFile(removing.id);
            onChange(documents.filter((x) => x.id !== removing.id));
          }
          setRemoving(undefined);
        }}
      />
    </div>
  );
}

/** The customer whose own document the demo reader presents for the authorized person's ID type (DEMO_AUTHORIZED_PERSON_IDS); undefined until the data loads, or when nobody holds it. */
function useDemoAuthorizedPersonCustomer(idType: string | undefined): string | undefined {
  const [docs, setDocs] = useState<{ customerId: string; documentType: string; documentNumber: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    void listEntities<{ customerId: string; documentType: string; documentNumber: string }>('identity-documents').then((all) => {
      if (!cancelled) setDocs(all);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const number = idType ? DEMO_AUTHORIZED_PERSON_IDS[idType] : undefined;
  return number ? docs.find((d) => d.documentType === idType && d.documentNumber === number)?.customerId : undefined;
}

/**
 * The section the dedicated Contact page shows once the actual customer's typed details are MOI-validated, after Identity Details and Contact & Notification:
 * the actual customer's ID documents (scan or upload). That page holds the actual customer only.
 */
export function ActualCustomerDocuments({ value, onChange }: { value: CustomerRepresentativeValue; onChange: (value: CustomerRepresentativeValue) => void }) {
  return (
    <div className="mt-6 pt-6 divider-top space-y-6">
      <section className="space-y-3" aria-labelledby="rep-actual-id">
        <h3 id="rep-actual-id" className="title title-md font-semibold">Actual Customer&apos;s Identity Document</h3>
        <p className="caption-muted">Scan or upload the actual customer&apos;s ID: an original, a printed copy or a digital copy. Add as many documents as needed.</p>
        <ActualCustomerIdDocuments documents={value.actualIdDocuments ?? []} onChange={(d) => onChange({ ...value, actualIdDocuments: d })} />
      </section>
    </div>
  );
}

/**
 * The Authorized Person page, everything about the person acting for the actual customer: first the identity of the authorized person who is physically present (identified with
 * the same ID scanner the Contact page uses), then the authorization / supporting documents (Power of Attorney, Court Order ...) to scan or upload.
 */
export function AuthorizedPerson({ value, onChange, values, actualCustomerId }: { value: CustomerRepresentativeValue; onChange: (value: CustomerRepresentativeValue) => void; values: Record<string, unknown>; actualCustomerId?: string }) {
  // The demo reader presents someone other than the customer on screen: the authorized person is a different person.
  const demoCustomerId = useDemoAuthorizedPersonCustomer(value.identity?.idType);
  const fallbackCustomerId = useDemoReaderCustomer(actualCustomerId);
  const readerCustomerId = demoCustomerId && demoCustomerId !== actualCustomerId ? demoCustomerId : fallbackCustomerId;
  const problem = representativeProblem(values);
  return (
    <div className="space-y-6">
    <section className="space-y-3" aria-label="Authorized Person Identity">
      <Card className="p-4">
        <CustomerIdentification
          // Not the customer on screen, and not necessarily a customer at all: nothing is bound to the context customer and no record is created.
          unbound
          allowNewCustomer={false}
          scanAsCustomerId={readerCustomerId}
          allowedIdTypes={idTypesFor('all')}
          verifyThenFetch
          // The page shows the validated identity without the "MOI validated" line.
          hideMoiNote
          value={value.identity ?? {}}
          onChange={(v: IdLookupValue) => onChange({ ...value, identity: v })}
        />
      </Card>
      {problem && (
        <p role="alert" className="text-danger text-[length:var(--fs-caption)]">
          {problem}
        </p>
      )}
    </section>
    {/* The authorization documents are asked for only once the authorized person is MOI-validated. */}
    {value.identity?.moiResult && (
    <section className="space-y-3" aria-labelledby="rep-auth">
      <h3 id="rep-auth" className="title title-md font-semibold">Authorization / Supporting Documents</h3>
      <AdditionalDocumentsUpload
        bare
        confirmRemove
        reviewScan
        documents={value.authorizationDocuments ?? []}
        onChange={(documents) => onChange({ ...value, authorizationDocuments: documents })}
        labelOptions={AUTHORIZATION_DOCUMENT_TYPES}
        // Each document is uploaded on its own row, not chosen from a Document Type dropdown.
        separateUploads
        mandatoryLabels={[MANDATORY_AUTHORIZATION_DOCUMENT]}
        maxDocuments={5}
      />
    </section>
    )}
    </div>
  );
}
