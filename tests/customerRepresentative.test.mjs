import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, load, close } from './harness.mjs';

// Customer Representative: a mode of the New Connection Contact page, not a journey of its own.
let m, q;
before(async () => {
  await boot();
  m = await load('/src/capabilities/CustomerQualification/representative.ts');
  q = { ...(await load('/src/capabilities/CustomerQualification/step.tsx')), ...(await load('/src/capabilities/CustomerQualification/representativeStep.tsx')) };
});
after(close);

const doc = (label) => ({ id: label, label, fileName: `${label}.pdf`, sizeBytes: 10 });
const rep = (over = {}) => ({
  enabled: true,
  actualIdDocuments: [doc('Actual Customer ID')],
  authorizationDocuments: [doc('Power of Attorney / Authorization Letter / Court Order')],
  identity: { idType: 'QID', idNumber: '29001012345', scannedExpiry: '01/01/2030', moiResult: { name: 'Sara' } },
  ...over,
});
const values = (r, contactId = '28456701234') => ({ contact: { idNumber: contactId }, customerRepresentative: r });

test('without the option ticked nothing changes: not a representative order, always complete, no name', () => {
  for (const v of [{}, values(undefined), values({ enabled: false })]) {
    assert.equal(m.isRepresentativeOrder(v), false);
    assert.equal(m.isRepresentativeComplete(v), true);
    assert.equal(m.representativeName(v), undefined);
  }
});

test('a representative order needs the actual customer\'s ID document, an authorization document and the representative\'s ID', () => {
  assert.equal(m.isRepresentativeComplete(values(rep())), true);
  assert.equal(m.isRepresentativeComplete(values(rep({ actualIdDocuments: [] }))), false, 'no actual customer ID');
  assert.equal(m.isRepresentativeComplete(values(rep({ authorizationDocuments: [] }))), false, 'no authorization document');
  assert.equal(m.isRepresentativeComplete(values(rep({ authorizationDocuments: undefined }))), false);
  assert.equal(m.isRepresentativeComplete(values(rep({ identity: undefined }))), false, 'no representative ID');
  assert.equal(m.isRepresentativeComplete(values(rep({ identity: { idType: 'QID', idNumber: '29001012345' } }))), false, 'number without an expiry or MOI');
  assert.equal(m.isRepresentativeComplete(values(rep({ identity: { idType: 'QID', idNumber: '29001012345', scannedExpiry: '01/01/2030' } }))), false, 'captured but not MOI-validated: the authorization documents are not asked for yet');
  assert.equal(m.isRepresentativeComplete(values(rep({ identity: { idType: 'QID', idNumber: '29001012345', moiResult: { name: 'Sara' } } }))), true, 'MOI answered');
});

test('the pages split the work: Contact needs only the actual customer\'s ID documents; Authorized Person needs the authorization documents and the person\'s ID', () => {
  const noAuth = values(rep({ authorizationDocuments: [] }));
  assert.equal(m.isActualCustomerDocumentsComplete(noAuth), true, 'Contact does not ask for authorization documents');
  assert.equal(m.isAuthorizedPersonComplete(noAuth), false);
  const noId = values(rep({ actualIdDocuments: [] }));
  assert.equal(m.isActualCustomerDocumentsComplete(noId), false);
  assert.equal(m.isAuthorizedPersonComplete(noId), true, 'the Authorized Person page does not ask for the actual customer\'s ID');
});

test('the representative is a different person from the actual customer', () => {
  const same = values(rep(), '29001012345');
  assert.ok(m.representativeProblem(same));
  assert.equal(m.isRepresentativeComplete(same), false);
  assert.equal(m.representativeProblem(values(rep())), undefined);
});

test('the CAF names the representative: MOI name, else the ID presented', () => {
  assert.equal(m.representativeName(values(rep({ identity: { idType: 'QID', idNumber: '1', moiResult: { name: 'Sara Al-Kuwari' } } }))), 'Sara Al-Kuwari');
  assert.match(m.representativeName(values(rep({ identity: { idType: 'QID', idNumber: '29001012345', scannedExpiry: '01/01/2030' } }))), /29001012345/);
});

test('the Customer Representative page is a duplicate of Contact: same key, active only while the option is ticked; the existing page is not changed', () => {
  const ctx = { flow: 'new', existingCustomerId: undefined, guardedContactChange: () => {}, productAgnostic: true, journeyChosenLater: true };
  const dedicated = q.representativeContactStep(ctx);
  const existing = q.customerQualificationStep(ctx);
  assert.equal(dedicated.key, existing.key);
  assert.equal(dedicated.skip({}), true);
  assert.equal(dedicated.skip({ customerRepresentative: { enabled: true } }), false);
  assert.equal(existing.skip, undefined, 'the existing page is skipped only by the New Connection shell, which adds the checkbox');
  assert.equal(existing.headerAction, undefined);
  assert.equal(dedicated.isValid({}), false);
});

