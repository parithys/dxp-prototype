import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

let addonSummaryLabel, includedStbChargeQar, extraStbChargeQar, extraStbCount, iptvOneTimeLines, isIptvComplete, MAX_EXTRA_STBS;
before(async () => {
  await boot();
  ({ addonSummaryLabel } = await load('/src/components/patterns/checkoutSummaryRows.ts'));
  ({ includedStbChargeQar, extraStbChargeQar, extraStbCount, iptvOneTimeLines, isIptvComplete, MAX_EXTRA_STBS } = await load('/src/engines/homeIptv.ts'));
});
after(close);

const bundle = { stb: { included: true, litePriceQAR: 50, premiumPriceQAR: 150 }, extraStbPriceQAR: 199 };

test('the STB that comes with a bundle is charged by its own terms; no box and a bundle without one are free', () => {
  assert.equal(includedStbChargeQar(bundle, { enabled: true, stb: 'premium' }), 150);
  assert.equal(includedStbChargeQar(bundle, { enabled: true, stb: 'lite' }), 50);
  assert.equal(includedStbChargeQar(bundle, { enabled: true, stb: 'none' }), 0);
  assert.equal(includedStbChargeQar({ stb: { included: false, litePriceQAR: 50, premiumPriceQAR: 150 } }, { enabled: true, stb: 'premium' }), 0);
});

test('additional physical STBs are always chargeable, whatever the box choice, and capped', () => {
  for (const stb of ['premium', 'lite', 'none']) assert.equal(extraStbChargeQar(bundle, { enabled: true, stb, extraStbs: 2 }), 398);
  assert.equal(extraStbCount({ enabled: true, extraStbs: 99 }), MAX_EXTRA_STBS);
  assert.equal(extraStbCount({ enabled: true, extraStbs: -3 }), 0);
  assert.equal(extraStbChargeQar(bundle, { enabled: true, extraStbs: 0 }), 0);
});

test('one-time lines: the chargeable box and the additional boxes; nothing when IPTV is off', () => {
  assert.deepEqual(iptvOneTimeLines(bundle, { enabled: true, stb: 'lite', extraStbs: 1 }).map((l) => l.amountQAR), [50, 199]);
  assert.deepEqual(iptvOneTimeLines(bundle, { enabled: true, stb: 'none', extraStbs: 0 }), []);
  assert.deepEqual(iptvOneTimeLines(bundle, { enabled: false, stb: 'lite', extraStbs: 1 }), []);
});

test('IPTV is complete when off, or when it has a bundle, the box choice (if offered) and an answer on additional boxes', () => {
  assert.equal(isIptvComplete(undefined), true);
  assert.equal(isIptvComplete({ enabled: false }), true);
  assert.equal(isIptvComplete({ enabled: true }), false);
  assert.equal(isIptvComplete({ enabled: true, bundleId: 'B', stbOffered: true, extraStbs: 0 }), false);
  assert.equal(isIptvComplete({ enabled: true, bundleId: 'B', stbOffered: true, stb: 'none', extraStbs: 0 }), true);
  assert.equal(isIptvComplete({ enabled: true, bundleId: 'B', stbOffered: false }), false);
  assert.equal(isIptvComplete({ enabled: true, bundleId: 'B', stbOffered: false, extraStbs: 0 }), true);
});

test('every home IPTV bundle record states its STB terms and extra-box price, and shares one exclusive group (one bundle at a time)', () => {
  const rows = JSON.parse(fs.readFileSync('public/mock-data/addons-discounts.json', 'utf8')).filter((a) => a.addonCategory === 'IPTV' && a.planId);
  assert.ok(rows.length > 50);
  for (const r of rows) {
    assert.equal(r.exclusiveGroup, 'home-iptv-bundle', r.addonDiscountId);
    assert.equal(typeof r.stb?.included, 'boolean', r.addonDiscountId);
    assert.ok(r.extraStbPriceQAR > 0, `${r.addonDiscountId}: additional boxes are chargeable`);
  }
  assert.ok(rows.some((r) => r.stb.included && r.stb.premiumPriceQAR === 0), 'a bundle with a free box');
  assert.ok(rows.some((r) => r.stb.included && r.stb.premiumPriceQAR > 0), 'a bundle with a chargeable box');
  assert.ok(rows.some((r) => !r.stb.included), 'a bundle without a box');
});

test('a Triple Play plan has IPTV on without the switch, and a bundle is optional; a Double Play plan must enable it first', () => {
  assert.equal(isIptvComplete({ enabled: true, planIncluded: true }), true);
  assert.equal(isIptvComplete({ enabled: true, planIncluded: true, bundleId: 'B', stbOffered: true, extraStbs: 0 }), false, 'a chosen bundle still needs its box choice');
  assert.equal(isIptvComplete({ enabled: true }), false);
  const step = fs.readFileSync('src/capabilities/AddonsSelection/HomeAddonsStep.tsx', 'utf8');
  assert.match(step, /triple \? undefined : <IptvEnable/);
});

test('the checkout and CAF read a home add-on back with its lock-in; an add-on that states none (postpaid) reads as before', () => {
  assert.equal(addonSummaryLabel({ name: 'Wi-Fi Extender', mrcQAR: 25, lockInMonths: 12 }), 'Wi-Fi Extender (QAR 25/mo, 12-month lock-in)');
  assert.equal(addonSummaryLabel({ name: 'Voicemail', mrcQAR: 0, lockInMonths: 0 }), 'Voicemail (QAR 0/mo, no lock-in)');
  assert.equal(addonSummaryLabel({ name: 'Data Pack', mrcQAR: 30 }), 'Data Pack (QAR 30/mo)');
});
