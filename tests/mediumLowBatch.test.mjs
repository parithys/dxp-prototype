import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boot, load, close } from './harness.mjs';

globalThis.window ??= globalThis;
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test.before(boot);
test.after(close);

test('A stored address line ignores the "-" placeholder and is undefined when nothing real is left', async () => {
  const { storedAddressLine } = await load('/src/components/patterns/addressFromBilling.ts');
  assert.equal(storedAddressLine({ zone: '-', streetNo: '-', buildingNo: '-' }), undefined);
  assert.equal(storedAddressLine({ zone: '45', streetNo: '-', buildingNo: '7' }), 'Zone 45, Building 7');
  assert.equal(storedAddressLine(undefined), undefined);
});

test('The order records the limits, payment and address, a plan source only for an offer, and one approval reason for order and event', () => {
  const s = read('src/modules/new-connection/submitNewConnectionOrder.ts');
  for (const f of ['billLimitQAR:', 'creditLimitQAR:', 'paymentMethod:', 'address: values.address']) assert.ok(s.includes(f), f);
  assert.match(s, /planSource: crossSales\?\.decision === 'accepted' \|\| values\.selectionSource === 'OFFER'/);
  assert.match(s, /reason: approvalReason \|\|/);
  assert.match(s, /'MADA'/);
  assert.match(s, /'Retiree'/);
});

