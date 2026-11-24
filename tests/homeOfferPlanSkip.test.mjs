import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, load, close } from './harness.mjs';

// New Home Connection: a plan chosen from Recommended Offers is not asked for again on Offers & Plans; a New Home picked from Start Another Journey (no offer) still opens it.
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
let build;
before(async () => {
  await boot();
  await import('dxp-ui');
  build = await load('/src/modules/new-connection/connectionSteps.tsx');
});
after(close);

const products = [
  { productId: 'FIB-1', name: 'Fiber Connection', type: 'Fixed Line Plan' },
  { productId: 'FWA-1', name: '5G Home', type: 'FWA 5G Home Plan' },
  { productId: 'POST-1', name: 'Postpaid Essential', type: 'Postpaid Plan' },
];
const planStep = () => build.buildConnectionSteps({ journey: 'home', products, customerBenefits: [], familyLines: [], familyOrders: [] }).find((s) => s.key === 'plan');
const accepted = { decision: 'accepted', offerId: 'O-1' };
const base = { product: 'fixed-line', homeProduct: 'fibre', creditCheckPass: true };

test('an accepted offer whose plan is one of the home plans skips Offers & Plans', () => {
  assert.equal(planStep().skip({ ...base, crossSales: accepted, productId: 'FIB-1' }), true);
  assert.equal(planStep().skip({ ...base, homeProduct: 'fwa', crossSales: accepted, productId: 'FWA-1' }), true);
});

test('no offer (Start Another Journey), a declined offer, or no plan keeps Offers & Plans', () => {
  assert.equal(planStep().skip({ ...base }), false);
  assert.equal(planStep().skip({ ...base, crossSales: { decision: 'declined' }, productId: 'FIB-1' }), false);
  assert.equal(planStep().skip({ ...base, crossSales: accepted }), false);
});

test('an offer for another service (a postpaid plan, or a fibre plan on an FWA connection) does not settle the plan', () => {
  assert.equal(planStep().skip({ ...base, crossSales: accepted, productId: 'POST-1' }), false);
  assert.equal(planStep().skip({ ...base, homeProduct: 'fwa', crossSales: accepted, productId: 'FIB-1' }), false);
});

test('the page stays until the credit check has passed, so a balance owed is still acknowledged there', () => {
  assert.equal(planStep().skip({ ...base, creditCheckPass: undefined, crossSales: accepted, productId: 'FIB-1' }), false);
  assert.equal(planStep().skip({ ...base, creditCheckPass: false, crossSales: accepted, productId: 'FIB-1' }), false);
});
