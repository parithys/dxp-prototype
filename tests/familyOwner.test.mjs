// The Family Owner: Primary Line 1 by default; once Primary Line 2 is added the agent can make Primary Line 2 the owner (and back); later Supplementary / Secondary lines
// are registered with the CURRENT owner's ID only, while Primary Line 2 itself takes whoever holds it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

globalThis.window ??= globalThis;
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};

let fp;
before(async () => {
  await boot();
  fp = await load('/src/engines/familyPackage.ts');
});
after(close);

const read = (f) => JSON.parse(fs.readFileSync(`public/mock-data/${f}.json`, 'utf8'));
const products = read('products');
const CAT = () => fp.lineCatalogueOf(products);
const ln = (role, sequence, customerId, extra = {}) => ({ lineId: `L-${role[0]}${sequence}`, packageId: 'P', customerId, role, sequence, planId: 'PROD-144', orderId: `O-${role[0]}${sequence}`, ...extra });
const ord = (orderId, approvalStatus = 'Approved') => ({ orderId, approvalStatus, status: 'Open' });
const ORDERS = [ord('O-P1'), ord('O-P2'), ord('O-S1')];

test('the owner is Primary Line 1 unless a Primary line carries isFamilyOwner; there is exactly one owner line', () => {
  const lines = [ln('Primary', 1, 'A'), ln('Primary', 2, 'B')];
  assert.equal(fp.familyOwnerLine(lines).lineId, 'L-P1', 'default');
  assert.equal(fp.familyOwnerLine([lines[0], { ...lines[1], isFamilyOwner: true }]).lineId, 'L-P2');
  assert.equal(fp.familyOwnerLine([{ ...lines[0], isFamilyOwner: false }, lines[1]]).lineId, 'L-P1');
  assert.equal(fp.familyOwnerLine([]), undefined);
  // A flag on a line that is not Primary is ignored.
  assert.equal(fp.familyOwnerLine([...lines, ln('Supplementary', 1, 'C', { isFamilyOwner: true })]).lineId, 'L-P1');
});

test('the owner can be changed only once Primary Line 2 is added and both Primary Lines are active', () => {
  const p1 = ln('Primary', 1, 'A');
  const p2 = ln('Primary', 2, 'B');
  assert.equal(fp.canChangeFamilyOwner([p1], ORDERS), false, 'no Primary Line 2');
  assert.equal(fp.canChangeFamilyOwner([p1, p2], [ord('O-P1'), ord('O-P2', 'Pending Approval')]), false, 'Primary Line 2 not yet approved');
  assert.equal(fp.canChangeFamilyOwner([p1, p2], ORDERS), true);
  assert.equal(fp.canChangeFamilyOwner([p1, p2, ln('Supplementary', 1, 'A')], ORDERS), true);
});

test('changing the owner flags the chosen Primary line and clears the other; only a Primary line that is not already the owner can be chosen', () => {
  const lines = [ln('Primary', 1, 'A'), ln('Primary', 2, 'B'), ln('Supplementary', 1, 'A')];
  assert.deepEqual(fp.familyOwnerChange(lines, 'L-P2'), [{ lineId: 'L-P1', isFamilyOwner: false }, { lineId: 'L-P2', isFamilyOwner: true }]);
  assert.equal(fp.familyOwnerChange(lines, 'L-P1'), undefined, 'already the owner');
  assert.equal(fp.familyOwnerChange(lines, 'L-S1'), undefined, 'a Supplementary line cannot be the owner');
  assert.equal(fp.familyOwnerChange(lines, 'nope'), undefined);
  // And back again.
  const swapped = lines.map((l) => ({ ...l, ...(fp.familyOwnerChange(lines, 'L-P2').find((c) => c.lineId === l.lineId) ?? {}) }));
  assert.equal(fp.familyOwnerLine(swapped).lineId, 'L-P2');
  assert.deepEqual(fp.familyOwnerChange(swapped, 'L-P1'), [{ lineId: 'L-P1', isFamilyOwner: true }, { lineId: 'L-P2', isFamilyOwner: false }]);
});

