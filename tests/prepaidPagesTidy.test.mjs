import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import fs from 'node:fs';
import { load, close } from './harness.mjs';

after(close);
const h = React.createElement;
const read = (f) => fs.readFileSync(f, 'utf8');

test('the Key Information statements are the first lines of Key Terms & Conditions, not a section of their own', async () => {
  const { FullTerms } = await load('/src/components/patterns/CafTerms.tsx');
  const sections = [{ sectionId: 'S1', title: 'Billing', body: 'Billed monthly.' }];
  const out = html(h(FullTerms, { enabled: true, sections, keyInformation: ['No plan lock-in period applies to prepaid packs.'] }, h('span', null, 'form')));
  assert.match(out, /Key Terms &amp; Conditions/);
  assert.ok(out.indexOf('No plan lock-in period') > out.indexOf('Key Terms &amp; Conditions'), 'inside the terms panel');
  assert.ok(out.indexOf('No plan lock-in period') < out.indexOf('Billing'), 'ahead of the sections');
  assert.doesNotMatch(out, /Key Information/, 'no heading of its own');
  const caf = read('src/capabilities/CafSignature/CafSignature.tsx');
  assert.match(caf, /mergeIntoTerms/);
});

test('SIM Selection (New Prepaid): the scanned serial decides Paired / Unpaired inside the SIM container; no agent choice box and no SIM charge container', () => {
  const step = read('src/capabilities/SimType/step.tsx');
  assert.match(step, /extraRows=\{opts\.prepaidActivation \? pairingRows\(/);
  assert.doesNotMatch(step, /Use a Pre-Paired SIM|PrepaidSimCharge|prePairedOption/);
  assert.match(read('src/modules/mobile-prepaid/screens/prepaidSteps.tsx'), /pairingFromScan: true/);
  // One container: a Pre-Paired SIM's scanner shows no read-back of its own.
  assert.match(read('src/components/domain/SimTypeStep.tsx'), /hideDetails/);
  assert.match(read('src/components/domain/SimSerialScanner.tsx'), /!hideDetails && !suppressValidation/);
});

test('demo rule: when the serial decides pairing, a Physical SIM is always Paired (with a number) and a printed eSIM is always Unpaired', async () => {
  const { checkSimSerial } = await load('/src/components/domain/simSerialModel.ts');
  const sims = JSON.parse(read('public/mock-data/sims.json')).filter((s) => s.stockStatus === 'Available');
  const physical = sims.filter((s) => s.type === 'Physical');
  const esims = sims.filter((s) => s.type === 'Printed eSIM');
  assert.ok(physical.length > 0 && esims.length > 0);
  for (const s of physical) {
    const r = await checkSimSerial(s.simSerial, 'any');
    assert.equal(r.details?.prePaired, true, s.simSerial);
    assert.match(r.details?.msisdn ?? '', /^\+974\d{8}$/, s.simSerial);
  }
  for (const s of esims) assert.equal((await checkSimSerial(s.simSerial, 'any')).details?.prePaired, false, s.simSerial);
  assert.ok((await checkSimSerial('0000000000000000000', 'any')).error, 'an unknown serial is still refused');
});

test('the prepaid cart lists the number, the SIM and the add-ons as separate items with room between them', () => {
  const cart = read('src/components/patterns/PrepaidCartStep.tsx');
  assert.match(cart, /className="cluster caption-secondary mt-1 gap-x-6"/);
  assert.doesNotMatch(cart, /\{line\.msisdn\} ·/);
});

test('iPAY Activation is a small switch placed above the Key Terms & Conditions card and before the iPAY Terms & Conditions, which show only while it is Yes', async () => {
  const { FullTerms } = await load('/src/components/patterns/CafTerms.tsx');
  const sections = [{ sectionId: 'P', title: 'Prepaid Terms & Conditions', body: 'Prepaid terms.' }];
  const ipaySections = [{ sectionId: 'I', title: 'iPAY Terms & Conditions', body: 'iPAY terms.' }];
  const render = (value) => html(h(FullTerms, { enabled: true, sections, ipay: { value, onChange() {}, sections: ipaySections } }, h('span', null, 'form')));
  const on = render(true);
  // A small switch (on the left, its label just after it), not a Yes / No segmented control.
  assert.match(on, /<label[^>]*><button[^>]*role="switch"[^>]*aria-checked="true"[^>]*class="switch"[^>]*>.*?<span class="value-text">iPAY Activation<\/span><\/label>/);
  assert.doesNotMatch(on, /role="tab"|role="radiogroup"/, 'a switch, not tabs or a radio group');
  assert.ok(on.indexOf('iPAY Activation') < on.indexOf('Key Terms') && on.indexOf('Key Terms') < on.indexOf('iPAY Terms'), 'the toggle above the key terms card, the iPAY terms beside it');
  const off = render(false);
  assert.match(off, /aria-checked="false"/);
  assert.match(off, /iPAY Activation/);
  assert.doesNotMatch(off, /iPAY Terms &amp; Conditions/, 'hidden while iPAY is not enabled');
  assert.match(html(h(FullTerms, { enabled: true, signed: true, sections, ipay: { value: true, onChange() {}, sections: ipaySections } }, h('span', null, 'form'))), /iPAY Activation: <\/span><span class="text-fg-2">Enabled<\/span>/);
  assert.match(html(h(FullTerms, { enabled: true, signed: true, sections, ipay: { value: false, onChange() {}, sections: ipaySections } }, h('span', null, 'form'))), /iPAY Activation: <\/span><span class="text-fg-2">Disabled<\/span>/);
});
