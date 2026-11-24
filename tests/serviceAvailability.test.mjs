import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, load, close } from './harness.mjs';

// The Check RFS Service Availability lookup and validation. Expectations are written out per search (what each entry IS), not derived from the
// inventory, and the inventory is also checked as a whole: every building is findable by every search mode and none changes status.
let model, data;
before(async () => {
  await boot();
  model = await load('/src/modules/check-rfs/serviceAvailabilityModel.ts');
  data = await load('/src/data/reference/serviceAvailabilityData.ts');
});
after(close);

const look = (mode, values) => model.lookupAvailability(mode, values);

test('each search finds the status the inventory holds, or NOT_FOUND', () => {
  const table = [
    ['zsb', { zone: '55', street: '830', building: '12' }, 'RFS_UNLIMITED'],
    ['kid', { kid: 'KID-66840240-1402' }, 'RFS_LIMITED'],
    ['kid', { kid: 'kid-69350070-1' }, 'FWA_INDOOR'],
    ['vfid', { vfid: 'WAK-0003-A' }, 'FWA_OUTDOOR'],
    ['zsb', { zone: '72', street: '120', building: '5' }, 'FWA_BOTH'],
    ['area', { area: 'Lusail', bname: 'Fox Hills Block 15' }, 'RFA'],
    ['zsb', { zone: '63', street: '810', building: '40' }, 'EBU'],
    ['vfid', { vfid: 'WBT-0040-A' }, 'EBU'],
    ['zsb', { zone: '12', street: '345', building: '6' }, 'NOT_FOUND'],
    ['kid', { kid: 'KID-12345678-001' }, 'NOT_FOUND'],
    ['vfid', { vfid: 'ABC-9999-Z' }, 'NOT_FOUND'],
    ['area', { area: 'Al Waab', bname: 'Wakrah Garden Compound' }, 'NOT_FOUND'],
    ['area', { area: 'West Bay', bname: 'Corniche Sky Residences' }, 'NOT_FOUND'],
  ];
  for (const [mode, values, status] of table) assert.equal(look(mode, values).status, status, `${mode} ${JSON.stringify(values)}`);
});

test('a unit filter narrows a ZSB hit, and an unknown unit keeps every unit', () => {
  const base = { zone: '55', street: '830', building: '12' };
  assert.equal(look('zsb', base).units.length, 4);
  const one = look('zsb', { ...base, unit: '201' });
  assert.equal(one.units.length, 1);
  assert.ok(one.single);
  assert.equal(look('zsb', { ...base, unit: '999' }).units.length, 4);
});

test('a KID / VFID hit is a single unit; a multi-unit building is not', () => {
  assert.ok(look('kid', { kid: 'KID-55830120-101' }).single);
  assert.ok(!look('area', { area: 'Al Waab', bname: 'Al Waab Residence Tower' }).single);
});

test('validation: required fields and formats', () => {
  const zsb = model.modeById('zsb');
  assert.ok(!model.isSearchValid(zsb, {}));
  assert.ok(!model.isSearchValid(zsb, { zone: '55', street: '830', building: 'x' }));
  assert.ok(model.isSearchValid(zsb, { zone: '55', street: '830', building: '12' }));
  assert.ok(!model.isSearchValid(model.modeById('kid'), { kid: 'KID-1' }));
  assert.ok(model.isSearchValid(model.modeById('vfid'), { vfid: 'wab-0012-a' }));
  assert.ok(!model.isSearchValid(model.modeById('area'), { area: 'Al Waab' }));
  assert.equal(model.fieldError(zsb.fields[0], { zone: '1234' }), 'Enter a zone number (1–3 digits).');
  assert.equal(model.fieldError(zsb.fields[0], { zone: '' }), undefined);
});

test('inventory invariants: every building and unit is findable by every mode and keeps its status', () => {
  for (const b of data.AVAILABILITY_BUILDINGS) {
    assert.equal(look('zsb', { zone: b.zone, street: b.street, building: b.building }).status, b.status, b.name);
    assert.equal(look('area', { area: b.area, bname: b.name }).status, b.status, b.name);
    for (const u of b.units) {
      assert.equal(look('kid', { kid: u.kid }).status, b.status, u.kid);
      assert.equal(look('vfid', { vfid: u.vfid }).status, b.status, u.vfid);
    }
    assert.ok(data.AVAILABILITY_STATUS[b.status], b.status);
  }
  assert.deepEqual(model.availabilityAreas(), [...new Set(data.AVAILABILITY_BUILDINGS.map((b) => b.area))].sort());
});

