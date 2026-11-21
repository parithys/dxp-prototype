import fs from 'node:fs';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { boot, load, close } from './harness.mjs';
import { storeApi } from './storeTesting.mjs';

// GCC ID rules. (1) An ID is recognised as a GCC ID only for a citizen of Bahrain, Kuwait, Oman, Qatar, Saudi Arabia or the UAE; any other citizen's
// is announced as not valid. (2) Mobile Postpaid is not permitted with a GCC ID at all - a Soft Stop, prepaid stays available - and prepaid is never
// affected. Expectations are the rules' own lists, written out here, not read from the code.
let engine, data;
before(async () => {
  await boot();
  engine = await load('/src/engines/eligibilityEngine.ts');
  data = await load('/src/data/gccCitizenship.ts');
});
after(close);

const asOf = new Date('2026-06-01');
const run = (nationality, journeyType, idType = 'GCC ID', extra = {}, expiryDate = '2030-01-01') =>
  engine.evaluateEligibilityChecks(
    {
      customer: { customerId: 'C', idType, nationality, dob: '1990-01-01', blacklisted: false },
      doc: { documentType: idType, expiryDate },
      deals: [], outstandingQar: 0, lineCapReached: false, activeLinesDetail: '', journeyType, ...extra,
    },
    asOf,
  );
const gcc = (checks) => checks.find((c) => c.id === 'gcc-id-postpaid');

const GCC = ['Bahraini', 'Kuwaiti', 'Omani', 'Qatari', 'Saudi', 'Emirati', 'Saudi Arabian', 'Kuwait', 'Qatar', 'United Arab Emirates', ' kuwaiti '];
const NOT_GCC = ['Indian', 'Egyptian', 'Jordanian', 'Yemeni', 'Iraqi', 'British', 'Pakistani', 'Filipino', 'Iranian'];

test('the six GCC citizenships are recognised; everything else, and nothing recorded, is not', () => {
  for (const n of GCC) assert.ok(data.isGccCitizen(n), n);
  for (const n of [...NOT_GCC, '', undefined, 'Gulf']) assert.ok(!data.isGccCitizen(n), String(n));
  assert.deepEqual(data.GCC_CITIZENSHIPS.map((c) => c.country), ['Bahrain', 'Kuwait', 'Oman', 'Qatar', 'Saudi Arabia', 'United Arab Emirates']);
});

test('a GCC ID of a citizen outside the GCC is announced as not valid; a GCC citizen, another ID type and an unknown nationality are not', () => {
  assert.equal(data.GCC_ID_NOT_RECOGNISED_MESSAGE, 'The selected ID is not recognized as a valid GCC ID.');
  for (const n of NOT_GCC) assert.ok(data.isUnrecognisedGccId('GCC ID', n), n);
  for (const n of GCC) assert.ok(!data.isUnrecognisedGccId('GCC ID', n), n);
  assert.ok(!data.isUnrecognisedGccId('GCC ID', undefined), 'unknown is not a mismatch');
  assert.ok(!data.isUnrecognisedGccId('GCC ID', '  '));
  for (const t of ['QID', 'Passport', 'Diplomatic ID', 'Other ID', undefined]) assert.ok(!data.isUnrecognisedGccId(t, 'Indian'), String(t));
});

test('postpaid on a GCC ID is a Soft Stop for every nationality: prepaid only, no Hard Stop, no approval row', () => {
  for (const n of [...GCC, ...NOT_GCC, undefined]) {
    const checks = run(n, 'postpaid');
    const c = gcc(checks);
    assert.equal(c.outcome, 'soft-stop', String(n));
    assert.equal(c.passed, false);
    assert.equal(c.message, 'Postpaid activation is not permitted with a GCC ID. The customer is eligible for Prepaid activation only.');
    assert.ok(!checks.some((x) => x.outcome === 'hard-stop'), 'a Soft Stop, not a Hard Stop');
    assert.ok(!checks.some((x) => x.id === 'id-type-routing'), 'nothing is routed for approval on a blocked journey');
    assert.ok(!checks.some((x) => x.id === 'active-lines'), 'the postpaid line limit is not a question when postpaid is not permitted');
    assert.equal(run(n, 'postpaid', 'GCC ID', { lineCapReached: true, activeLinesDetail: 'cap' }).filter((x) => x.outcome === 'approval-routing').length, 0, 'a reached cap routes nothing');
  }
});

