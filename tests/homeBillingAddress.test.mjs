import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

// New Home Connection's Billing: after the number (Fibre) / SIM (FWA) and the Installation Address; a new account's Billing Address is the Installation Address unless a persona that may edit gives another.
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
let ba, steps;
before(async () => {
  await boot();
  await import('dxp-ui');
  ba = await load('/src/engines/billingAddress.ts');
  steps = await load('/src/modules/fixed-line-fibre/fixedActivation/fixedSteps.tsx');
});
after(close);

test('Billing follows Number Selection (Fibre) and SIM Selection then the Installation Address (FWA); it is shown, not passed over', () => {
  const list = steps.fixedLineSteps();
  const keys = list.map((s) => s.key);
  assert.ok(keys.indexOf('billingAccount') > keys.indexOf('number'));
  assert.equal(keys.indexOf('billingAccount'), keys.indexOf('installationAddress') + 1, 'after the address it takes by default');
  assert.ok(keys.indexOf('fwaSim') < keys.indexOf('billingAccount'), 'FWA: after SIM Selection');
  assert.ok(keys.indexOf('billingAccount') < keys.indexOf('checkout'));
  assert.equal(list.find((s) => s.key === 'billingAccount').autoPass, undefined, 'the page is shown so the agent can see the Billing Address');
});

test('only Retail Sales may edit the billing address (prototype persona rule)', () => {
  assert.equal(ba.canEditBillingAddress('ROLE-01'), true);
  for (const role of ['ROLE-02', 'ROLE-03', 'ROLE-05', 'ROLE-10', 'ROLE-24', undefined]) assert.equal(ba.canEditBillingAddress(role), false, String(role));
});

test('the Billing Address is the Installation Address while "Same as Installation Address" is ticked (the default), else the address the agent gave', () => {
  const installation = { zone: '55', streetNo: '830', buildingNo: '12', aptFlatUnit: '101', floor: '1', area: 'Al Waab' };
  const given = { zone: '66', streetNo: '840', buildingNo: '24', aptFlatUnit: '4B', city: 'Doha', country: 'Qatar' };
  assert.equal(ba.billingAddressLine(installation), 'Unit 101, Floor 1, Building 12, Street 830, Zone 55, Al Waab');
  assert.equal(ba.newAccountBillingAddress(undefined, installation, given), ba.billingAddressLine(installation), 'ticked by default');
  assert.equal(ba.newAccountBillingAddress(true, installation, given), ba.billingAddressLine(installation));
  assert.equal(ba.newAccountBillingAddress(false, installation, given), 'Unit 4B, Building 24, Street 840, Zone 66, Doha, Qatar');
  assert.equal(ba.billingAddressLine(undefined), undefined);
  assert.equal(ba.billingAddressLine({ zone: ' ', streetNo: '' }), undefined, 'blank parts are left out');
});

test('the home billing options are opt-in: Postpaid and Prepaid still pass Billing over and show the address line they were given', () => {
  const step = fs.readFileSync('src/capabilities/Billing/step.tsx', 'utf8');
  assert.match(step, /opts\.homeBillingAddress \? \{\} : \{ autoPass: \(\) => true \}/);
  const persist = fs.readFileSync('src/capabilities/Billing/persistBillingAccount.ts', 'utf8');
  assert.match(persist, /fresh\.sameAsInstallation === false \? billingAddressLine\(fresh\.billingAddress\) \?\? ctx\.addressLine : ctx\.addressLine/);
  const comp = fs.readFileSync('src/components/patterns/BillingAccountStep.tsx', 'utf8');
  assert.match(comp, /const canEditAddress = !homeBillingAddress \|\| canEditBillingAddress\(personaId\)/, 'every other journey keeps Edit');
  assert.match(comp, /\{canEditAddress && <Button/);
  for (const f of ['src/modules/new-connection/postpaidSteps.tsx', 'src/modules/mobile-prepaid/screens/prepaidSteps.tsx']) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /homeBillingAddress/, f);
});

