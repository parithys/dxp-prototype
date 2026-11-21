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