test('prepaid is never blocked by it, and other ID types are unaffected', () => {
  for (const n of [...NOT_GCC, ...GCC]) assert.equal(gcc(run(n, 'prepaid')), undefined, n);
  for (const idType of ['QID', 'Passport', 'Diplomatic ID']) {
    assert.equal(gcc(run('Kuwaiti', 'postpaid', idType)), undefined, idType);
    assert.ok(run('Kuwaiti', 'postpaid', idType).some((x) => x.id === 'active-lines'), `${idType} keeps its line check`);
  }
  assert.ok(run('Kuwaiti', 'prepaid').some((x) => x.id === 'active-lines'), 'prepaid on a GCC ID keeps its line check');
});

test('a hard stop on the same customer still wins: an expired GCC ID stays a Hard Stop', () => {
  const checks = run('Kuwaiti', 'postpaid', 'GCC ID', {}, '2020-01-01');
  assert.ok(engine.hasHardStop(checks));
  assert.equal(gcc(checks).outcome, 'soft-stop');
});

test('the product-agnostic stage does not judge it (the journey is not known yet)', () => {
  assert.equal(gcc(run('Kuwaiti', 'postpaid', 'GCC ID', { deferIdTypeRouting: true })), undefined);
  assert.equal(gcc(run('Kuwaiti', 'postpaid', 'GCC ID', { scope: 'common' })), undefined);
});

test('the stop is for Mobile Postpaid only: a fixed line / FWA connection on a GCC ID is not stopped by it, and prepaid never was', () => {
  assert.equal(gcc(run('Kuwaiti', 'postpaid', 'GCC ID', { connectionType: 'FIXED_FWA' })), undefined);
  assert.equal(gcc(run('Kuwaiti', 'postpaid', 'GCC ID', { connectionType: 'MOBILE_POSTPAID' })).outcome, 'soft-stop');
  assert.equal(gcc(run('Kuwaiti', 'postpaid', 'GCC ID', { connectionType: 'MOBILE_PREPAID' })), undefined, 'a prepaid connection is never stopped');
  assert.equal(gcc(run('Kuwaiti', 'prepaid', 'GCC ID', { connectionType: 'MOBILE_PREPAID' })), undefined);
  assert.ok(run('Kuwaiti', 'postpaid', 'GCC ID', { connectionType: 'FIXED_FWA' }).some((x) => x.id === 'id-type-routing'), 'a fixed line on a GCC ID still routes for approval as an exception ID');
});

test('an ID presented as a GCC ID of a non-GCC citizen shows an error badge with the nationality and the six states', async () => {
  const data = await load('/src/data/gccCitizenship.ts');
  assert.equal(data.GCC_ID_NOT_APPLICABLE_LABEL, 'GCC ID Not Applicable');
  const text = data.gccIdNotApplicableMessage('Indian');
  assert.match(text, /nationality \(Indian\)/);
  assert.match(text, /Bahrain, Kuwait, Oman, Qatar, Saudi Arabia and United Arab Emirates/);
  const step = fs.readFileSync('src/components/patterns/IdLookupStep.tsx', 'utf8');
  // Shown for the unrecognised case only (the same rule as the toast), as the one error panel every ID verification error uses: a business-failure ValidationStatus titled with the label.
  assert.match(step, /isUnrecognisedGccId\(value\.idType, value\.moiResult\?\.nationality\) && \(\s*<ValidationStatus variant="business-failure" title=\{GCC_ID_NOT_APPLICABLE_LABEL\}>/);
});

test('rendered: the Contact step shows the error badge for a non-GCC citizen on a GCC ID, and nothing for a GCC citizen or another ID type', async () => {
  const { wrap } = await storeApi();
  const { IdLookupStep } = await load('/src/components/patterns/IdLookupStep.tsx');
  const render = (idType, nationality) =>
    renderToStaticMarkup(wrap(React.createElement(IdLookupStep, { value: { idType, idNumber: '784199055500107', moiResult: { name: 'Karim El-Sayed', nationality, dob: '14/02/1990' } }, onChange() {}, showMoiDetails: false })));
  const bad = render('GCC ID', 'Egyptian');
  assert.match(bad, /role="alert"/);
  assert.match(bad, /GCC ID Not Applicable/);
  assert.match(bad, /nationality \(Egyptian\)/);
  assert.match(bad, /Bahrain, Kuwait, Oman, Qatar, Saudi Arabia and United Arab Emirates/);
  for (const [t, n] of [['GCC ID', 'Emirati'], ['GCC ID', 'Kuwaiti'], ['QID', 'Egyptian'], ['Passport', 'Egyptian']]) assert.doesNotMatch(render(t, n), /GCC ID Not Applicable/, `${t} / ${n}`);
});
