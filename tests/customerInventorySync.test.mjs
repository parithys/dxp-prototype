// The customer inventory workbook and the app's mock data are one contract: every customer, and what the sheet records about them (lines, blacklist, risk
// class, employer, identity documents, unpaid bills and payment due), is on both sides, and nothing is on one side only. See reference/scripts/
// verify_customer_inventory_sync.py. Needs python3 with openpyxl; where that is missing the tests are skipped (the check can then be run by hand).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const python = spawnSync('python3', ['-c', 'import openpyxl'], { encoding: 'utf8' }).status === 0;
const run = (args, env = {}) => spawnSync('python3', args, { encoding: 'utf8', env: { ...process.env, ...env } });
const WORKBOOK = 'reference/outputs/02 Customer-Inventory.xlsx';

test('the generator writes a workbook that agrees with the mock data, in both directions', { skip: !python && 'python3 with openpyxl is not available' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-'));
  const out = path.join(dir, '02 Customer-Inventory.xlsx');
  const gen = run(['reference/scripts/build_customer_inventory.py'], { INVENTORY_OUT: out });
  assert.equal(gen.status, 0, gen.stderr || gen.stdout);
  const verify = run(['reference/scripts/verify_customer_inventory_sync.py'], { INVENTORY_XLSX: out });
  assert.equal(verify.status, 0, verify.stdout);
  assert.match(verify.stdout, /In sync\./);
});

test('the workbook kept at reference/outputs agrees with the mock data (regenerate it with npm run sync:customers when this fails)', { skip: !python && 'python3 with openpyxl is not available' }, (t) => {
  if (!fs.existsSync(WORKBOOK)) return t.skip(`${WORKBOOK} is not present (it is not committed)`);
  const verify = run(['reference/scripts/verify_customer_inventory_sync.py']);
  assert.equal(verify.status, 0, `${WORKBOOK} has drifted from public/mock-data. Run: npm run sync:customers\n${verify.stdout}`);
});

test('the sync covers deletion as well as addition: --remove deletes an added customer from the app data, and the verifier checks both directions', () => {
  const gen = fs.readFileSync('reference/scripts/build_customer_inventory.py', 'utf8');
  assert.match(gen, /def remove_customers\(ids\)/);
  assert.match(gen, /only customers added by this script can be removed/, 'an original demo customer is never deleted');
  const ver = fs.readFileSync('reference/scripts/verify_customer_inventory_sync.py', 'utf8');
  assert.match(ver, /in the app \(customers\.json\) but missing from the workbook/);
  assert.match(ver, /on the workbook but not in the app/);
  assert.match(ver, /in the app \(nas-records\.json\) but missing from the workbook/);
  assert.match(ver, /identity document\(s\) in the app but not on the workbook row/);
  for (const field of ['blacklist', 'risk class', 'employer \\(B2B2C\\)', 'unpaid bills', 'payment due \\(QAR\\)']) assert.match(ver, new RegExp(`"${field}"`), field);
});
