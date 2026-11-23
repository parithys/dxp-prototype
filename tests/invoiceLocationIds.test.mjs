import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The KID (Kahramaa ID) and VFID (Vodafone ID) are never on an invoice: not in the bill records an invoice is made from, and not in what the invoice export writes.
const FIELDS = ['kid', 'kahramaaId', 'kidLocationId', 'kidId', 'vfid', 'vodafoneId', 'vfId'];

test('no bill record carries a KID or VFID field, or a KID / VFID value', () => {
  const bills = JSON.parse(fs.readFileSync('public/mock-data/bills.json', 'utf8'));
  assert.ok(bills.length > 5);
  for (const b of bills) {
    for (const f of FIELDS) assert.ok(!(f in b), `${b.billId}: ${f}`);
    assert.doesNotMatch(JSON.stringify(b), /KID-\d|[A-Z]{3}-\d{4}-[A-Z]\b/, `${b.billId}: a KID / VFID value`);
  }
});

test('the invoice export drops the location identifiers whatever the bill carries', () => {
  const src = fs.readFileSync('src/workspace/customer360/InvoiceActions.tsx', 'utf8');
  for (const f of FIELDS) assert.ok(src.includes(`'${f}'`), `${f} is excluded`);
  assert.match(src, /downloadCsv\(`invoice-\$\{bill\.billId\}\.csv`, \[\{ \.\.\.withoutLocationIds\(bill\), customerName \}\]\)/);
});

test('the order summary and the CAF rows of a home order carry no KID or VFID', () => {
  for (const f of ['src/components/patterns/checkoutDetailedTables.ts', 'src/components/patterns/checkoutSummaryRows.ts', 'src/modules/fixed-line-fibre/fixedActivation/fixedSteps.tsx']) {
    const rows = fs.readFileSync(f, 'utf8').split('\n').filter((l) => /label: '/.test(l)).join('\n');
    assert.doesNotMatch(rows, /label: '[^']*(KID|VFID|Kahramaa|Vodafone (ID|Premise))/i, f);
  }
});
