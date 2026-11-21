// Additional Documents: the required documents come from the scenario and the role and are asked for once, at the end of the journey; every
// document the journey holds is listed there to view and download.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

globalThis.window ??= globalThis;
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
const read = (p) => fs.readFileSync(p, 'utf8');
let jd;
let cfg;
before(async () => { await boot(); cfg = await load('/src/engines/configEngine.ts'); await cfg.loadConfig(); jd = await load('/src/engines/journeyDocuments.ts'); });
after(close);

test('a Waive Off requires its supporting document; no waiver, no requirement', () => {
  assert.deepEqual(jd.requiredDocumentsFor({ values: {}, journey: 'new-connection' }), []);
  for (const mode of [2000, 12500.5]) {
    const r = jd.requiredDocumentsFor({ values: { numberWaiver: mode }, journey: 'new-connection' });
    assert.deepEqual(r.map((x) => x.id), ['star-number-discount-approval']);
  }
  assert.deepEqual(jd.requiredDocumentsFor({ values: { numberWaiver: 2000 }, journey: 'prepaid' }), [], 'a journey that has no Waive Off is never asked');
});

test('a VAT registration number on a new billing account requires the VAT document; none, blank or an existing account asks for nothing', () => {
  const vat = (billingAccount) => jd.requiredDocumentsFor({ values: { billingAccount }, journey: 'new-connection' }).map((x) => x.id);
  assert.deepEqual(vat({ creatingNew: true, newAccount: { vatRegistrationNumber: 'VAT-123' } }), ['vat-document']);
  assert.deepEqual(vat({ creatingNew: true, newAccount: { vatRegistrationNumber: '   ' } }), [], 'blank is not a number');
  assert.deepEqual(vat({ creatingNew: true, newAccount: {} }), []);
  assert.deepEqual(vat({ selectedProfileId: 'BILL-1', newAccount: { vatRegistrationNumber: 'VAT-123' } }), [], 'an account picked from the customer\'s own is not a new one');
  assert.deepEqual(jd.requiredDocumentsFor({ values: {}, journey: 'new-connection' }), []);
});

test('an applicant under 18 requires the court order; unknown stays unknown', () => {
  const now = new Date();
  const dob = (years) => `01/01/${now.getFullYear() - years}`;
  assert.equal(jd.ageFromDob(dob(17), new Date(now.getFullYear(), 11, 31)), 17);
  const minor = jd.requiredDocumentsFor({ values: { contact: { moiResult: { dob: dob(16) } } } });
  assert.deepEqual(minor.map((x) => x.label), ['Court Type Order']);
  assert.deepEqual(jd.requiredDocumentsFor({ values: { contact: { moiResult: { dob: dob(30) } } } }), []);
  assert.deepEqual(jd.requiredDocumentsFor({ values: { contact: { moiResult: {} } } }), [], 'no date of birth on record: nothing is assumed');
  assert.equal(jd.ageFromDob('31/12/2000', new Date(2020, 11, 30)), 19);
  assert.equal(jd.ageFromDob('31/12/2000', new Date(2020, 11, 31)), 20);
  assert.equal(jd.ageFromDob('garbage'), undefined);
});

test('the consolidated list holds the ID scans, the evidence, the signature and the uploads, in order, only what exists', () => {
  assert.deepEqual(jd.consolidatedDocuments({}), []);
  const values = {
    contact: { idType: 'QID', qidScans: { frontScanned: true, backScanned: true, source: 'upload', frontImage: 'data:image/png;base64,AA==', backImage: 'data:image/png;base64,BB==', frontFile: 'f.png', backFile: 'b.png' } },
    customerType: { type: 'retired', officeId: { frontScanned: true, backScanned: true } },
    caf: { signatureDataUrl: 'data:image/png;base64,CC==' },
  };
  const docs = jd.consolidatedDocuments(values, [{ id: 'u1', label: 'Employer Letter', fileName: 'e.pdf' }]);
  assert.deepEqual(docs.map((d) => d.label), ['QID Document (Front)', 'QID Document (Back)', 'Retiree Supporting Document (Front)', 'Retiree Supporting Document (Back)', 'Signed CAF', 'Employer Letter']);
  assert.ok(docs[0].dataUrl && docs[4].dataUrl, 'an uploaded ID and the signature can be opened');
  assert.equal(docs[2].dataUrl, undefined, 'a capture the reader kept no image of has nothing to open');
  // a rejected benefit's evidence is not on the order
  assert.ok(!jd.consolidatedDocuments({ customerType: { type: 'mada', rejected: true, officeId: { frontScanned: true, backScanned: true } } }).length);
});