test('the checkbox is labelled and ticked by default; unticking opens the address fields', () => {
  const view = fs.readFileSync('src/capabilities/Billing/HomeBillingAddress.tsx', 'utf8');
  assert.match(view, /Same as Installation Address/);
  assert.match(view, /const ticked = existing \? same === true : same !== false;/, 'no account on file: ticked; an account on file: unticked');
  assert.match(view, /disabled=\{!existing && !canEdit\}/);
  for (const l of ['Zone Number', 'Street Number', 'Building Number', 'Unit Number / Apartment Number / Flat Number', 'Floor', 'PO Number', 'City', 'Country', 'Address Description']) assert.match(view, new RegExp(`label="${l.replace(/[/]/g, '\\/')}"`), l);
});

test('a home account\'s own billing address (the box unticked) needs its zone, street, building and unit before Continue', () => {
  const sim = steps.fixedLineSteps().find((s) => s.key === 'billingAccount');
  const base = { creatingNew: true, newAccount: { profileName: 'Test - Fixed Line', billCycleDay: 1, primaryContactId: 'CUSTOMER', preferredInvoiceRecipient: 'Primary Contact', sameAsInstallation: false } };
  const values = (billingAddress) => ({ billingAccount: { ...base, newAccount: { ...base.newAccount, billingAddress } } });
  assert.equal(sim.isValid(values({ zone: '66', streetNo: '840', buildingNo: '24', aptFlatUnit: '4B' })), true);
  assert.equal(sim.isValid(values({ zone: '66', streetNo: '840', buildingNo: '24' })), false, 'no unit');
  assert.equal(sim.isValid(values(undefined)), false);
  assert.equal(sim.isValid({ billingAccount: { creatingNew: true, newAccount: { profileName: 'Test - Fixed Line', billCycleDay: 1, primaryContactId: 'CUSTOMER', preferredInvoiceRecipient: 'Primary Contact' } } }), true, 'ticked (the default): the Installation Address');
});

test('a customer with an account on file keeps its Billing Address unless the box is ticked; the Bill Type is the system\'s on a home order', async () => {
  const { persistBillingAccount } = await load('/src/capabilities/Billing/persistBillingAccount.ts');
  const run = async (newAccount) => {
    const log = [];
    await persistBillingAccount({ creatingNew: true, newAccount: { profileName: 'Home', billCycleDay: 1, ...newAccount } }, { createRecord: async (k, r) => void log.push({ k, r }), updateRecord: async () => {}, kind: 'Consumer Fixed Line', customerId: 'C1', creditLimitQar: 1000, nationality: 'Qatari', agentId: 'USR-1', addressLine: 'New Installation, Zone 55' });
    return log.find((x) => x.k === 'billing-profiles').r;
  };
  const existing = 'Villa 3, Street 12, Zone 40, Doha';
  // Untouched or unticked: the existing address stays.
  assert.equal((await run({ existingAddressLine: existing })).billingAddress, existing);
  assert.equal((await run({ existingAddressLine: existing, sameAsInstallation: false })).billingAddress, existing);
  // Ticked: the Installation Address replaces it.
  assert.equal((await run({ existingAddressLine: existing, sameAsInstallation: true })).billingAddress, 'New Installation, Zone 55');
  // No account on file: the Installation Address, as before.
  assert.equal((await run({})).billingAddress, 'New Installation, Zone 55');
  assert.equal((await run({})).billType, 'Detailed');
  // The page itself: the Bill Type is disabled on a home order, and Continue needs no typed address when the existing one is kept.
  const comp = fs.readFileSync('src/components/patterns/BillingAccountStep.tsx', 'utf8');
  assert.match(comp, /label="Bill Type"\s+disabled=\{Boolean\(homeBillingAddress\)\}\s+value=\{homeBillingAddress \? DEFAULT_BILL_TYPE/);
  const sim = steps.fixedLineSteps().find((s) => s.key === 'billingAccount');
  const kept = { billingAccount: { creatingNew: true, newAccount: { profileName: 'T', billCycleDay: 1, primaryContactId: 'CUSTOMER', preferredInvoiceRecipient: 'Primary Contact', sameAsInstallation: false, existingAddressLine: existing } } };
  assert.equal(sim.isValid(kept), true);
});
