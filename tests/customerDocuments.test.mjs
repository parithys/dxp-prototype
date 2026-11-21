// Customer 360 Documents: identity documents and CAF forms on file, with an All / Active / Archived filter; archived ones stay viewable.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
let cd;
before(async () => { await boot(); cd = await load('/src/engines/customerDocuments.ts'); });
after(close);

const R = (n) => JSON.parse(fs.readFileSync(`public/mock-data/${n}.json`, 'utf8'));
const read = (p) => fs.readFileSync(p, 'utf8');

const ids = [
  { identityDocumentId: 'D1', documentType: 'QID', documentNumber: '1', docStatus: 'Active', uploadDateTime: '2026-01-02T00:00:00' },
  { identityDocumentId: 'D2', documentType: 'Passport', documentNumber: '2', docStatus: 'Archived', uploadDateTime: '2026-03-01T00:00:00', expiryDate: '2029-01-01' },
  { identityDocumentId: 'D3', documentType: 'GCC ID', documentNumber: '3' }, // no status: unknown
];
const cafs = [
  { cafId: 'C1', formId: 'PCA001', status: 'Archived', uploadDateTime: '2026-02-01T00:00:00', signatureMethod: 'Digital' },
  { cafId: 'C2', formId: 'PCA001', status: 'Active', uploadDateTime: '2025-12-01T00:00:00' },
  { cafId: 'C3', formId: 'PCA002', status: 'Pending' }, // not a status the filter knows: unknown
];

test('one row per identity document and CAF form, newest upload first, with each status as recorded', () => {
  const rows = cd.customerDocumentRows(ids, cafs);
  assert.equal(rows.length, ids.length + cafs.length, 'conservation: nothing dropped, nothing added');
  assert.deepEqual(rows.map((r) => r.id), ['D2', 'C1', 'D1', 'C2', 'D3', 'C3'], 'newest first; no upload time last');
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.deepEqual([by.D1.status, by.D2.status, by.D3.status, by.C1.status, by.C2.status, by.C3.status], ['Active', 'Archived', undefined, 'Archived', 'Active', undefined]);
  assert.equal(by.D2.kind, 'Identity Document');
  assert.equal(by.C1.kind, 'Customer Acquisition Form');
  assert.equal(by.C1.title, 'CAF PCA001');
  assert.ok(by.D2.details.some((d) => d.label === 'Expiry Date' && d.value === '2029-01-01'));
  assert.ok(!by.D1.details.some((d) => d.label === 'Expiry Date'), 'an empty fact is left out');
});

test('the filter: All shows everything, Active and Archived only what is recorded as such; unknown is never counted as Active', () => {
  const rows = cd.customerDocumentRows(ids, cafs);
  const idsOf = (f) => cd.filterDocuments(rows, f).map((r) => r.id).sort();
  assert.deepEqual(idsOf('all'), ['C1', 'C2', 'C3', 'D1', 'D2', 'D3']);
  assert.deepEqual(idsOf('active'), ['C2', 'D1']);
  assert.deepEqual(idsOf('archived'), ['C1', 'D2']);
  const unknown = rows.filter((r) => r.status === undefined).map((r) => r.id).sort();
  assert.deepEqual(unknown, ['C3', 'D3']);
  assert.equal(idsOf('active').length + idsOf('archived').length + unknown.length, rows.length, 'every row is in exactly one of Active, Archived, unknown');
});

test('over the whole dataset: every document record gets a row, and the archived ones are exactly the records marked Archived', () => {
  const identity = R('identity-documents');
  const forms = R('caf-forms');
  const rows = cd.customerDocumentRows(identity, forms);
  assert.equal(rows.length, identity.length + forms.length);
  // Written independently of the code: the archived records in the data.
  assert.deepEqual(cd.filterDocuments(rows, 'archived').map((r) => r.id).sort(), ['CAF-90003-01', 'IDD-9902']);
  assert.deepEqual(identity.filter((d) => d.docStatus === 'Archived').map((d) => d.identityDocumentId), ['IDD-9902']);
  assert.deepEqual(forms.filter((f) => f.status === 'Archived').map((f) => f.cafId), ['CAF-90003-01']);
});

test('Customer 360 has a Documents tab with the All / Active / Archived filter, the archived rows stay viewable, and the number is masked in the table', () => {
  const layout = read('src/workspace/customer360/Customer360Layout.tsx');
  assert.match(layout, /retailTab\('documents', 'Documents', \['Contact Information'\], <C360Documents \{\.\.\.tabProps\} \/>\)/);
  assert.match(layout, /documents: IC\.file,/);
  const tab = read('src/workspace/customer360/sections/C360Documents.tsx');
  assert.match(tab, /<TabStrip\s+variant="filter"/);
  for (const key of ['all', 'active', 'archived']) assert.match(tab, new RegExp(`key: '${key}'`));
  assert.match(tab, /maskAllButLast4\(r\.reference\)/);
  assert.match(tab, /selected\.status === 'Archived' && <p className="notice-info">/, 'an archived document says so when opened');
  assert.match(tab, /<ViewPill onClick=\{\(\) => setSelectedId\(r\.id\)\} \/>/);
});