test('the requirements are asked for in Additional Documents after signing - not on the Waive Off dialog or the Number step - and hold Continue until uploaded', () => {
  const comp = read('src/components/domain/AdditionalDocumentsUpload.tsx');
  assert.match(comp, /aria-label="Required documents"/);
  assert.match(comp, /aria-label="Journey documents"/, 'every document held, in one flat list');
  assert.match(comp, /setViewing\(\{ title: docTitle, pages \}\)/, "a document opens in the side drawer, with all of its images");
  assert.doesNotMatch(comp, /downloadDocument/, 'viewing is enough: no download');
  const cap = read('src/components/patterns/CafSignatureCapture.tsx');
  // Continue is the wizard's floating footer, not a button in the page: the form reports a blocking document and the step's isValid holds Continue on it.
  assert.doesNotMatch(cap, /onClick=\{onContinue\}/);
  assert.match(cap, /documentsBlocked: documentsBlock/);
  assert.match(read('src/capabilities/CafSignature/step.tsx'), /documentsBlocked\) return false/);
  assert.match(read('src/capabilities/GuidedActivationWizard/GuidedActivationWizard.tsx'), /Page-level navigation is always the floating bar/);
  assert.match(read('src/capabilities/CafSignature/step.tsx'), /requiredDocumentsFor\(\{ values, personaId/);
  // The Additional Discount dialog takes the same document up front, and Apply waits for it.
  const dialog = read('src/capabilities/NumberSelection/WaiveOff.tsx');
  assert.match(dialog, /<DocumentCaptureActions/);
  // Apply needs a valid amount and, for an amount above zero, the document; zero is "no additional discount" and needs none (it removes the discount and its document).
  assert.match(dialog, /disabled=\{Boolean\(problem\) \|\| \(onDocumentChange !== undefined && amount !== 0 && !draftDoc\)\}/, 'Apply needs the amount and, above zero, the document');
  assert.match(dialog, /uploadFileProblem\(file, UPLOAD_RULES\.supporting\)/, 'the same rules as every other upload');
});

test('the document uploaded with the Additional Discount satisfies the requirement Additional Documents would otherwise ask for', () => {
  const req = jd.requirementForCondition('number-waiver');
  assert.ok(req, 'a document type is required when there is a waiver');
  const needed = jd.requiredDocumentsFor({ values: { numberWaiver: 2000 }, journey: 'new-connection', personaId: 'ROLE-01' });
  assert.deepEqual(needed.map((r) => r.id), [req.id]);
  assert.equal(jd.requirementForCondition('no-such-condition'), undefined);
  // the step reads what is attached by requirement id, the key the dialog writes under
  assert.match(read('src/capabilities/NumberSelection/step.tsx'), /requirementId: requirement\.id|d\.requirementId === requirement\.id/);
  assert.match(read('src/capabilities/CafSignature/step.tsx'), /attached\.includes\(r\.id\)/);
});

// ---- configurable document types: public/config/document-types.json ----------------------------------------------------
const base = { journey: 'new-connection', personaId: 'ROLE-01' };
const labels = (values, extra = {}) => jd.documentTypeOptionsFor({ ...base, values, ...extra });

test('every document type the business named is configured, with a unique id and label', () => {
  const types = cfg.getDocumentTypes();
  const named = ['QID', 'Passport', 'GCC ID', 'Employee ID', 'Special Needs Card', 'CAF', 'Supplementary Form', 'MNP Form', 'TON Form', 'Blue Plate', 'House Contract', 'Star Number Discount Approval', 'Upfront Payment Receipt', "Authorized Person's QID", 'Chooser Email Confirmation', "Chooser's QID", 'Commercial Registration', 'Company Letter Head', 'Computer Card', 'Contract Document', 'Customer Acceptance Document', 'Customer PO', 'Master Services Agreement', 'Plan Builder Form', 'Plan Discount Approval', 'Service Handover Document', 'Start-Billing Confirmation', 'Tender Document', 'Trade License', 'Volumetric Addendum Form', 'eKYC'];
  assert.deepEqual(named.filter((n) => !types.some((t) => t.label === n)), []);
  assert.equal(new Set(types.map((t) => t.id)).size, types.length);
  assert.ok(types.every((t) => t.basis), 'each rule says where it comes from');
});

test('Additional Documents offers the three configured documents only - Upfront Payment Receipt first, then the two optional ones - whatever the journey, role or customer', () => {
  const MANDATORY = ['Upfront Payment Receipt', 'Special Needs Card', 'Star Number Discount Approval'];
  assert.deepEqual(jd.mandatoryDocumentLabels(), ['Upfront Payment Receipt'], 'only the Upfront Payment Receipt is mandatory');
  const plain = { product: 'postpaid', contact: { idType: 'QID' }, eligibility: { segment: 'Consumer' } };
  for (const values of [plain, { ...plain, contact: { idType: 'Passport' } }, { ...plain, product: 'mnp' }, { ...plain, eligibility: { segment: 'Enterprise (EBU)' } }, { ...plain, checkoutTotals: { dueTodayQar: 0 } }]) {
    assert.deepEqual(labels(values), MANDATORY);
  }
  assert.deepEqual(labels(plain, { journey: undefined, personaId: undefined }), MANDATORY);
});

test('Continue waits for the Upfront Payment Receipt only; it counts once uploaded, by label', () => {
  const all = ['Upfront Payment Receipt'];
  assert.deepEqual(jd.missingMandatoryDocuments(undefined), all);
  assert.deepEqual(jd.missingMandatoryDocuments([]), all);
  assert.deepEqual(jd.missingMandatoryDocuments([{ label: 'Special Needs Card' }, { label: 'Star Number Discount Approval' }]), all, 'the optional two do not count');
  assert.deepEqual(jd.missingMandatoryDocuments([{ label: 'Trade License' }, ...all.map((label) => ({ label }))]), [], 'the receipt: Continue is enabled');
  assert.match(read('src/capabilities/CafSignature/step.tsx'), /missingMandatoryDocuments\(/, 'the CAF step gates Continue on them');
});

test('a conditionally required type is still asked for as its own card; unknown conditions never hold', () => {
  const waived = { product: 'postpaid', contact: { idType: 'QID' }, numberWaiver: 2000 };
  assert.deepEqual(jd.requiredDocumentsFor({ ...base, values: waived }).map((r) => r.label), ['Star Number Discount Approval']);
  assert.equal(jd.documentTypeApplies({ id: 'x', label: 'X', appliesTo: { conditions: ['no-such-condition'] } }, { values: {} }), false);
  assert.equal(jd.documentTypeApplies({ id: 'x', label: 'X', appliesTo: { personas: ['ROLE-99'] } }, { values: {}, personaId: 'ROLE-01' }), false);
  assert.equal(jd.documentTypeApplies({ id: 'x', label: 'X', appliesTo: { personas: ['ROLE-01'] } }, { values: {}, personaId: 'ROLE-01' }), true);
});

test('a VAT registration number on a new billing account needs its document before Continue, and the upload is kept under the requirement Additional Documents matches', () => {
  const req = jd.requirementForCondition('vat-registration');
  assert.ok(req, 'a document type is required when a VAT number is entered');
  const needed = (vat) => jd.requiredDocumentsFor({ values: { billingAccount: { creatingNew: true, newAccount: { vatRegistrationNumber: vat } } }, journey: 'new-connection', personaId: 'ROLE-01' }).map((r) => r.id);
  assert.ok(needed('300123456700003').includes(req.id));
  assert.ok(!needed('   ').includes(req.id), 'a blank number asks for nothing');
  const step = read('src/capabilities/Billing/step.tsx');
  assert.match(step, /vatRegistrationNumber\?\.trim\(\)\) \{\s*const req = requirementForCondition\('vat-registration'\)/, 'Continue is gated on the document');
  assert.match(step, /requirementId === vatRequirement\.id/);
  assert.match(read('src/components/patterns/BillingAccountStep.tsx'), /\{onVatDocumentChange && \(\s*<SupportingDocumentField label="VAT Document"/, 'the upload is always shown, marked required');
});

// ---- VAT: a new billing account's detail only ----------------------------------------------------------------------------
const vatValues = (billingAccount) => ({ billingAccount });
const requiredIds = (billingAccount) => jd.requiredDocumentsFor({ values: vatValues(billingAccount), journey: 'new-connection' }).map((r) => r.id);

test('the VAT document is required only for a NEW billing account with a VAT registration number: matrix over every account mode', () => {
  const draft = { vatRegistrationNumber: 'VAT-1' };
  const table = [
    ['no billing account yet', undefined, []],
    ['existing profile selected', { selectedProfileId: 'BILL-1', creatingNew: false }, []],
    ['existing profile selected, stale VAT left in the draft', { selectedProfileId: 'BILL-1', creatingNew: false, newAccount: draft }, []],
    ['existing profile selected while still flagged creating (contradictory)', { selectedProfileId: 'BILL-1', creatingNew: true, newAccount: draft }, []],
    ['existing profile being edited', { editingProfileId: 'BILL-1', creatingNew: true, newAccount: draft }, []],
    ['new account, no VAT', { creatingNew: true, newAccount: {} }, []],
    ['new account, blank VAT number', { creatingNew: true, newAccount: { vatRegistrationNumber: '  ' } }, []],
    ['new account, VAT number entered', { creatingNew: true, newAccount: draft }, ['vat-document']],
  ];
  for (const [name, billing, expected] of table) assert.deepEqual(requiredIds(billing), expected, name);
});

test('a VAT document left over from a draft is not carried on an order that no longer has VAT; the other documents are untouched', () => {
  const vat = { requirementId: 'vat-document', label: 'VAT Document', fileName: 'v.pdf' };
  const other = { requirementId: 'x', label: 'Other', fileName: 'o.pdf' };
  const kept = (billing) => jd.withoutInapplicableVatDocument(vatValues(billing), [vat, other]).map((d) => d.label);
  assert.deepEqual(kept({ selectedProfileId: 'BILL-1', creatingNew: false, newAccount: { vatRegistrationNumber: 'VAT-1' } }), ['Other']);
  assert.deepEqual(kept({ creatingNew: true, newAccount: { vatRegistrationNumber: 'VAT-1' } }), ['VAT Document', 'Other'], 'a new account with VAT keeps it');
  assert.deepEqual(kept(undefined), ['Other']);
});

test('Additional Documents removes only what was attached in its own section; a document collected earlier in the journey is listed but has no Remove', async () => {
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AdditionalDocumentsUpload } = await load('/src/components/domain/AdditionalDocumentsUpload.tsx');
  const earlier = { id: 'e1', label: 'Star Number Discount Approval', fileName: 'earlier.jpg', sizeBytes: 10, requirementId: 'star-number-discount-approval' };
  const here = { id: 'h1', label: 'Employer Letter', fileName: 'here.pdf', sizeBytes: 10, origin: 'additional-documents' };
  const out = (documents) => renderToStaticMarkup(React.createElement(AdditionalDocumentsUpload, { documents, onChange() {}, labelOptions: ['Employer Letter', 'Other'] }));
  // The document is listed twice (Uploaded Documents and the collapsed journey list): count each file once.
  const removes = (html) => [...new Set([...html.matchAll(/aria-label="Remove ([^"]+)"/g)].map((m) => m[1]))];
  assert.deepEqual(removes(out([earlier])), [], 'an earlier document is not removable');
  assert.deepEqual(removes(out([here])), ['here.pdf'], 'one attached here is');
  assert.deepEqual(removes(out([earlier, here])), ['here.pdf'], 'a mix: only the one attached here');
  assert.match(out([earlier, here]), /earlier\.jpg/, 'the earlier document is still listed');
});

// Opening a document shows the WHOLE document: every image it has (front and back, every page) on one page of the viewer drawer, on every device.
test('the document viewer opens every image of the document clicked, one under another, not just the side clicked', () => {
  const src = fs.readFileSync('src/components/domain/AdditionalDocumentsUpload.tsx', 'utf8');
  // The viewer holds a list of pages, and renders each of them.
  assert.match(src, /useState<\{ title: string; pages: \{ label\?: string; dataUrl\?: string; scan\?: JourneyDocument\['scan'\] \}\[\] \}/);
  assert.match(src, /viewing\.pages\.map\(\(page, i\)/);
  // A journey document opens with all of its group's images (each side), whichever side was clicked.
  assert.match(src, /const pages = g\.items\.map\(\(d\) => \(\{ label: [^]*?\.\.\.imageOf\(d\) \}\)\)\.filter/);
  assert.match(src, /onClick=\{\(\) => setViewing\(\{ title: docTitle, pages \}\)\}/);
  // Nothing opens just one side any more.
  assert.doesNotMatch(src, /setViewing\(\{ title, dataUrl/);
  // One viewer, a drawer, on every device: no device branch around it.
  assert.doesNotMatch(src.slice(src.indexOf('<Drawer open={Boolean(viewing)}')), /detectDeviceType\(\)/);
});
