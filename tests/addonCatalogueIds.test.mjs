import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The add-ons / discounts catalogue is keyed by addonDiscountId (a React key on the Add-ons page, the id an order records): two records must never share one.
test('every add-on / discount record has its own addonDiscountId', () => {
  const rows = JSON.parse(fs.readFileSync('public/mock-data/addons-discounts.json', 'utf8'));
  const seen = new Map();
  const dups = [];
  for (const r of rows) {
    if (seen.has(r.addonDiscountId)) dups.push(`${r.addonDiscountId}: ${seen.get(r.addonDiscountId)} / ${r.name} (${r.planId})`);
    else seen.set(r.addonDiscountId, `${r.name} (${r.planId})`);
  }
  assert.deepEqual(dups, []);
});
