import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

// New Home Connection > Number & Devices: the Fixed Line Number pool, the automatic allocation from its Free pool, and the Number Selection profile (no Star numbers).
let model, alloc;
before(async () => {
  await boot();
  model = await load('/src/modules/fixed-line-fibre/fixedActivation/fixedActivationModel.ts');
  alloc = await load('/src/capabilities/NumberSelection/prepaidNumberAllocation.ts');
});
after(close);

const pool = JSON.parse(fs.readFileSync('public/mock-data/fixed-line-numbers.json', 'utf8'));
const personas = JSON.parse(fs.readFileSync('public/config/personas.json', 'utf8'));

test('the Fixed Line Number pool is its own inventory of landline numbers, apart from the mobile numbers', () => {
  const mobile = new Set(JSON.parse(fs.readFileSync('public/mock-data/numbers.json', 'utf8')).map((n) => n.msisdn));
  assert.ok(pool.length >= 40);
  for (const n of pool) {
    assert.match(n.msisdn, /^\+9744\d{7}$/, 'a Qatar landline leads with 4');
    assert.ok(!mobile.has(n.msisdn), `${n.msisdn} is not a mobile number`);
    assert.equal(n.category, 'Free');
    assert.equal(n.priceQAR, 0, 'no Star numbers: every fixed line number is free');
  }
  assert.equal(new Set(pool.map((n) => n.msisdn)).size, pool.length, 'no number twice');
});

test('a held number names the customer it is reserved for, a blocked one the group that blocked it, and each state is present', () => {
  const reserved = pool.filter((n) => n.status === 'Reserved');
  const blocked = pool.filter((n) => n.status === 'BLOCKED');
  assert.ok(reserved.length >= 2 && blocked.length >= 2 && pool.filter((n) => n.status === 'AVAILABLE').length >= 40);
  for (const n of reserved) assert.match(n.reservedForQid, /^\d{14}$/, n.msisdn);
  const groups = new Set(personas.map((p) => p.name));
  for (const n of blocked) assert.ok(groups.has(n.blockedByTeam), `${n.msisdn}: ${n.blockedByTeam} is a persona group`);
});

test('the first allocation is the lowest AVAILABLE Free number; a Reserved or Blocked number is never allocated', () => {
  const first = alloc.autoAllocatedFreeNumber(pool);
  const expected = pool.filter((n) => n.status === 'AVAILABLE').map((n) => n.msisdn).sort()[0];
  assert.equal(first.msisdn, expected);
  assert.equal(alloc.autoAllocatedFreeNumber(pool.filter((n) => n.status !== 'AVAILABLE')), undefined);
});

test('the picker profile reads the Fixed Line Number pool and no role is ever offered the Star tab, lock-in or an entitlement', () => {
  const p = model.FIXED_NUMBER_PICKER;
  assert.equal(p.pool, 'fixed-line-numbers');
  assert.equal(p.lockIn, false);
  assert.equal(p.planEntitlement, false);
  for (const role of personas) {
    const tabs = model.fixedNumberTabsFor(role.id);
    assert.ok(!tabs.includes('Star'), role.id);
    assert.ok(tabs.length > 0 && tabs.every((t) => ['Reserved', 'Free', 'Blocked'].includes(t)), role.id);
  }
  assert.deepEqual(model.fixedNumberTabsFor('ROLE-01'), ['Reserved', 'Free', 'Blocked']);
});

test('a number held for the customer is listed on the Reserved tab and can be chosen there, but is not chosen for the agent when the picker opens', () => {
  assert.equal(model.FIXED_NUMBER_PICKER.heldSelectable, undefined, 'held numbers are selectable');
  assert.ok(pool.some((n) => n.status === 'Reserved' && n.reservedForQid), 'a held number exists to choose');
  const view = fs.readFileSync('src/modules/fixed-line-fibre/fixedActivation/FixedStepViews.tsx', 'utf8');
  assert.doesNotMatch(view, /ReservedForCustomer/, 'nothing clears or refuses a held number');
});

test('the mobile pickers are unchanged: the pool defaults to the mobile numbers and held numbers are still chosen for the agent', () => {
  const picker = fs.readFileSync('src/components/domain/MsisdnPicker.tsx', 'utf8');
  assert.match(picker, /fixedPool \? 'fixed-line-numbers' : 'numbers'/);
  assert.match(picker, /profile\?\.selectHeld === false/);
  const prepaid = fs.readFileSync('src/modules/mobile-prepaid/screens/prepaidSteps.tsx', 'utf8');
  assert.doesNotMatch(prepaid, /fixed-line-numbers|selectHeld/);
  const postpaid = fs.readFileSync('src/modules/new-connection/postpaidSteps.tsx', 'utf8');
  assert.doesNotMatch(postpaid, /fixed-line-numbers|selectHeld/);
  assert.equal(model.FIXED_NUMBER_PICKER.selectHeld, false, 'opening the chooser does not replace the allocated number with a held one');
});
