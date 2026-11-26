import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

// New Home Connection: additional Wi-Fi Extenders - the plan's free allowance, the chargeable units beyond it, never added unasked.
let ex;
before(async () => {
  await boot();
  ex = await load('/src/engines/homeExtenders.ts');
});
after(close);

const terms = (freeAllowance) => ({ freeAllowance, monthlyQAR: 25, oneTimeQAR: 250 });

test('Premium (4 free): 3 and 4 are all Free, 5 is 4 Free + 1 Chargeable, 6 is 4 Free + 2 Chargeable', () => {
  const expected = { 0: [0, 0], 3: [3, 0], 4: [4, 0], 5: [4, 1], 6: [4, 2] };
  for (const [q, [free, chargeable]] of Object.entries(expected)) assert.deepEqual(ex.splitExtenders(Number(q), 4), { free, chargeable }, `${q} of 4`);
});

test('Basic (2 free): 1 and 2 are Free, 3 is 2 Free + 1 Chargeable; a plan that states none includes none; no maximum', () => {
  assert.deepEqual(ex.splitExtenders(2, 2), { free: 2, chargeable: 0 });
  assert.deepEqual(ex.splitExtenders(3, 2), { free: 2, chargeable: 1 });
  assert.deepEqual(ex.splitExtenders(3, undefined), { free: 0, chargeable: 3 });
  assert.deepEqual(ex.splitExtenders(50, 2), { free: 2, chargeable: 48 }, 'no cap');
  assert.deepEqual(ex.splitExtenders(-3, 2), { free: 0, chargeable: 0 });
});

test('only the chargeable units are charged: QAR 25 a month each, or QAR 250 once each', () => {
  const sel = (quantity, billing) => ({ quantity, billing, terms: terms(4) });
  assert.equal(ex.extenderCharge(sel(4)).totalQAR, 0);
  assert.equal(ex.extenderCharge(sel(6)).totalQAR, 50);
  assert.equal(ex.extenderCharge(sel(6)).billing, 'monthly');
  assert.equal(ex.extenderCharge(sel(6, 'one-time')).totalQAR, 500);
  assert.equal(ex.extenderCharge({ quantity: 6, billing: 'one-time', terms: { freeAllowance: 4, monthlyQAR: 25 } }).billing, 'monthly', 'no one-time price offered: recurring');
});

test('checkout lines: the free units at no charge and the chargeable ones, each named with their quantity', () => {
  const lines = (q, b) => ex.extenderCheckoutItems({ quantity: q, billing: b, terms: terms(4) });
  assert.deepEqual(lines(3).map((l) => [l.name, l.amountQAR]), [['Wi-Fi Extender x 3 (Included)', 0]]);
  assert.deepEqual(lines(6).map((l) => [l.name, l.amountQAR, l.billingFrequency]), [['Wi-Fi Extender x 4 (Included)', 0, 'monthly'], ['Wi-Fi Extender x 2', 50, 'monthly']]);
  assert.deepEqual(lines(5, 'one-time').map((l) => [l.amountQAR, l.billingFrequency]), [[0, 'monthly'], [250, 'one-time']]);
  assert.deepEqual(lines(0), []);
  assert.equal(ex.extendersSummaryText({ quantity: 6, terms: terms(4) }), '6 (4 free, 2 chargeable)');
  assert.equal(ex.extendersSummaryText({ quantity: 3, terms: terms(4) }), '3 (3 free)');
  assert.equal(ex.extendersSummaryText({ quantity: 0, terms: terms(4) }), undefined);
});

test('every home plan states its free Extenders: 4 on the Premium tier, 2 on the Basic tier; and each has an Extender add-on flagged as such', () => {
  const products = JSON.parse(fs.readFileSync('public/mock-data/products.json', 'utf8'));
  const addons = JSON.parse(fs.readFileSync('public/mock-data/addons-discounts.json', 'utf8'));
  const home = products.filter((p) => p.type === 'Fixed Line Plan' || p.type === 'FWA 5G Home Plan');
  assert.ok(home.length >= 25);
  for (const p of home) {
    assert.ok([2, 4].includes(p.freeExtenders), `${p.productId} ${p.name}`);
    // A plan with a home add-ons set (Mesh, Speed Booster, Voice, IPTV) has its Extender add-on.
    if (addons.some((a) => a.planId === p.productId && a.addonCategory === 'Mesh')) assert.ok(addons.some((a) => a.extender === true && a.planId === p.productId && a.billingOptions?.length === 2), `${p.productId}: an Extender add-on`);
  }
  const byName = (n) => home.find((p) => p.name === n).freeExtenders;
  assert.equal(byName('GigaHome Fiber Premium 500'), 4);
  assert.equal(byName('GigaHome Fiber Basic 100'), 2);
});

test('the Extenders open at the plan\'s free allowance and the card reads "N Free Wi-Fi Extenders"', () => {
  const card = fs.readFileSync('src/capabilities/AddonsSelection/HomeExtendersCard.tsx', 'utf8');
  assert.match(card, /if \(!selection && included > 0\) onChange\(\{ quantity: included, terms \}\)/);
  // The card is "N Free Wi-Fi Extenders": the plan's allowance, with no quantity to change.
  assert.match(card, /\$\{included\} Free Wi-Fi \$\{included === 1 \? 'Extender' : 'Extenders'\}/);
  assert.ok(!/Quantity Requested/.test(card), 'no quantity row');
});

test('nothing is added for the agent and the Extender is not a list card; the plan change clears the choice; Postpaid and Prepaid are untouched', () => {
  const step = fs.readFileSync('src/capabilities/AddonsSelection/HomeAddonsStep.tsx', 'utf8');
  assert.match(step, /hide: \(a\) => a\.extender === true/);
  assert.match(step, /freeAllowance: plan\?\.freeExtenders \?\? 0/);
  assert.match(fs.readFileSync('src/capabilities/PlanSelection/step.tsx', 'utf8'), /setValue\('extenders', undefined\)/);
  for (const f of ['src/modules/new-connection/postpaidSteps.tsx', 'src/modules/mobile-prepaid/screens/prepaidSteps.tsx']) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /extenders/i, f);
});
