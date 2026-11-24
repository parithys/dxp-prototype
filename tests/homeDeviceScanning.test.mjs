import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';
import { storeApi } from './storeTesting.mjs';

// New Home Connection - Device & SIM scanning (front-end prototype). The activation mode set on Check RFS decides, with the service type and the role, whether the journey scans the devices and SIM
// itself (Instant Activation) or books the installation appointment (Field Engineer). Every check is a simulated one over data/reference/deviceScanMock.ts.
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
let steps, mode, mock, rfs, store;
before(async () => {
  await boot();
  await import('dxp-ui');
  steps = await load('/src/modules/fixed-line-fibre/fixedActivation/fixedSteps.tsx');
  mode = await load('/src/modules/fixed-line-fibre/fixedActivation/activationMode.ts');
  mock = await load('/src/data/reference/deviceScanMock.ts');
  rfs = await load('/src/modules/new-connection/rfsStart.ts');
  store = await storeApi();
});
after(close);

const RETAIL_SALES = 'ROLE-01';
const TELESALES = 'ROLE-02';
const address = { zone: '55', streetNo: '830', buildingNo: '12' };
const order = (service, status, activation, extra = {}) => ({ ...rfs.rfsDraftValues({ service, status, address, ...(activation ? { activation } : {}) }), ...extra });
const as = (personaId) => store.patch('persona', { activePersonaId: personaId });
const list = () => steps.fixedLineSteps();
const shown = (values) => list().filter((s) => !s.skip?.(values)).map((s) => s.key);

test('the matrix: Fiber / FWA Indoor with Instant Activation scan in the journey and book no appointment; every Field Engineer order (and FWA Outdoor) books it and scans nothing', () => {
  as(RETAIL_SALES);
  const cases = [
    ['Fiber, Instant Activation', order('fibre', 'RFS_UNLIMITED', 'instant'), { deviceScan: true, sim: false, appointment: false }],
    ['Fiber, Field Engineer', order('fibre', 'RFS_UNLIMITED', 'field'), { deviceScan: false, sim: false, appointment: true }],
    ['FWA Indoor, Instant Activation', order('fwa', 'FWA_INDOOR', 'instant'), { deviceScan: false, sim: true, appointment: false }],
    ['FWA Indoor, Field Engineer', order('fwa', 'FWA_INDOOR', 'field'), { deviceScan: false, sim: false, appointment: true }],
    ['FWA Outdoor, Field Engineer', order('fwa', 'FWA_OUTDOOR', 'field'), { deviceScan: false, sim: false, appointment: true }],
    ['FWA Outdoor, Instant Activation asked for: never offered, so Field Engineer', order('fwa', 'FWA_OUTDOOR', 'instant'), { deviceScan: false, sim: false, appointment: true }],
    ['no activation mode recorded (another entry point): Field Engineer', (({ activationMode: _m, ...v }) => v)(order('fibre', 'RFS_UNLIMITED')), { deviceScan: false, sim: false, appointment: true }],
  ];
  for (const [name, values, want] of cases) {
    const keys = shown(values);
    assert.equal(keys.includes('deviceScan'), want.deviceScan, `${name}: Device Scanning`);
    assert.equal(keys.includes('fwaSim'), want.sim, `${name}: Device & SIM Scanning`);
    assert.equal(keys.includes('appointment'), want.appointment, `${name}: Installation Appointment`);
  }
});

test('the mode is recorded in the draft by Check RFS: instant only when asked for, field otherwise', () => {
  assert.equal(order('fibre', 'RFS_UNLIMITED', 'instant').activationMode, 'instant');
  assert.equal(order('fibre', 'RFS_UNLIMITED', 'field').activationMode, 'field');
  assert.equal(order('fibre', 'RFS_UNLIMITED').activationMode, 'field');
  assert.equal(order('fibre', 'RFS_UNLIMITED', 'instant').rfsCheck.activation, undefined, 'the mode is not part of the RFS read-out');
});

test('only a role that scans (device-scan) runs an instant journey: another role asking for it gets the Field Engineer path', () => {
  const values = order('fibre', 'RFS_UNLIMITED', 'instant');
  as(RETAIL_SALES);
  assert.equal(mode.activationModeOf(values), 'instant');
  as(TELESALES);
  assert.equal(mode.activationModeOf(values), 'field');
  assert.equal(shown(values).includes('appointment'), true);
  assert.equal(shown(values).includes('deviceScan'), false);
  as(RETAIL_SALES);
  const personas = JSON.parse(fs.readFileSync('public/config/personas.json', 'utf8'));
  assert.deepEqual(personas.filter((p) => p.capabilities.includes('device-scan')).map((p) => p.id), ['ROLE-01'], 'Retail Sales only');
});

