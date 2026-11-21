/**
 * The documents the system holds for a customer, for Customer 360's Documents tab: their identity documents (identity-documents.json) and the Customer
 * Acquisition Forms they signed (caf-forms.json), each with the status the record gives it. A document is Active or Archived - an archived one is kept on
 * file (a passport replaced by a QID, a superseded CAF) and an agent can still view it. A record with no status stays unknown, shown as "-": it appears
 * under All only, never under Active or Archived (unknown is not defaulted to Active).
 */
export type DocumentStatus = 'Active' | 'Archived';
export type DocumentFilter = 'all' | 'active' | 'archived';
export type DocumentKind = 'Identity Document' | 'Customer Acquisition Form';

type Rec = Record<string, unknown>;

export interface CustomerDocumentRow {
  id: string;
  kind: DocumentKind;
  /** What it is: "Passport", "CAF PCA001". */
  title: string;
  /** Its number or reference: the document number, the CAF id. */
  reference: string;
  /** Undefined = the record carries no status (unknown). */
  status: DocumentStatus | undefined;
  /** When it was uploaded (or scanned). */
  uploadedAt?: string;
  /** The facts of the record, in reading order, for the detail view (empty values are left out). */
  details: { label: string; value: string }[];
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : undefined);
const statusOf = (v: unknown): DocumentStatus | undefined => (v === 'Active' || v === 'Archived' ? v : undefined);
const facts = (pairs: [string, unknown][]) => pairs.flatMap(([label, v]) => (text(v) === undefined ? [] : [{ label, value: text(v) as string }]));

/** One row per identity document and per CAF form, newest upload first (a record with no upload time last). */
export function customerDocumentRows(identityDocuments: Rec[], cafForms: Rec[]): CustomerDocumentRow[] {
  const identity: CustomerDocumentRow[] = identityDocuments.map((d) => ({
    id: String(d.identityDocumentId),
    kind: 'Identity Document',
    title: text(d.documentType) ?? 'Identity document',
    reference: text(d.documentNumber) ?? '-',
    status: statusOf(d.docStatus),
    uploadedAt: text(d.uploadDateTime) ?? text(d.scannedAt),
    details: facts([
      ['Document Type', d.documentType],
      ['Document Number', d.documentNumber],
      ['Expiry Date', d.expiryDate],
      ['Validation', d.status],
      ['Validation Path', d.validationPath],
      ['Scanned At', d.scannedAt],
      ['Document Status', d.docStatus],
      ['Reference', d.serviceReference],
    ]),
  }));
  const forms: CustomerDocumentRow[] = cafForms.map((f) => ({
    id: String(f.cafId),
    kind: 'Customer Acquisition Form',
    title: `CAF ${text(f.formId) ?? ''}`.trim(),
    reference: text(f.cafId) ?? '-',
    status: statusOf(f.status),
    uploadedAt: text(f.uploadDateTime),
    details: facts([
      ['CAF ID', f.cafId],
      ['Form', f.formId],
      ['Order', f.orderId],
      ['Signature Method', f.signatureMethod],
      ['Signed Date', f.signedDate],
      ['Language', f.language],
      ['Proof of Employment Attached', f.proofOfEmploymentAttached],
      ['Document Status', f.status],
      ['Reference', f.serviceReference],
    ]),
  }));
  return [...identity, ...forms].sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''));
}

/** The rows a filter shows: All is everything (unknown-status ones included); Active and Archived only the rows recorded as such. */
export function filterDocuments(rows: CustomerDocumentRow[], filter: DocumentFilter): CustomerDocumentRow[] {
  if (filter === 'all') return rows;
  const want: DocumentStatus = filter === 'active' ? 'Active' : 'Archived';
  return rows.filter((r) => r.status === want);
}