test('the journey\'s documents list the actual customer\'s IDs, the authorized person\'s ID scans and the authorization documents', async () => {
  const jd = await load('/src/engines/journeyDocuments.ts');
  const scans = { frontScanned: true, backScanned: true, source: 'scan' };
  const docs = jd.consolidatedDocuments({
    customerRepresentative: { enabled: true, actualIdDocuments: [doc('a1'), doc('a2')], authorizationDocuments: [doc('Power of Attorney / Authorization Letter / Court Order')], identity: { idType: 'QID', idNumber: '27798765432', qidScans: scans } },
  });
  const labels = docs.map((d) => d.label);
  assert.equal(labels.filter((l) => l === "Actual Customer's Identity Document").length, 2, 'every actual customer ID document');
  assert.ok(labels.some((l) => /^Authorized Person QID ID Document|^Authorized Person QID Document/.test(l)), 'the authorized person\'s scanned ID');
  assert.ok(labels.includes('Power of Attorney / Authorization Letter / Court Order'), 'the authorization document');
  assert.equal(jd.consolidatedDocuments({ customerRepresentative: { enabled: false, actualIdDocuments: [doc('a1')] } }).length, 0, 'nothing when it is not a representative order');
});

test('Authorization / Supporting Documents: no Document Type dropdown; each type has its own upload row, and an uploaded type keeps its container, showing the file there', async () => {
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AdditionalDocumentsUpload } = await load('/src/components/domain/AdditionalDocumentsUpload.tsx');
  const types = m.AUTHORIZATION_DOCUMENT_TYPES;
  const html = (documents) => renderToStaticMarkup(React.createElement(AdditionalDocumentsUpload, { bare: true, separateUploads: true, labelOptions: types, documents, onChange: () => {} }));
  const empty = html([]);
  assert.doesNotMatch(empty, /role="combobox"|Choose Document Type/, 'no dropdown');
  for (const t of types) assert.match(empty, new RegExp(t.replace(/[/]/g, '\\/').replace(/[()]/g, '\\$&')), `a row for ${t}`);
  assert.equal((empty.match(/Upload Document/g) ?? []).length >= types.length, true, 'each row has its own Upload Document');
  const oneDone = html([doc(types[0])]);
  assert.equal(oneDone.includes('aria-label="Upload documents"'), true);
  assert.equal((oneDone.match(/Initiate Scan|Upload Document/g) ?? []).length < (empty.match(/Initiate Scan|Upload Document/g) ?? []).length, true, 'an uploaded type has no upload buttons left');
  for (const t of types) assert.ok(oneDone.includes(t.replace(/&/g, '&amp;')), `the container for ${t} stays`);
  assert.match(oneDone, new RegExp(`Remove ${types[0].replace(/[/]/g, '\\/').replace(/[()]/g, '\\$&')}\\.pdf`), 'the uploaded file is listed in its own container with Remove');
});

test('Authorization / Supporting Documents: only the Power of Attorney / Authorization Letter / Court Order is mandatory; the other supporting document is optional', () => {
  const [mandatory, optional] = m.AUTHORIZATION_DOCUMENT_TYPES;
  assert.equal(m.MANDATORY_AUTHORIZATION_DOCUMENT, mandatory);
  assert.equal(m.isRepresentativeComplete(values(rep({ authorizationDocuments: [doc(optional)] }))), false, 'the optional document alone does not complete the page');
  assert.equal(m.isRepresentativeComplete(values(rep({ authorizationDocuments: [doc(mandatory)] }))), true, 'the mandatory one alone does');
  assert.equal(m.isRepresentativeComplete(values(rep({ authorizationDocuments: [doc(mandatory), doc(optional)] }))), true);
});

test('an uploaded or scanned PDF shows its page count beside its size, inside its own container; an image shows its size only', async () => {
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AdditionalDocumentsUpload } = await load('/src/components/domain/AdditionalDocumentsUpload.tsx');
  const fmt = await load('/src/lib/format.ts');
  const types = m.AUTHORIZATION_DOCUMENT_TYPES;
  const html = (documents) => renderToStaticMarkup(React.createElement(AdditionalDocumentsUpload, { bare: true, separateUploads: true, labelOptions: types, documents, onChange: () => {} }));
  assert.match(html([{ ...doc(types[0]), sizeBytes: 148 * 1024, pageCount: 3 }]), /148 KB · 3 pages/);
  assert.match(html([{ ...doc(types[0]), sizeBytes: 148 * 1024, pageCount: 1 }]), /148 KB · 1 page</);
  const image = html([{ ...doc(types[0]), fileName: 'scan.jpg', sizeBytes: 148 * 1024 }]);
  assert.match(image, />148 KB</);
  assert.doesNotMatch(image, /pages?</);
  assert.equal(fmt.pagesLabel(undefined), '', 'unknown stays unknown');
  assert.equal(fmt.fileSizeLabel(2048, 2), '2 KB · 2 pages');
});

test('separate uploads: a mandatory document is marked * and listed first; a non-mandatory one carries no marker (no "(Optional)")', async () => {
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AdditionalDocumentsUpload } = await load('/src/components/domain/AdditionalDocumentsUpload.tsx');
  const out = renderToStaticMarkup(React.createElement(AdditionalDocumentsUpload, { bare: true, separateUploads: true, labelOptions: ['QID', 'Passport', 'Upfront Payment Receipt'], mandatoryLabels: ['Upfront Payment Receipt'], documents: [], onChange: () => {} }));
  assert.doesNotMatch(out, /\(Optional\)/);
  assert.ok(out.indexOf('Upfront Payment Receipt') < out.indexOf('QID'), 'the mandatory document comes first');
  assert.match(out, /Upfront Payment Receipt<span[^>]*>\s*\*<\/span>/, 'marked *');
  assert.doesNotMatch(out, /QID<span/, 'QID carries no marker');
});