test('a Retail role is validated with WinCash as well; its channel says so', () => {
  assert.equal(mode.isRetailOrder(RETAIL_SALES), true);
  assert.equal(mode.isRetailOrder(TELESALES), false);
});

test('what is scanned follows what is ordered: the ONT or CPE and a box per STB chosen - never the Mesh extenders (captured with them on Add-ons) - and nothing when the journey does not scan', () => {
  as(RETAIL_SALES);
  const iptv = { enabled: true, bundleId: 'B', stbOffered: true, stb: 'premium', stbSerial: 'STB100000001', extraStbs: 2, extraStbSerials: ['STB100000002', 'STB100000003'] };
  const extenders = { quantity: 2, terms: { freeAllowance: 1, monthlyQAR: 20 } };
  const keys = (values) => mode.scanRowsFor(values).map((r) => r.key);
  assert.deepEqual(keys(order('fibre', 'RFS_UNLIMITED', 'instant')), ['ont']);
  assert.deepEqual(keys(order('fwa', 'FWA_INDOOR', 'instant')), ['cpe']);
  assert.deepEqual(keys(order('fwa', 'FWA_INDOOR', 'instant', { iptv, extenders })), ['cpe', 'stb-0', 'stb-1', 'stb-2'], 'the two Mesh extenders are not rows here');
  assert.deepEqual(keys(order('fibre', 'RFS_UNLIMITED', 'instant', { iptv: { ...iptv, stb: 'none' } })), ['ont'], 'No STB: no box to scan');
  assert.deepEqual(keys(order('fwa', 'FWA_INDOOR', 'field', { iptv, extenders })), [], 'Field Engineer: nothing in the journey');
  assert.deepEqual(keys(order('fwa', 'FWA_OUTDOOR', 'instant', { iptv, extenders })), []);
});

test('the step is complete once every needed device is validated into the cart; an invalid one, or a box whose serial changed on Add-ons, is not', () => {
  as(RETAIL_SALES);
  const iptv = { enabled: true, bundleId: 'B', stbOffered: true, stb: 'lite', stbSerial: 'STB100000001', extraStbs: 0 };
  const base = order('fibre', 'RFS_UNLIMITED', 'instant', { iptv });
  const ok = { ...base, deviceScan: { ont: { serial: 'HWTC11A00001', status: 'validated' }, 'stb-0': { serial: 'STB100000001', status: 'validated' } } };
  assert.equal(mode.isDeviceScanComplete(ok), true);
  assert.equal(mode.isDeviceScanComplete({ ...ok, deviceScan: { ont: ok.deviceScan.ont } }), false, 'the box is not scanned');
  assert.equal(mode.isDeviceScanComplete({ ...ok, deviceScan: { ...ok.deviceScan, ont: { serial: 'HWTC11A00003', status: 'invalid', error: 'x' } } }), false, 'an invalid serial');
  assert.equal(mode.isDeviceScanComplete({ ...ok, iptv: { ...iptv, stbSerial: 'STB100000002' } }), false, 'the serial changed on Add-ons since it was validated');
  assert.equal(steps.deviceScanStep().isValid(ok), true);
  assert.equal(steps.deviceScanStep().isValid(base), false);
});

test('the devices in the cart read back on the Order Summary - with the SIM type for FWA - and a Field Engineer order has none', () => {
  as(RETAIL_SALES);
  const fiber = order('fibre', 'RFS_UNLIMITED', 'instant', { deviceScan: { ont: { serial: 'HWTC11A00001', status: 'validated', brand: 'Huawei', model: 'HG8010H' } } });
  assert.deepEqual(steps.deviceOrderRows(fiber), [{ label: 'ONT Serial Number', value: 'HWTC11A00001 (Huawei HG8010H)' }]);
  const fwa = order('fwa', 'FWA_INDOOR', 'instant', { simType: { simType: 'Physical' }, deviceScan: { cpe: { serial: 'HW880007A', status: 'validated', brand: 'Huawei', model: 'HG8145X6' } } });
  assert.deepEqual(steps.deviceOrderRows(fwa).map((r) => r.label), ['SIM Type', 'CPE (Indoor Unit) Serial Number']);
  assert.deepEqual(steps.deviceOrderRows({ ...fiber, activationMode: 'field' }), [], 'the field engineer scans');
});

