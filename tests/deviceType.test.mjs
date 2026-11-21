// One New Prepaid journey for web and tablet: the device changes how steps are operated, never which steps there are.
import test, { before, after } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { boot, load, close } from './harness.mjs';

// The step modules touch window at import time; the harness window is a bare object.
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
let lib;
let connection;
let cfg;
before(async () => {
  ({ cfg } = await boot());
  lib = await import('dxp-ui');
  connection = await load('/src/modules/new-connection/connectionSteps.tsx');
});
after(close);

test('New Prepaid: web and tablet run the same steps in the same order', () => {
  const ctx = (device) => ({ device, wizardId: 'new-connection', flow: 'new', existingCustomerId: undefined, guardedContactChange: () => {}, applyCrossSales: () => {}, navigate: () => {}, createRecord: async () => {}, products: [], customerBenefits: undefined });
  const keys = (device) => connection.buildConnectionSteps(ctx(device)).filter((s) => !s.skip?.({ product: 'prepaid' })).map((s) => s.key);
  assert.deepEqual(keys('web'), keys('tablet'));
  assert.deepEqual(keys('web'), ['contact', 'product', 'plan', 'planExtras', 'simType', 'number', 'checkout', 'caf', 'payment']);
});

test('New Prepaid: one catalogued screen, one feature, no Tablet-only journey', () => {
  const routes = cfg.getAllRoutes().filter((r) => r.module === 'Mobile Prepaid');
  assert.deepEqual(routes.filter((r) => /prepaid/i.test(r.path)).map((r) => r.screenId), ['SCR-190']);
  assert.ok(routes.every((r) => !/tablet/i.test(r.screenName)), 'no screen is named for a device');
  const feature = cfg.getFeatureEntry('prepaid.new-prepaid-wizard');
  assert.deepEqual(feature?.screenIds, ['SCR-190']);
});

test('SIM serial: the barcode icon in the field is the one scan control on every device (no separate button); web takes focus, tablet does not', async () => {
  const { SimSerialScanner } = await load('/src/components/domain/SimSerialScanner.tsx');
  const render = (device) => html(React.createElement(SimSerialScanner, { value: '', onChange: () => {}, device }));
  for (const device of ['tablet', 'web', undefined]) {
    const out = render(device);
    assert.equal((out.match(/aria-label="Scan SIM barcode"/g) ?? []).length, 1, `${device}: the icon`);
    assert.doesNotMatch(out, />Scan SIM barcode</, `${device}: no text button`);
  }
  assert.doesNotMatch(render('tablet'), /autofocus/i);
});

test('CAF type follows the device: Touch Screen on a tablet, Digital on the web', async () => {
  const { detectCafType } = await load('/src/components/patterns/cafTypes.ts');
  assert.equal(detectCafType(), lib.detectDeviceType() === 'tablet' ? 'Touch Screen' : 'Digital');
});

test('the header\'s Customers Served pill is web-only: a tablet or phone leaves it out (the Dashboard hero still shows the count)', () => {
  const src = fs.readFileSync('src/navigation/PersonaSwitcher.tsx', 'utf8');
  assert.match(src, /\{showQnomy && detectDeviceType\(\) !== 'tablet' && \(\s*<Tooltip content="Customers Served"/);
  assert.match(fs.readFileSync('src/modules/Dashboard.tsx', 'utf8'), /label: 'Customers Served'/, 'the hero keeps the figure on every device');
});
