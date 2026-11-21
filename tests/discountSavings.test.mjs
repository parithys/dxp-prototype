import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load, close } from './harness.mjs';

after(close);
const read = (f) => JSON.parse(fs.readFileSync(`public/mock-data/${f}.json`, 'utf8'));

// Edit Discount's Estimated Savings: monthly = plan fee x rate; total = monthly x months, only when the catalogue says how long it runs.
test('discountSavings: no discount saves 0; unknown stays unknown; the total is the monthly amount over the stated months', async () => {
  const { discountSavings } = await load('/src/components/patterns/postpaidPlanModel.ts');
  assert.deepEqual(discountSavings(undefined, 115), { totalQar: 0 });
  assert.deepEqual(discountSavings(undefined, undefined), { totalQar: 0 });
  assert.deepEqual(discountSavings({ price: -0.1, durationMonths: 6 }, 115), { monthlyQar: 11.5, months: 6, totalQar: 69 });
  assert.deepEqual(discountSavings({ price: -0.15, durationMonths: 12 }, 115), { monthlyQar: 17.25, months: 12, totalQar: 207 });
  // No duration on record (a Special Discount): the monthly amount only, no invented total.
  assert.deepEqual(discountSavings({ price: -0.25, durationMonths: null }, 400), { monthlyQar: 100, months: undefined, totalQar: undefined });
  assert.deepEqual(discountSavings({ price: -0.25 }, 400).totalQar, undefined);
  // No plan amount: no QAR figure at all.
  assert.deepEqual(discountSavings({ price: -0.1, durationMonths: 6 }, undefined), {});
});

test('discountSavings over every postpaid discount in the catalogue on its own plan: finite, never negative, total = monthly x months only where months are given', async () => {
  const { discountSavings } = await load('/src/components/patterns/postpaidPlanModel.ts');
  const plans = new Map(read('products').map((p) => [p.productId, p]));
  // Edit Discount is a postpaid action: the discounts on a plan with a monthly fee (a prepaid discount is on a starter pack, which has none).
  const discounts = read('addons-discounts').filter((d) => d.category === 'Discount' && Number.isFinite(plans.get(d.planId)?.mrcQAR));
  assert.ok(discounts.length > 100, 'the catalogue has discounts on real plans');
  let withTotal = 0;
  let withoutTotal = 0;
  for (const d of discounts) {
    const s = discountSavings(d, plans.get(d.planId).mrcQAR);
    assert.ok(Number.isFinite(s.monthlyQar) && s.monthlyQar >= 0, d.addonDiscountId);
    if (d.durationMonths > 0) {
      withTotal += 1;
      assert.equal(s.months, d.durationMonths);
      assert.ok(Math.abs(s.totalQar - s.monthlyQar * d.durationMonths) < 0.011, `${d.addonDiscountId}: total is monthly x months`);
    } else {
      withoutTotal += 1;
      assert.equal(s.totalQar, undefined, `${d.addonDiscountId}: no duration, no total`);
    }
  }
  assert.equal(withTotal + withoutTotal, discounts.length, 'conservation: every discount is one or the other');
  assert.ok(withTotal > 0, 'discounts with a stated duration occur in the data (the no-duration case is covered above, with no postpaid example needed)');
});
