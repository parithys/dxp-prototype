// A typed Passport's visa is MOI's: fetched from the registry's record for the number, only for the person typed, never invented or typed in.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

let lookup;
before(async () => {
  await boot();
  ({ passportVisaFromMoi: lookup } = await load('/src/components/patterns/passportVisaLookup.ts'));
});
after(close);

const read = (f) => JSON.parse(fs.readFileSync(`public/mock-data/${f}.json`, 'utf8'));
const sources = () => ({ docs: read('identity-documents'), customers: read('customers'), nas: read('nas-records') });

test('typed Passport: the registry-only person (NAS) typed as the registry holds them gets MOI\'s visa', () => {
  const r = lookup('PH7104552', { name: 'Maria Clara Santos Reyes', dob: '09/05/1991', nationality: 'Filipino' }, sources());
  assert.equal(r.known, true);
  assert.deepEqual(r.visa, { visaNumber: 'VQ-2026-0071041', visaType: 'Work Visa', expiryDate: '2028-09-30' });
  assert.equal(r.mismatch, undefined);
  // The number is compared without spaces, dashes or case.
  assert.ok(lookup('ph 7104-552', { name: 'maria clara santos reyes', dob: '1991-05-09', nationality: 'filipino' }, sources()).visa);
});

test('typed Passport: a different person typed under a number the registry holds is refused, and no visa is taken', () => {
  for (const wrong of [{ name: 'Someone Else', dob: '09/05/1991', nationality: 'Filipino' }, { name: 'Maria Clara Santos Reyes', dob: '10/05/1991', nationality: 'Filipino' }, { name: 'Maria Clara Santos Reyes', dob: '09/05/1991', nationality: 'Indian' }]) {
    const r = lookup('PH7104552', wrong, sources());
    assert.equal(r.visa, undefined);
    assert.ok(r.mismatch?.some((a) => a.result === 'mismatch'));
  }
});

test('typed Passport: a number MOI does not know returns no visa (nothing invented); the holder of a customer Passport is read from their customer record', () => {
  const none = lookup('ZZ0000000', { name: 'Omar Passporttest', dob: '02/02/1986', nationality: 'Egyptian' }, sources());
  assert.deepEqual([none.known, none.visa, none.mismatch], [false, undefined, undefined]);
  const s = sources();
  const doc = s.docs.find((d) => d.documentType === 'Passport' && d.visa);
  const owner = s.customers.find((c) => c.customerId === doc.customerId);
  const same = lookup(doc.documentNumber, { name: owner.name, dob: owner.dob, nationality: owner.nationality }, s);
  assert.deepEqual([same.known, same.visa?.visaNumber], [true, doc.visa.visaNumber]);
});

test('typed Passport: an incomplete visa is not kept, and an expired one is returned as MOI has it (the eligibility check stops the journey)', async () => {
  const s = sources();
  s.nas = [...s.nas, { documentType: 'Passport', documentNumber: 'INC1', name: 'A B', dob: '1990-01-01', nationality: 'Indian', visa: { visaNumber: 'V1' } }];
  assert.equal(lookup('INC1', { name: 'A B', dob: '01/01/1990', nationality: 'Indian' }, s).visa, undefined);
  const expired = lookup('N7105336', { name: 'Arjun Prakash Nambiar', dob: '14/02/1989', nationality: 'Indian' }, sources());
  assert.equal(expired.visa.expiryDate, '2026-03-31');
  const { isVisaValid } = await load('/src/data/passportVisa.ts');
  assert.equal(isVisaValid(expired.visa, new Date('2026-11-10')), false);
});

test('a typed Passport customer: the visa MOI returned is kept on the customer and on the identity document the eligibility check reads', async () => {
  const m = await load('/src/capabilities/CustomerIdentification/newCustomerRecords.ts');
  const visa = { visaNumber: 'VQ-2026-0071041', visaType: 'Work Visa', expiryDate: '2028-09-30' };
  const contact = { idType: 'Passport', idNumber: 'PH7104552', moiResult: { name: 'Maria Clara Santos Reyes', firstName: 'Maria', lastName: 'Reyes', dob: '1991-05-09', nationality: 'Filipino', expiryDate: '2031-08-31', isNewCustomer: true, createdByAgent: true, visa } };
  const r = m.buildNewCustomerRecords('CUST-123456', contact, undefined);
  assert.deepEqual(r.document.visa, visa);
  assert.deepEqual(r.customer.passportVisa, visa);
  const qid = m.buildNewCustomerRecords('CUST-123457', { ...contact, idType: 'QID', moiResult: { ...contact.moiResult, visa } }, undefined);
  assert.equal(qid.document.visa, undefined, 'only a Passport carries a visa');
});