test('mock device validation: available, not found, another kind of device, assigned, faulty - each with its own reason - and WinCash on top for Retail', () => {
  assert.equal(mock.validateScanDevice('ont', 'hwtc11a00001 ').ok, true, 'any case, surrounding spaces');
  assert.match(mock.validateScanDevice('ont', '').error, /required/);
  assert.match(mock.validateScanDevice('ont', 'NOPE').error, /not found in inventory/);
  assert.match(mock.validateScanDevice('mesh', 'STB100000001').error, /is a Set-Top Box, not a Mesh Extender/);
  assert.match(mock.validateScanDevice('ont', 'HWTC11A00003').error, /already assigned/);
  assert.match(mock.validateScanDevice('stb', 'STB100000006').error, /faulty/);
  // WinCash declines a serial the inventory accepted.
  assert.equal(mock.validateScanDevice('ont', 'HWTC11A00005').ok, true);
  assert.equal(mock.wincashValidate('HWTC11A00005').ok, false);
  assert.equal(mock.wincashValidate('HWTC11A00001').ok, true);
});

test('a barcode scan reads an available, WinCash-clean serial not already on the order, and runs out rather than repeating one', () => {
  for (const kind of ['ont', 'stb', 'mesh']) {
    const taken = [];
    for (let i = 0; i < 10; i++) {
      const serial = mock.scanMockSerial(kind, taken);
      if (!serial) break;
      assert.equal(mock.validateScanDevice(kind, serial).ok, true, serial);
      assert.equal(mock.wincashValidate(serial).ok, true, serial);
      assert.equal(taken.includes(serial), false, 'never twice');
      taken.push(serial);
    }
    assert.ok(taken.length >= 2, `${kind}: enough serials to scan`);
    assert.equal(mock.scanMockSerial(kind, taken), undefined, `${kind}: exhausted`);
  }
});

test('the demo serials behave as named for every kind', () => {
  for (const kind of ['ont', 'stb', 'mesh']) {
    const d = mock.demoSerials(kind);
    assert.equal(mock.validateScanDevice(kind, d.valid).ok, true, `${kind} valid`);
    assert.equal(mock.validateScanDevice(kind, d.invalid).ok, false, `${kind} invalid`);
    assert.equal(mock.validateScanDevice(kind, d.wincashDeclined).ok, true, `${kind} passes inventory`);
    assert.equal(mock.wincashValidate(d.wincashDeclined).ok, false, `${kind} WinCash declines`);
  }
});

