import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, load, close } from './harness.mjs';

// New Home Connection started from Check RFS: what a result puts in the draft, and which pages the journey then asks. Expectations are written out per result (what each status IS),
// not derived from the code.
// The step modules touch window at import time; the harness window is a bare object.
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
let rfs, steps, data;
before(async () => {
  await boot();
  await import('dxp-ui');
  rfs = await load('/src/modules/new-connection/rfsStart.ts');
  steps = await load('/src/modules/new-connection/connectionSteps.tsx');
  data = await load('/src/data/reference/serviceAvailabilityData.ts');
});
after(close);

const address = { zone: '55', streetNo: '830', buildingNo: '12', aptFlatUnit: '101', city: 'Al Waab' };
// The draft's address carries the check's `city` as its Area.
const draftAddress = { zone: '55', streetNo: '830', buildingNo: '12', aptFlatUnit: '101', area: 'Al Waab' };
const handOff = (service, status, extra = {}) => ({ service, status, buildingName: 'Al Waab Residence Tower', address, ...extra });

test('a fibre result names Fibre on the Fiber service with the RFS verdict already in; the address is taken as given', () => {
  for (const status of ['RFS_UNLIMITED', 'RFS_LIMITED']) {
    const v = rfs.rfsDraftValues(handOff('fibre', status));
    assert.equal(v.product, 'fixed-line');
    assert.equal(v.homeProduct, 'fibre');
    assert.deepEqual(v.installation, { serviceType: 'fiber', rfs: 'rfs' });
    assert.deepEqual(v.address, draftAddress);
    assert.equal(v.rfsCheck.status, status);
  }
});

test('an FWA result names FWA and its Indoor / Outdoor type; a location that offers both takes the agent\'s choice, and with none the type stays unknown', () => {
  const type = (status, fwaType) => rfs.rfsDraftValues(handOff('fwa', status, { fwaType })).installation.serviceType;
  assert.equal(type('FWA_INDOOR'), 'fwa-indoor');
  assert.equal(type('FWA_OUTDOOR'), 'fwa-outdoor');
  assert.equal(type('FWA_BOTH', 'Indoor'), 'fwa-indoor');
  assert.equal(type('FWA_BOTH', 'Outdoor'), 'fwa-outdoor');
  assert.equal(type('FWA_BOTH', undefined), undefined, 'never assumed');
  assert.equal(rfs.rfsDraftValues(handOff('fwa', 'FWA_INDOOR')).homeProduct, 'fwa');
});

test('the offers that fit a result: fibre the fixed-line ones, FWA the FWA ones', () => {
  assert.equal(rfs.offerJourneyOfRfs('fibre'), 'new-fixed-line');
  assert.equal(rfs.offerJourneyOfRfs('fwa'), 'new-fwa');
  for (const [key, st] of Object.entries(data.AVAILABILITY_STATUS)) {
    // Only a location Check RFS sells fibre or FWA at starts a connection, and the proceed action says which.
    assert.equal(st.proceed === 'fibre' || st.proceed === 'fwa', st.sellable, key);
  }
});

test('the journey asks neither the Address nor the product cards once Check RFS ran or a New Home offer was sent there', () => {
  assert.equal(rfs.rfsStarted({}), false);
  assert.equal(rfs.rfsStarted({ rfsCheck: { service: 'fibre' } }), true);
  assert.equal(rfs.rfsStarted({ offerCarried: true }), true, 'true the moment the offer is chosen, before the result arrives');
  const list = steps.buildConnectionSteps({ wizardId: 'w', journey: 'home', flow: 'new', products: [], customerBenefits: undefined, existingCustomerId: undefined, applyCrossSales() {}, navigate() {}, createRecord: async () => {}, guardedContactChange() {}, device: 'web' });
  const active = (values) => list.filter((s) => !s.skip?.(values)).map((s) => s.key);
  const plain = active({ product: 'fixed-line' });
  assert.ok(plain.includes('address') && plain.includes('productSelection') && !plain.includes('homeOffers'), plain.join());
  const fromRfs = active({ product: 'fixed-line', rfsCheck: { service: 'fibre' } });
  assert.ok(!fromRfs.includes('address') && !fromRfs.includes('productSelection') && fromRfs.includes('homeOffers'), fromRfs.join());
  assert.ok(fromRfs.indexOf('contact') < fromRfs.indexOf('homeOffers') && fromRfs.indexOf('homeOffers') < fromRfs.indexOf('plan'), 'Contact, then Recommended Offers, then Plan: ' + fromRfs.join());
  const carried = active({ product: 'fixed-line', offerCarried: true });
  assert.ok(!carried.includes('address') && carried.includes('homeOffers'));
});

test('Check RFS passes the result as start values and, from New Connection, the identity and the step to open at', async () => {
  const fs = await import('node:fs');
  const sa = fs.readFileSync('src/modules/check-rfs/ServiceAvailability.tsx', 'utf8');
  assert.match(sa, /startValues: \{ \.\.\.homeStart\?\.values, \.\.\.rfsDraftValues\(\{ \.\.\.handOff, activation: mode \}\) \}/);
  assert.match(sa, /startProgressTo: homeStart\.progressTo/);
  const choice = fs.readFileSync('src/modules/new-connection/steps/productChoice.ts', 'utf8');
  assert.match(choice, /homeStart: \{[\s\S]*contact: values\.contact[\s\S]*offerCarried: true[\s\S]*\.\.\.\(offer && crossSales[\s\S]*progressTo:/, 'Recommended Offers was seen in New Connection: the home journey does not show it again, with or without an offer chosen');
  assert.match(fs.readFileSync('src/components/patterns/wizard/useJourneyStartResume.ts', 'utf8'), /progressTo: nav\.startProgressTo/);
});
