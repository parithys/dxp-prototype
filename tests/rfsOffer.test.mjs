// The confirmation page offers New Fiber Activation, in the Ready-for-Service panel (no toast, no button in the actions row), when the order's location is Ready for Service. The location is the address entered in the
// journey, the customer's own on file, or - for a new customer with no record - the National Address the registry holds. Expectations are written from the service-point data.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

let f;
before(async () => {
  await boot();
  f = await load('/src/engines/fibreServiceability.ts');
});
after(close);

const nas = JSON.parse(fs.readFileSync('public/mock-data/nas-records.json', 'utf8'));
const points = JSON.parse(fs.readFileSync('public/mock-data/kid-service-points.json', 'utf8'));
const digits = (s) => (String(s ?? '').match(/\d+/g) ?? []).pop();

test('a new customer\'s National Address decides the location when nothing else does: RFS where a service point there is RFS, else not-RFS or unknown, over the whole registry', async () => {
  for (const n of nas) {
    const a = n.nationalAddress;
    const here = points.filter((p) => p.zone === a.zone && digits(p.street) === a.streetNo && digits(p.building) === a.buildingNo);
    const expected = here.length === 0 ? 'unknown' : here.some((p) => p.rfsStatus === 'RFS') ? 'rfs' : 'not-rfs';
    assert.equal(await f.resolveLocationServiceability(undefined, undefined, a), expected, n.nasRecordId);
  }
  assert.equal(await f.resolveLocationServiceability(undefined, undefined, nas.find((n) => n.nasRecordId === 'NAS-7101').nationalAddress), 'rfs', 'the serviceable test customer');
});

test('an entered address that identifies a service point wins over the National Address; a placeholder address falls through to it', async () => {
  const rfs = nas.find((n) => n.nasRecordId === 'NAS-7101').nationalAddress;
  const notRfs = { zone: '55', streetNo: '12', buildingNo: '34', aptFlatUnit: 'Flat 5' };
  assert.equal(await f.resolveLocationServiceability(undefined, notRfs, rfs), 'not-rfs', 'the entered unit is judged, not the registry address');
  assert.equal(await f.resolveLocationServiceability(undefined, { zone: '-', streetNo: '-', buildingNo: '-' }, rfs), 'rfs', 'a placeholder address identifies nothing');
  assert.equal(await f.resolveLocationServiceability(undefined, undefined, undefined), 'unknown', 'nothing known is never assumed');
  // A walk-in journey carries no customer id, but the presented ID may belong to a customer: that customer's address on file judges the location.
  const docs = JSON.parse(fs.readFileSync('public/mock-data/identity-documents.json', 'utf8'));
  const doc = docs.find((d) => d.customerId === 'CUST-1001');
  assert.equal(await f.resolveLocationServiceability(undefined, undefined, undefined, doc.documentNumber), 'rfs', 'CUST-1001 (RFS on file) presenting their own ID');
  assert.equal(await f.resolveLocationServiceability(undefined, undefined, undefined, '00000000000'), 'unknown', 'an ID no customer holds identifies nothing');
});

test('the confirmation page: Start New Fiber sits in the Ready-for-Service panel beside the RFS tag\'s old place, the tag is under the text, and there is no toast', () => {
  const src = fs.readFileSync('src/components/patterns/ActivationCompleteScreen.tsx', 'utf8');
  assert.match(src, /<Button onClick=\{\(\) => navigate\(fibreActivationPath\(order\.customerId\)\)\}>Start New Fiber<\/Button>/);
  assert.doesNotMatch(src, /label: 'Start New Fiber'/, 'not in the actions row');
  // It goes to New Connection's Recommended Offers (never straight into the home journey's Product Selection): the customer's own route when the order belongs to one.
  assert.match(src, /customerId \? `\/mobile\/start-connection\/existing\/\$\{customerId\}` : '\/mobile\/start-connection'/);
  assert.doesNotMatch(src, /new-fixed-line-wizard-contact-step/);
  assert.doesNotMatch(src, /pushToast\('success', 'This customer location is Ready for Service/, 'the panel says it already');
  assert.match(src, /Fibre at the customer's location<\/span>\s+<Badge variant="success">RFS - Eligible for Fibre<\/Badge>/, 'the tag is under the text');
  // Every journey that confirms an order hands the registry address over.
  for (const j of ['new-connection/submitNewConnectionOrder', 'mobile-prepaid/screens/submitPrepaidOrder', 'mnp-fnp-porting/screens/submitMnpOrder', 'pre-to-post-migration/screens/submitPreToPostOrder']) {
    assert.match(fs.readFileSync(`src/modules/${j}.ts`, 'utf8'), /\n\s+nationalAddress: contact\??\.moiResult\?\.nationalAddress,\n\s+\/\/ The presented ID[^\n]*\n\s+idNumber: contact\??\.idNumber,\n\s+(msisdn|\/\/ Every subscription|\/\/ Every)/, j);
  }
});