test('the order carries its mode and, for an instant one, the scanned devices and no appointment', () => {
  const submit = fs.readFileSync('src/modules/fixed-line-fibre/fixedActivation/submitFixedActivationOrder.ts', 'utf8');
  assert.match(submit, /const appointment = values\.appointment as AppointmentBookingValue \| undefined;/);
  assert.match(submit, /if \(appointment\) \{\s+await createRecord\('appointments'/);
  assert.match(submit, /activationMode,/);
  assert.match(submit, /scannedDevices:/);
});

test('scope: the Home steps are the only ones changed - the Mobile Postpaid and Prepaid step lists do not mention activation mode or device scanning', () => {
  for (const f of ['src/modules/new-connection/postpaidSteps.tsx', 'src/modules/mobile-prepaid/screens/prepaidSteps.tsx', 'src/components/domain/SimSerialScanner.tsx', 'src/components/domain/SimTypeStep.tsx']) {
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /activationMode|deviceScan|DeviceScan/, f);
  }
});

test('Mesh extenders and set-top boxes: their serial numbers are captured on the Add-ons page (Instant Activation only) and that page is not complete without them', async () => {
  const ext = await load('/src/engines/homeExtenders.ts');
  const terms = { freeAllowance: 1, monthlyQAR: 20 };
  assert.equal(ext.extenderSerialsComplete(undefined), true, 'no extenders, nothing to scan');
  assert.equal(ext.extenderSerialsComplete({ quantity: 0, terms }), true);
  assert.equal(ext.extenderSerialsComplete({ quantity: 2, terms }), false);
  assert.equal(ext.extenderSerialsComplete({ quantity: 2, terms, serials: ['WMP200000001'] }), false, 'one of two');
  assert.equal(ext.extenderSerialsComplete({ quantity: 2, terms, serials: ['WMP200000001', ' '] }), false, 'a blank one is none');
  assert.equal(ext.extenderSerialsComplete({ quantity: 2, terms, serials: ['WMP200000001', 'WMP200000002'] }), true);
  assert.equal(ext.extenderSerialsComplete({ quantity: 1, terms, serials: ['WMP200000001', 'WMP200000002'] }), true, 'only the first quantity are read');
  assert.equal(ext.extenderSerialsComplete({ quantity: 2, terms }, false), true, 'Field Engineer: the field engineer scans them');
  // The Add-ons step takes both into account, only when the journey scans.
  const addons = steps.fixedLineSteps().find((s) => s.key === 'planExtras');
  as(RETAIL_SALES);
  const instant = order('fibre', 'RFS_UNLIMITED', 'instant', { extenders: { quantity: 1, terms } });
  assert.equal(addons.isValid(instant), false, 'Instant Activation: the extender needs its serial');
  assert.equal(addons.isValid({ ...instant, extenders: { quantity: 1, terms, serials: ['WMP200000001'] } }), true);
  assert.equal(addons.isValid({ ...instant, activationMode: 'field' }), true, 'Field Engineer: not asked');
});

test('a barcode scan on the Add-ons page reads a serial the later validation accepts (the same mock inventory)', () => {
  for (const kind of ['stb', 'mesh']) {
    const serial = mock.scanMockSerial(kind, []);
    assert.equal(mock.validateScanDevice(kind, serial).ok, true, `${kind} ${serial}`);
  }
  const src = fs.readFileSync('src/capabilities/AddonsSelection/HomeExtendersCard.tsx', 'utf8');
  assert.match(src, /scanMockSerial\('mesh'/);
  assert.match(fs.readFileSync('src/capabilities/AddonsSelection/HomeIptvPanels.tsx', 'utf8'), /scanMockSerial\('stb'/);
});

test('Mesh extenders are not on the scan step: their serials are captured with them on the Add-ons page', () => {
  as(RETAIL_SALES);
  const terms = { freeAllowance: 1, monthlyQAR: 20 };
  const values = order('fibre', 'RFS_UNLIMITED', 'instant', { extenders: { quantity: 2, terms, serials: ['WMP200000001', 'WMP200000002'] }, deviceScan: { ont: { serial: 'HWTC11A00001', status: 'validated' } } });
  assert.deepEqual(mode.scanRowsFor(values).map((r) => r.key), ['ont']);
  assert.equal(mode.isDeviceScanComplete(values), true, 'the step does not wait for the Mesh');
});

test('the plan\'s free add-ons are put on the order even when the Add-ons page is passed over; alternatives and IPTV are the agent\'s choice', () => {
  const step = steps.fixedLineSteps().find((s) => s.key === 'planExtras');
  assert.equal(typeof step.headless, 'function', 'the free add-ons are applied headlessly');
  assert.equal(step.autoPass({}), true, 'the page itself is still passed over unless asked for');
  const rows = JSON.parse(fs.readFileSync('public/mock-data/addons-discounts.json', 'utf8'));
  const free = rows.filter((d) => d.category === 'Paid Add-on' && d.planId && d.price === 0);
  assert.ok(free.length > 0, 'the catalogue has free add-ons');
  const defaulted = free.filter((d) => !d.exclusiveGroup && d.addonCategory !== 'IPTV');
  assert.ok(defaulted.some((d) => d.name === 'Speed Boost Trial'), 'Speed Boost Trial is defaulted');
  assert.ok(defaulted.every((d) => d.price === 0 && !d.exclusiveGroup), 'only free, non-exclusive ones');
  const src = fs.readFileSync('src/capabilities/AddonsSelection/HomeFreeAddonsApplier.tsx', 'utf8');
  assert.match(src, /!d\.exclusiveGroup && d\.addonCategory !== 'IPTV'/);
  assert.match(fs.readFileSync('src/capabilities/AddonsSelection/AddonsPicker.tsx', 'utf8'), /!a\.exclusiveGroup && a\.addonCategory !== 'IPTV'/, 'the page applies the same rule');
});
