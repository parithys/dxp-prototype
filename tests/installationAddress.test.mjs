import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

// New Home Connection's Installation Address: after Number Selection (Fibre) / SIM Selection (FWA); populated from RFS data or UIM for the selected KID (read-only), else captured manually.
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
let addr, steps, rfs, data;
before(async () => {
  await boot();
  await import('dxp-ui');
  addr = await load('/src/modules/fixed-line-fibre/fixedActivation/installationAddress.ts');
  steps = await load('/src/modules/fixed-line-fibre/fixedActivation/fixedSteps.tsx');
  rfs = await load('/src/modules/new-connection/rfsStart.ts');
  data = await load('/src/data/reference/serviceAvailabilityData.ts');
});
after(close);

const handOff = (service, status, kid) => rfs.rfsDraftValues({ service, status, kid, buildingName: 'x', address: { zone: '55', streetNo: '830', buildingNo: '12', aptFlatUnit: kid ? '101' : undefined, city: 'Al Waab' } });

test('the step follows Number Selection for Fibre and SIM Selection for FWA, and only an order that came from Check RFS has it', () => {
  const keys = steps.fixedLineSteps().map((s) => s.key);
  assert.ok(keys.indexOf('installationAddress') > keys.indexOf('number'));
  assert.equal(keys.indexOf('installationAddress'), keys.indexOf('fwaSim') + 1, 'straight after the (FWA-only) SIM Selection, which itself follows the number');
  assert.ok(keys.indexOf('installationAddress') < keys.indexOf('checkout'));
  const step = steps.fixedLineSteps().find((s) => s.key === 'installationAddress');
  assert.equal(step.label, 'Service/Installation Address');
  assert.equal(step.skip({}), true);
  assert.equal(step.skip(handOff('fibre', 'RFS_UNLIMITED', 'KID-55830120-101')), false);
});

test('a selected KID populates the whole address from the RFS data, and UIM adds what it holds for that KID', () => {
  const values = handOff('fibre', 'RFS_UNLIMITED', 'KID-55830120-101');
  const r = addr.resolveInstallationAddress(values);
  assert.equal(r.mode, 'populated');
  assert.equal(r.source, 'RFS');
  assert.deepEqual([r.address.zone, r.address.streetNo, r.address.buildingNo, r.address.aptFlatUnit, r.address.floor, r.address.area], ['55', '830', '12', '101', '1', 'Al Waab']);
  assert.equal(r.address.kidLocationId, 'KID-55830120-101');
  const withUim = addr.resolveInstallationAddress(values, [{ id: 'KID-55830120-101', poBox: '24501', city: 'Doha', country: 'Qatar' }]);
  assert.equal(withUim.source, 'UIM');
  assert.deepEqual([withUim.address.poBox, withUim.address.city, withUim.address.country], ['24501', 'Doha', 'Qatar']);
  assert.equal(addr.isInstallationAddressValid(values), true, 'nothing left to ask');
});

test('every KID of the RFS data populates an address whose Area is its building\'s', () => {
  for (const b of data.AVAILABILITY_BUILDINGS) for (const u of b.units) {
    const r = addr.resolveInstallationAddress({ rfsCheck: { kid: u.kid } });
    assert.equal(r.mode, 'populated', u.kid);
    assert.equal(r.address.area, b.area, u.kid);
    assert.equal(r.address.aptFlatUnit, u.unit, u.kid);
  }
});

test('with no KID the address is manual: ZSB from the check, the Area derived from it, and the Unit / Apartment / Flat Number mandatory', () => {
  const v = handOff('fibre', 'RFS_UNLIMITED', undefined);
  const r = addr.resolveInstallationAddress(v);
  assert.equal(r.mode, 'manual');
  assert.equal(r.address.area, 'Al Waab', 'derived from Zone 55 / Street 830 / Building 12');
  assert.equal(addr.isInstallationAddressValid(v), false, 'no unit');
  assert.equal(addr.isInstallationAddressValid({ ...v, address: { ...v.address, aptFlatUnit: '  ' } }), false, 'blank unit');
  assert.equal(addr.isInstallationAddressValid({ ...v, address: { ...v.address, aptFlatUnit: '4B' } }), true);
  assert.equal(addr.isInstallationAddressValid({ ...v, address: { ...v.address, aptFlatUnit: '4B', buildingNo: '' } }), false, 'ZSB is the check\'s');
});

test('the Area follows the Zone, Street and Building: each RFS building gives its own area, an unknown ZSB gives none', () => {
  for (const b of data.AVAILABILITY_BUILDINGS) assert.equal(addr.deriveArea({ zone: b.zone, streetNo: b.street, buildingNo: b.building }), b.area, b.name);
  assert.equal(addr.deriveArea({ zone: '1', streetNo: '2', buildingNo: '3' }), undefined);
  assert.equal(addr.deriveArea({ zone: '55' }), undefined);
});

test('the view makes populated fields read-only and gives the manual fields their labels', () => {
  const view = fs.readFileSync('src/modules/fixed-line-fibre/fixedActivation/InstallationAddressView.tsx', 'utf8');
  for (const l of ['Kahramaa Meter ID', 'Vodafone Premise ID', 'Zone Number', 'Street Number', 'Building Number', 'Area', 'Unit Number / Apartment Number / Flat Number', 'Floor', 'PO Number', 'City', 'Country', 'Address Description']) assert.match(view, new RegExp(`label="${l.replace(/[/]/g, '\\/')}"`), l);
  assert.match(view, /Input label="Zone Number" required readOnly/);
  assert.doesNotMatch(view, /cannot be edited/, 'no explanatory line above the fields');
  assert.match(view, /required placeholder="e\.g\. 4B, 1402"/, 'the unit is the mandatory field');
});
