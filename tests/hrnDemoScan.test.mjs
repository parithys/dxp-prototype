// The New Customer journey's demo reader returns an HRN-nationality person. Expectations are written from a table of what each seeded
// registry person IS (nationality -> HRN or not), not from the picker under test, and checked over the whole NAS dataset both ways.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

const data = (n) => JSON.parse(fs.readFileSync(`public/mock-data/${n}.json`, 'utf8'));
let model, hrn;
before(async () => {
  await boot();
  model = await load('/src/components/patterns/idLookupModel.ts');
  hrn = await load('/src/engines/hrnConfiguration.ts');
});
after(close);

const nas = data('nas-records');
const docs = data('identity-documents');
const customers = data('customers');

// Independent of isHrn(): the nationality of each NAS person and whether the business lists it as HRN (hrnConfiguration's table, restated).
const HRN_NATIONALITIES = new Set(['pakistani', 'bangladeshi', 'cambodian', 'myanmar', 'laotian', 'kenyan', 'ugandan', 'swazi']);
const IS_HRN = { 'NAS-7001': false, 'NAS-7002': false, 'NAS-7003': false, 'NAS-7004': false, 'NAS-7005': false, 'NAS-7006': true, 'NAS-7101': false, 'NAS-7102': false, 'NAS-7103': true, 'NAS-7104': false, 'NAS-7105': false, 'NAS-7106': false, 'NAS-7107': false, 'NAS-7108': false, 'NAS-7109': false };

test('every NAS person is classified by the table, and the HRN flag agrees with the business list (false positives and negatives)', () => {
  for (const n of nas) {
    assert.ok(n.nasRecordId in IS_HRN, `${n.nasRecordId} needs a row in the table`);
    assert.equal(hrn.isHrn(n.nationality), IS_HRN[n.nasRecordId], `${n.nasRecordId} (${n.nationality})`);
    assert.equal(HRN_NATIONALITIES.has(n.nationality.toLowerCase()), IS_HRN[n.nasRecordId], `${n.nasRecordId} vs the restated list`);
  }
});

test('the demo reader returns an HRN person for QID, never a non-HRN one, and none for a type with no HRN record', () => {
  const picked = model.pickHrnDemoNas(nas, 'QID', new Date('2026-10-25'));
  assert.equal(picked?.nasRecordId, 'NAS-7006');
  assert.equal(picked.nationality, 'Pakistani');
  for (const t of ['Passport', 'GCC ID']) assert.equal(model.pickHrnDemoNas(nas, t), undefined, t);
  // The HRN-nationality diplomat (NAS-7103, a Diplomatic ID holder) is the only other HRN registry person.
  assert.equal(model.pickHrnDemoNas(nas, 'Diplomatic ID', new Date('2026-10-25'))?.nasRecordId, 'NAS-7103');
  // Conservation: removing the HRN people leaves the reader with nobody (it never falls back to a non-HRN NAS person).
  assert.equal(model.pickHrnDemoNas(nas.filter((n) => !IS_HRN[n.nasRecordId]), 'QID'), undefined);
});

test('an expired HRN record is not offered', () => {
  const expired = nas.map((n) => (IS_HRN[n.nasRecordId] ? { ...n, expiryDate: '2020-01-01' } : n));
  assert.equal(model.pickHrnDemoNas(expired, 'QID', new Date('2026-10-25')), undefined);
});

test('the HRN demo person is a genuine new person: no customer record, no identity document, number unique across NAS', () => {
  const p = nas.find((n) => n.nasRecordId === 'NAS-7006');
  assert.ok(!docs.some((d) => d.documentNumber === p.documentNumber));
  assert.ok(!customers.some((c) => c.name === p.name));
  assert.equal(nas.filter((n) => n.documentNumber === p.documentNumber).length, 1);
});

test('the New Customer journey reads and draws the HRN person; other journeys are unchanged', () => {
  const hook = fs.readFileSync('src/components/patterns/useIdLookup.ts', 'utf8');
  assert.match(hook, /if \(asNewCustomer && !cardCustomerId\) \{[\s\S]*pickDemoNas\(nas, t\)/);
  assert.match(hook, /if \(!asNewCustomer \|\| cardCustomerId\) return;[\s\S]*pickDemoNas\(nas, idType\)/);
});

test('review aid ?demoNas=: the reader returns the registry person asked for, else the HRN default (an unknown number, another type or an expired card change nothing)', () => {
  const NOW = new Date('2026-10-25');
  const khalid = nas.find((n) => n.nasRecordId === 'NAS-7101');
  assert.equal(model.pickDemoNas(nas, 'QID', NOW, khalid.documentNumber)?.nasRecordId, 'NAS-7101');
  assert.equal(model.pickDemoNas(nas, 'QID', NOW, undefined)?.nasRecordId, 'NAS-7006', 'no request: the HRN default');
  assert.equal(model.pickDemoNas(nas, 'QID', NOW, '00000000000')?.nasRecordId, 'NAS-7006', 'not a NAS number: the default');
  assert.equal(model.pickDemoNas(nas, 'Passport', NOW, khalid.documentNumber), undefined, 'another document type: nothing asked for, and no HRN passport either');
  const expired = nas.map((n) => (n.nasRecordId === 'NAS-7101' ? { ...n, expiryDate: '2020-01-01' } : n));
  assert.equal(model.pickDemoNas(expired, 'QID', NOW, khalid.documentNumber)?.nasRecordId, 'NAS-7006', 'an expired card is not offered');
  // Every NAS person can be asked for by number (whole dataset): the picker never returns someone else.
  for (const n of nas.filter((r) => !(r.expiryDate && r.expiryDate < '2026-10-25'))) assert.equal(model.pickDemoNas(nas, n.documentType, NOW, n.documentNumber)?.nasRecordId, n.nasRecordId);
});
