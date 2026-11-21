// A secondary contact is linked to someone else's account: the record names the primary customer, the account, the billing profile and the services,
// and Customer 360 shows them. The data, the resolver and the Overview card are checked against an expectation written independently of the code.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
let sc;
before(async () => { await boot(); sc = await load('/src/engines/secondaryContacts.ts'); });
after(close);

const R = (n) => JSON.parse(fs.readFileSync(`public/mock-data/${n}.json`, 'utf8'));
const customers = R('customers');
const accounts = R('accounts');
const profiles = R('billing-profiles');
const assets = R('installed-assets');

// Who each secondary contact is linked to, written out by hand from the scenario (NOT derived from the records).
const EXPECTED = {
  'CUST-3076': [{ primary: 'CUST-3001', account: 'ACC-5601', profile: 'BILL-7101', services: ['+97455520005', '+97455513001'] }],
  'CUST-3077': [{ primary: 'CUST-3401', account: 'ACC-5813', profile: 'BILL-7313', services: ['+97455520144'] }],
  'CUST-3078': [{ primary: 'CUST-3046', account: 'ACC-5893', profile: 'BILL-7393', services: ['+97455520155', '+97455520156'] }],
};

test('every secondary contact in the data is linked exactly as expected, and nobody else is (both directions)', () => {
  const linked = customers.filter((c) => (c.secondaryContactFor ?? []).length > 0).map((c) => c.customerId).sort();
  assert.deepEqual(linked, Object.keys(EXPECTED).sort());
  for (const c of customers) {
    const got = (c.secondaryContactFor ?? []).map((l) => ({ primary: l.primaryCustomerId, account: l.accountId, profile: l.billingProfileId, services: l.serviceIds }));
    assert.deepEqual(got, EXPECTED[c.customerId] ?? [], c.customerId);
  }
});

test('a link is coherent: the account is the primary customer\'s, the billing profile is that account\'s, every service is on that account, and the person is not their own primary', () => {
  for (const c of customers) {
    for (const l of c.secondaryContactFor ?? []) {
      const acc = accounts.find((a) => a.accountId === l.accountId);
      assert.ok(acc, `${c.customerId}: account exists`);
      assert.equal(acc.customerId, l.primaryCustomerId, `${c.customerId}: the account belongs to the primary customer`);
      assert.equal(acc.billingProfileId, l.billingProfileId, `${c.customerId}: the profile is the account's`);
      assert.ok(profiles.some((p) => p.billingProfileId === l.billingProfileId && p.accountId === l.accountId), `${c.customerId}: the profile record exists on the account`);
      assert.ok(l.serviceIds.length > 0 && new Set(l.serviceIds).size === l.serviceIds.length, `${c.customerId}: services listed once each`);
      for (const sid of l.serviceIds) assert.ok(assets.some((i) => i.serviceId === sid && i.accountId === l.accountId), `${c.customerId}: ${sid} is on ${l.accountId}`);
      assert.notEqual(l.primaryCustomerId, c.customerId);
      assert.ok(customers.some((x) => x.customerId === l.primaryCustomerId), `${c.customerId}: the primary customer exists`);
    }
  }
});

test('a partial link stays partial: CUST-3077 is tied to one of the account\'s two numbers and to none of the primary\'s second account; CUST-3078 to one of three profiles', () => {
  const onAccount = (acc) => assets.filter((i) => i.accountId === acc && String(i.serviceId).startsWith('+')).map((i) => i.serviceId);
  assert.ok(onAccount('ACC-5813').length > 1, 'the account has more numbers than the secondary contact is tied to');
  assert.deepEqual(customers.find((c) => c.customerId === 'CUST-3077').secondaryContactFor[0].serviceIds.length, 1);
  assert.equal(accounts.filter((a) => a.customerId === 'CUST-3046').length, 3);
  assert.equal(customers.find((c) => c.customerId === 'CUST-3078').secondaryContactFor.length, 1);
});

test('the resolver adds the primary customer\'s name and the billing profile\'s name, and leaves a missing record unnamed', () => {
  const c3078 = customers.find((c) => c.customerId === 'CUST-3078');
  const [l] = sc.resolveSecondaryContactLinks(c3078, customers, profiles);
  assert.equal(l.primaryName, 'Bilal Ahmed Raza Siddiqui');
  assert.equal(l.billingProfileName, 'Bilal Ahmed Raza Siddiqui - Second Postpaid');
  assert.deepEqual(l.serviceIds, ['+97455520155', '+97455520156']);
  const [orphan] = sc.resolveSecondaryContactLinks({ secondaryContactFor: [{ primaryCustomerId: 'NOPE', accountId: 'A', billingProfileId: 'B', serviceIds: [] }] }, customers, profiles);
  assert.equal(orphan.primaryName, undefined);
  assert.equal(orphan.billingProfileName, undefined);
  assert.deepEqual(sc.resolveSecondaryContactLinks({}, customers, profiles), []);
  assert.deepEqual(sc.secondaryContactLinksOf(undefined), []);
});

test('Customer 360 loads the links and the Overview shows them only for a secondary contact', () => {
  const engine = fs.readFileSync('src/engines/customer360Engine.ts', 'utf8');
  assert.match(engine, /secondaryContactLinks: resolveSecondaryContactLinks\(customer, customers, billingProfiles\)/);
  const overview = fs.readFileSync('src/workspace/customer360/sections/C360Overview.tsx', 'utf8');
  assert.match(overview, /data\.secondaryContactLinks\.length > 0 && \(\s*<Panel icon=\{IC\.users\} title="Secondary Contact Of">/);
  for (const label of ['Primary Contact', 'Account', 'Billing Profile', 'Services']) assert.match(overview, new RegExp(`<Row label="${label}"`));
  assert.match(overview, /to=\{`\/customer\/\$\{l\.primaryCustomerId\}`\}/, 'the primary contact opens their own Customer 360');
});