test('every outcome offers one way to proceed, written out per status', () => {
  const expected = {
    RFS_UNLIMITED: 'fibre', RFS_LIMITED: 'fibre', FWA_INDOOR: 'fwa', FWA_OUTDOOR: 'fwa', FWA_BOTH: 'fwa',
    RFA: 'mbb', EBU: 'mbb', NOT_FOUND: 'mbb',
  };
  assert.deepEqual(Object.keys(data.AVAILABILITY_STATUS).sort(), Object.keys(expected).sort());
  for (const [key, proceed] of Object.entries(expected)) assert.equal(data.AVAILABILITY_STATUS[key].proceed, proceed, key);
  // Only a sellable location starts a fibre / 5G Home connection; every other outcome (RFA, an EBU building, not found) continues to Mobile Postpaid Activation with the Mobile Broadband offers.
  for (const st of Object.values(data.AVAILABILITY_STATUS)) assert.equal(st.sellable, st.proceed === 'fibre' || st.proceed === 'fwa');
});

test('RFA, an EBU building and a search that finds nothing all show the Mobile Broadband offers', () => {
  for (const key of ['RFA', 'EBU', 'NOT_FOUND']) {
    assert.equal(data.AVAILABILITY_STATUS[key].mbb, true, key);
    assert.equal(data.AVAILABILITY_STATUS[key].sellable, false, key);
  }
  for (const key of ['RFS_UNLIMITED', 'RFS_LIMITED', 'FWA_INDOOR', 'FWA_OUTDOOR', 'FWA_BOTH']) assert.ok(!data.AVAILABILITY_STATUS[key].mbb, `${key} sells fibre or 5G Home`);
  assert.deepEqual(data.MBB_OFFERS.map((o) => o.id), ['mbb50', 'mbb150', 'mbbU']);
});

test('device reuse and Zero Touch: read from the feasibility response and UIM\'s model mapping, never assumed', () => {
  const table = [
    [undefined, 'none'],
    [{ model: 'Huawei HG8145V5', reusable: true }, 'zero-touch'],
    [{ model: 'ZTE F670L', reusable: true }, 'zero-touch'],
    [{ model: 'Nokia G-240W-C', reusable: true }, 'no-zero-touch'],
    [{ model: 'Acme CPE X1', reusable: true }, 'unknown-model'],
    [{ model: 'Huawei HG8145V5', reusable: false }, 'not-reusable'],
    [{ model: 'Acme CPE X1', reusable: false }, 'not-reusable'],
  ];
  for (const [device, status] of table) assert.equal(model.deviceReuseOf({ device }).status, status, JSON.stringify(device));
  assert.equal(data.DEVICE_ZERO_TOUCH['Acme CPE X1'], undefined, 'an unmapped model stays unknown');
  const tags = (device) => model.deviceReuseTags(model.deviceReuseOf({ device })).map((t) => t.label);
  assert.deepEqual(tags({ model: 'ZTE F670L', reusable: true }), ['Reusable', 'Instant Activation']);
  assert.deepEqual(tags({ model: 'Nokia G-240W-C', reusable: true }), ['Reusable'], 'reusable, but the model does not support Zero Touch');
  assert.deepEqual(tags({ model: 'Acme CPE X1', reusable: true }), ['Reusable'], 'a model not mapped for Instant Activation says nothing about it');
  assert.deepEqual(tags({ model: 'ZTE F670L', reusable: false }), ['Not Reusable']);
  assert.deepEqual(tags(undefined), []);
  // Through the lookup: unit 101 of Al Waab has a reusable Zero Touch device, 202 none.
  const units = look('area', { area: 'Al Waab', bname: 'Al Waab Residence Tower' }).units;
  assert.equal(model.deviceReuseOf(units.find((u) => u.unit === '101')).status, 'zero-touch');
  assert.equal(model.deviceReuseOf(units.find((u) => u.unit === '102')).status, 'no-zero-touch');
  assert.equal(model.deviceReuseOf(units.find((u) => u.unit === '201')).status, 'not-reusable');
  assert.equal(model.deviceReuseOf(units.find((u) => u.unit === '202')).status, 'none');
});