test('a Supplementary or Secondary line needs the current owner\'s ID only: the other Primary holder is refused, and the swap swaps who is accepted', () => {
  const pkg = [ln('Primary', 1, 'A'), ln('Primary', 2, 'B')];
  const base = { packageId: 'P', eligibilityCleared: true, orders: ORDERS, catalogue: CAT(), chosenPlanId: 'PROD-311' };
  const ownerIsP1 = fp.familyOwnerLine(pkg).customerId === 'A';
  const accepts = (lines, holder) => fp.familyAdditionalCheck({ ...base, packageLines: lines, isOwner: fp.familyOwnerLine(lines).customerId === holder });
  assert.equal(ownerIsP1, true);
  assert.equal(accepts(pkg, 'A').ok, true, 'Primary Line 1 is the owner: their ID is accepted');
  const refused = accepts(pkg, 'B');
  assert.deepEqual([refused.ok, refused.kind], [false, 'owner'], "Primary Line 2's holder is not the owner yet");
  const swapped = [{ ...pkg[0], isFamilyOwner: false }, { ...pkg[1], isFamilyOwner: true }];
  assert.equal(accepts(swapped, 'B').ok, true, 'Primary Line 2 is the owner: only their ID is needed');
  assert.equal(accepts(swapped, 'A').kind, 'owner', 'Primary Line 1 no longer needs to visit - and is not the one asked for');
  // The same for a Secondary plan.
  assert.equal(fp.familyAdditionalCheck({ ...base, chosenPlanId: 'PROD-312', packageLines: swapped, isOwner: true }).ok, true);
});

test('Primary Line 2 itself is registered to whoever holds it: a customer who is not the owner can be the holder', () => {
  const justP1 = [ln('Primary', 1, 'A')];
  const base = { packageId: 'P', eligibilityCleared: true, orders: [ord('O-P1')], catalogue: CAT() };
  const asB = fp.familyAdditionalCheck({ ...base, packageLines: justP1, isOwner: false });
  assert.deepEqual([asB.ok, asB.lineLabel], [true, 'Primary Line 2']);
  // An ID that has not cleared eligibility is refused whoever it is; a Primary Line 1 still awaiting approval is a package refusal for a non-owner too.
  assert.equal(fp.familyAdditionalCheck({ ...base, packageLines: justP1, isOwner: false, eligibilityCleared: false }).kind, 'eligibility');
  assert.equal(fp.familyAdditionalCheck({ ...base, packageLines: justP1, isOwner: false, orders: [ord('O-P1', 'Pending Approval')] }).ok, false);
});

test('the package is the whole package for every holder: a customer sees the lines the other Primary holder has', () => {
  const all = [ln('Primary', 1, 'A'), ln('Primary', 2, 'B'), ln('Supplementary', 1, 'A'), { ...ln('Primary', 1, 'Z'), packageId: 'OTHER', lineId: 'L-other' }];
  assert.deepEqual(fp.packageLinesOf(all, 'B').map((l) => l.lineId), ['L-P1', 'L-P2', 'L-S1'], 'B holds only Primary Line 2 and still sees the package');
  assert.deepEqual(fp.packageLinesOf(all, 'Z').map((l) => l.lineId), ['L-other']);
  assert.deepEqual(fp.packageLinesOf(all, 'nobody'), []);
});

test('the journey asks for the owner line\'s holder, and the panel offers the change only on the other Primary line', () => {
  const start = fs.readFileSync('src/modules/new-connection/familyStart.ts', 'utf8');
  assert.match(start, /isOwner: customerLines\.some\(\(l\) => l\.lineId === familyOwnerLine\(packageLines\)\?\.lineId\)/);
  const panel = fs.readFileSync('src/workspace/customer360/sections/FamilyPackagePanel.tsx', 'utf8');
  assert.match(panel, /canChangeOwner && l\.role === 'Primary' && ownerLine\?\.lineId !== l\.lineId/);
  assert.match(panel, /ownerLine\?\.lineId === l\.lineId && <Badge variant="tag-primary">Family Owner<\/Badge>/);
  assert.match(panel, /updateRecord\('family-package-lines', 'lineId'/);
});
