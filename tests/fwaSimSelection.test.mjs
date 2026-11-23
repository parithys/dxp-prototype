import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

// New Home Connection, FWA: a SIM Selection step after the Fixed Line Number - Physical only, with the Indoor Unit's serial number - and the SIM details on the Order Summary.
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
let model, steps, rfs;
before(async () => {
  await boot();
  await import('dxp-ui');
  model = await load('/src/modules/fixed-line-fibre/fixedActivation/fixedActivationModel.ts');
  steps = await load('/src/modules/fixed-line-fibre/fixedActivation/fixedSteps.tsx');
  rfs = await load('/src/modules/new-connection/rfsStart.ts');
});
after(close);

const address = { zone: '69', streetNo: '350', buildingNo: '7' };
const valuesFor = (service, status, extra = {}) => ({ ...rfs.rfsDraftValues({ service, status, address, ...extra }) });

test('only an FWA result takes a SIM: FWA Indoor, FWA Outdoor and a chosen type of FWA Both; Fibre never does', () => {
  assert.equal(model.isFwaService(valuesFor('fwa', 'FWA_INDOOR')), true);
  assert.equal(model.isFwaService(valuesFor('fwa', 'FWA_OUTDOOR')), true);
  assert.equal(model.isFwaService(valuesFor('fwa', 'FWA_BOTH', { fwaType: 'Indoor' })), true);
  assert.equal(model.isFwaService(valuesFor('fwa', 'FWA_BOTH', { fwaType: 'Outdoor' })), true);
  assert.equal(model.isFwaService(valuesFor('fibre', 'RFS_UNLIMITED')), false);
  assert.equal(model.isFwaService(valuesFor('fibre', 'RFS_LIMITED')), false);
});

test('the SIM Selection step follows the Fixed Line Number and is passed over unless the order is FWA', () => {
  const list = steps.fixedLineSteps();
  const keys = list.map((s) => s.key);
  assert.equal(keys.indexOf('fwaSim'), keys.indexOf('number') + 1, 'straight after Number & Devices');
  assert.ok(keys.indexOf('fwaSim') < keys.indexOf('checkout'));
  const sim = list.find((s) => s.key === 'fwaSim');
  assert.equal(sim.label, 'SIM Selection');
  assert.equal(sim.skip(valuesFor('fwa', 'FWA_INDOOR')), false);
  assert.equal(sim.skip(valuesFor('fibre', 'RFS_UNLIMITED')), true);
});

const devices = JSON.parse(fs.readFileSync('public/mock-data/cpe-devices.json', 'utf8'));
const idu = devices.find((d) => d.deviceType === 'Indoor IDU' && d.stockStatus === 'In-Stock');

test('Continue needs a validated Physical SIM and an Indoor Unit the inventory accepted for the serial in the field', () => {
  const sim = steps.fixedLineSteps().find((s) => s.key === 'fwaSim');
  const ok = { ...valuesFor('fwa', 'FWA_INDOOR'), simType: { simType: 'Physical', simSerial: '8974000000000001', simValid: true }, indoorUnitSerial: idu.serialNumber, indoorUnit: idu };
  assert.equal(sim.isValid(ok), true);
  assert.equal(sim.isValid({ ...ok, indoorUnit: undefined }), false, 'a serial the inventory has not accepted');
  assert.equal(sim.isValid({ ...ok, indoorUnitSerial: 'ZZ999999' }), false, 'the field changed after the check');
  assert.equal(sim.isValid({ ...ok, simType: { simType: 'Physical', simSerial: '8974000000000001', simValid: false } }), false, 'an unvalidated SIM');
  assert.equal(sim.isValid({ ...ok, simType: { simType: 'eSIM', esimIssued: true } }), false, 'no eSIM');
});

test('the Indoor Unit check: found, an Indoor Unit, in stock - and the reason when not; any case and surrounding spaces are accepted', () => {
  const ok = model.checkIndoorUnitSerial(` ${idu.serialNumber.toLowerCase()} `, devices);
  assert.equal(ok.ok, true);
  assert.equal(ok.details.brand, idu.brand);
  assert.equal(ok.details.modelNumber, idu.modelNumber);
  assert.match(model.checkIndoorUnitSerial('', devices).error, /required/);
  assert.match(model.checkIndoorUnitSerial('NOPE0001', devices).error, /not found in inventory/);
  const other = devices.find((d) => d.deviceType !== 'Indoor IDU');
  assert.match(model.checkIndoorUnitSerial(other.serialNumber, devices).error, /not an Indoor Unit/);
  const assigned = { ...idu, serialNumber: 'ASSIGNED01', stockStatus: 'Sold/Assigned' };
  assert.match(model.checkIndoorUnitSerial('ASSIGNED01', [assigned]).error, /already assigned/);
});

test('the Indoor Unit inventory has several units in stock, each stating brand, model number and firmware (what a scan reads back)', () => {
  const stock = model.indoorUnitsInStock(devices);
  assert.ok(stock.length >= 6);
  for (const d of stock) {
    assert.ok(d.brand && d.modelNumber && d.firmwareVersion && d.macAddress, d.serialNumber);
  }
  assert.ok(new Set(stock.map((d) => d.brand)).size >= 3, 'more than one brand');
});

test('the SIM Type and Indoor Unit join the Order Summary for FWA only, and the order records the SIM details', () => {
  const src = fs.readFileSync('src/modules/fixed-line-fibre/fixedActivation/fixedSteps.tsx', 'utf8');
  assert.match(src, /label: 'SIM Type'/);
  assert.match(src, /label: 'Indoor Unit Serial Number'/);
  assert.match(src, /checkoutSummaryStep\(\{ familyRows: fwaOrderRows \}\)/);
  const submit = fs.readFileSync('src/modules/fixed-line-fibre/fixedActivation/submitFixedActivationOrder.ts', 'utf8');
  assert.match(submit, /isFwaService\(values\)/);
  assert.match(submit, /indoorUnitSerial/);
});

test('the SIM step offers no eSIM, and the postpaid and prepaid SIM steps are unchanged', () => {
  const dom = fs.readFileSync('src/components/domain/SimTypeStep.tsx', 'utf8');
  assert.match(dom, /physicalOnly = false/, 'opt-in, off by default');
  for (const f of ['src/modules/new-connection/postpaidSteps.tsx', 'src/modules/mobile-prepaid/screens/prepaidSteps.tsx']) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /physicalOnly/, f);
});