test('the splitter warnings the feasibility response gives are shown as they come: Splitter Full, Splitter Not Mapped, and nothing when it says nothing', () => {
  assert.equal(model.splitterWarningOf({ splitter: 'full' }), 'Splitter Full');
  assert.equal(model.splitterWarningOf({ splitter: 'not-mapped' }), 'Splitter Not Mapped');
  assert.equal(model.splitterWarningOf({}), undefined);
  const al = look('area', { area: 'Al Waab', bname: 'Al Waab Residence Tower' }).units;
  assert.equal(model.splitterWarningOf(al.find((u) => u.unit === '102')), 'Splitter Full');
  assert.equal(model.splitterWarningOf(al.find((u) => u.unit === '101')), undefined);
  assert.equal(model.splitterWarningOf(look('kid', { kid: 'KID-66840240-1402' }).units[0]), 'Splitter Not Mapped');
});

test('the unit cards carry an Interested button that raises a lead for the unit\'s location without selecting the unit', async () => {
  const fs = await import('node:fs');
  const sa = fs.readFileSync('src/modules/check-rfs/ServiceAvailability.tsx', 'utf8');
  assert.match(sa, /createRecord\('leads', \{[\s\S]*createdVia: 'Check RFS - Interested'[\s\S]*customerName: leadName\.trim\(\)[\s\S]*mobileNumber: leadMobile[\s\S]*kid: u\.kid[\s\S]*vfid: u\.vfid/);
  // Both details are mandatory: nothing is created until the name is entered and the mobile number is a valid Qatar mobile.
  assert.match(sa, /if \(!u \|\| !result \|\| !b \|\| leadBusy \|\| !leadNameOk \|\| !leadMobileOk\) return;/);
  assert.match(sa, /title="Customer Details"[\s\S]*label="Name"\s+required[\s\S]*label="Mobile Number"\s+required/);
  assert.match(sa, /e\.stopPropagation\(\); onInterested\(\);/, 'the click is the button\'s own, not the card\'s selection');
  // The card holds a button, so it is not itself a button (no nested buttons).
  assert.match(sa, /<div\s+key=\{u\.kid\}\s+role="radio"/);
});

test('every demo shortcut, on every tab, fills a valid entry that reaches its own scenario', () => {
  const expected = { 'Fiber Unlimited': 'RFS_UNLIMITED', 'Fiber Limited': 'RFS_LIMITED', 'FWA Indoor': 'FWA_INDOOR', 'FWA Outdoor': 'FWA_OUTDOOR', 'FWA Indoor & Outdoor': 'FWA_BOTH', RFA: 'RFA', 'Not Found': 'NOT_FOUND' };
  assert.deepEqual(model.DEMO_SCENARIOS.map((d) => d.label), Object.keys(expected), 'the seven categories, in order');
  for (const d of model.DEMO_SCENARIOS) {
    for (const mode of model.SEARCH_MODES) {
      const values = model.demoScenarioValues(mode.id, d.status);
      assert.equal(model.isSearchValid(mode, values), true, `${d.label} on ${mode.id} fills every required field`);
      assert.equal(look(mode.id, values).status, expected[d.label], `${d.label} on ${mode.id}`);
    }
  }
});

test('the KID and VFID fields take a barcode scan, and what a scan reads is an identifier the lookup finds', () => {
  const scannable = model.SEARCH_MODES.flatMap((m) => m.fields).filter((f) => f.scan).map((f) => f.id);
  assert.deepEqual(scannable, ['kid', 'vfid']);
  for (let i = 0; i < 20; i++) {
    for (const id of scannable) {
      const read = model.scanSample(id);
      const mode = model.modeById(id);
      assert.equal(model.isSearchValid(mode, { [id]: read }), true, `${id} ${read} is a valid entry`);
      assert.notEqual(look(id, { [id]: read }).status, 'NOT_FOUND', `${id} ${read} is in the inventory`);
    }
  }
});