test('A product switch drops the actual user; Product Selection offers no Switch to Prepaid button; the HRN result is listed with the other checks', () => {
  assert.match(read('src/modules/new-connection/products.ts'), /'homeProduct', 'actualUser'/);
  assert.doesNotMatch(read('src/modules/new-connection/steps/ProductSelection.tsx'), /onSwitchToPrepaid/);
  assert.doesNotMatch(read('src/capabilities/CustomerQualification/step.tsx'), /isUpfrontPaymentRow/, 'the HRN result is listed at Customer Verification');
  assert.doesNotMatch(read('src/capabilities/EligibilityGate/EligibilityGateStep.tsx'), /!isUpfrontPaymentRow\(row\) && \(showRow/, 'the HRN row is listed with the other checks');
});

test('Document Upload: one set of rules for every upload, one capability for the upload components', async () => {
  const { UPLOAD_RULES } = await load('/src/components/domain/documentUploadRules.ts');
  const { uploadFileProblem } = await import('dxp-ui');
  assert.equal(uploadFileProblem({ name: 'id.pdf', size: 1000 }, UPLOAD_RULES.identity), null);
  assert.match(uploadFileProblem({ name: 'id.png', size: 1000 }, UPLOAD_RULES.identity), /only PDF or JPG/);
  assert.match(uploadFileProblem({ name: 'id.jpg', size: 3 * 1024 * 1024 }, UPLOAD_RULES.identity), /limit is 2 MB/);
  assert.match(uploadFileProblem({ name: 'bill.PNG', size: 1000 }, UPLOAD_RULES.supporting), /only PDF or JPG/);
  assert.match(uploadFileProblem({ name: 'bill.pdf', size: 3 * 1024 * 1024 }, UPLOAD_RULES.supporting), /limit is 2 MB/);
  assert.match(uploadFileProblem({ name: 'bill.pdf', size: 0 }, UPLOAD_RULES.supporting), /empty/);
  assert.match(uploadFileProblem({ name: 'noext', size: 5 }, UPLOAD_RULES.supporting), /only PDF or JPG/);
  // no upload component keeps a limit or accept list of its own
  for (const f of ['src/components/domain/AdditionalDocumentsUpload.tsx', 'src/components/domain/CafDocumentUpload.tsx', 'src/components/domain/idUploadModel.ts']) {
    const src = read(f);
    assert.doesNotMatch(src, /\d\s*\*\s*1024\s*\*\s*1024/, `${f} has its own size limit`);
    assert.doesNotMatch(src, /'\.pdf,\.jpg/, `${f} has its own accept list`);
  }
  const barrel = read('src/capabilities/DocumentUpload/index.ts');
  for (const n of ['AdditionalDocumentsUpload', 'CafDocumentUpload', 'UPLOAD_RULES']) assert.ok(barrel.includes(n), n);
});

test('Empty State: pickers and panels use the one library component (its own contract is in dxp-ui-library/tests/emptyState.test.mjs)', () => {
  for (const f of ['src/components/domain/MsisdnPicker.tsx', 'src/capabilities/AddonsSelection/AddonsPicker.tsx', 'src/components/patterns/PostpaidDiscountsPanel.tsx', 'src/workspace/customer360/ServiceList.tsx', 'src/workspace/customer360/Customer360Layout.tsx'])
    assert.match(read(f), /<EmptyState\b/, `${f} draws its own empty state`);
  assert.match(read('src/capabilities/DocumentUpload/index.ts'), /UPLOAD_RULES/);
  assert.match(read('src/capabilities/EmptyState/index.ts'), /EmptyState/);
});

test('the SIM step names approval or submission for the eSIM QR code by context, and a serial that is in stock is reported valid at once', async () => {
  const { expectsApproval } = await load('/src/modules/new-connection/approvalRouting.ts');
  const contact = { idNumber: '1', moiResult: { name: 'A' } };
  const clean = { checks: [], hardStop: false, softStop: false };
  assert.equal(expectsApproval({ contact, eligibility: clean }), false);
  assert.equal(expectsApproval({ contact, eligibility: { ...clean, requiresHrnAdvance: true } }), true, 'HRN advance routes the order');
  assert.equal(expectsApproval({ contact, eligibility: clean, numberWaiver: 2000 }), true, 'a Waive Off routes the order');
  assert.equal(expectsApproval({ contact: { ...contact, manualEntry: true }, eligibility: clean }), true);
  assert.equal(expectsApproval({}), false);
  const sim = read('src/components/domain/SimTypeStep.tsx');
  assert.match(sim, /will be generated only after successful payment and order \{approvalRequired \? 'approval' : 'submission'\}/);
  assert.match(read('src/modules/new-connection/postpaidSteps.tsx'), /approvalRequired: expectsApproval/);
  assert.match(read('src/components/domain/SimSerialScanner.tsx'), /onChange\(value, true, r\.details\)/, 'the read-back tells the journey the serial is valid');
});

test('the selected number is shown without the +974 country code in the Summary and at Checkout', async () => {
  const { numberSummary } = await load('/src/capabilities/NumberSelection/summary.ts');
  const row = numberSummary().find((r) => r.key === 'msisdn');
  assert.equal(row.value({ msisdn: '+97431552654' }), '31552654');
  assert.equal(row.value({ msisdn: '+974 3155 2654' }), '31552654');
  assert.equal(row.value({ prePaired: true }), 'Pre-Paired SIM');
  assert.equal(row.value({}), undefined);
  for (const f of ['src/components/patterns/checkoutSummaryRows.ts', 'src/components/patterns/checkoutDetailedTables.ts']) assert.match(read(f), /toLocalMsisdn\(msisdn\)/, f);
});

test('the Work Number is shown without +974 in the Summary, the actual user and Checkout', async () => {
  const q = await load('/src/capabilities/CustomerQualification/summary.ts');
  const row = (q.customerQualificationSummary ?? Object.values(q).find((v) => Array.isArray(v))).find((r) => r.key === 'altPhone');
  assert.equal(row.value({ contact: { altPhone: '+97455667766' } }), '55667766');
  assert.equal(row.value({ contact: { altPhone: '55667766' } }), '55667766');
  assert.equal(row.value({ contact: {} }), undefined);
  for (const f of ['src/components/patterns/wizard/commonSummaries.ts', 'src/capabilities/ActualUser/summary.ts', 'src/capabilities/ActualUser/actualUserModel.ts', 'src/components/patterns/CheckoutDefaultLayout.tsx']) assert.match(read(f), /toLocalMsisdn\(/, f);
});
