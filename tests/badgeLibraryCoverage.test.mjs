// The badge system is documented in full in the libraries: every Badge variant, every service-type and connection-type tag, the status-colour mapping,
// every eligibility outcome and every validation state is rendered live - so a new one cannot be left out without this failing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { libDts } from './libPaths.mjs';

const read = (p) => fs.readFileSync(p, 'utf8');
const library = read('src/workspace/administration/UiComponentsLibrarySection.tsx');

test('the UI Components Library renders every Badge variant', () => {
  const union = /export type BadgeVariant =([\s\S]*?);/.exec(libDts('components/primitives/Badge'))?.[1] ?? '';
  const variants = [...union.matchAll(/'([\w-]+)'/g)].map((m) => m[1]);
  assert.equal(variants.length, 15);
  const missing = variants.filter((v) => !new RegExp(`<Badge variant="${v}">`).test(library));
  assert.deepEqual(missing, [], 'Badge variants with no specimen');
});

test('every service-type tag and every connection category is rendered from its own table, and an unknown category too', () => {
  assert.match(library, /Object\.keys\(SERVICE_TYPE_TAGS\)[\s\S]{0,120}<ServiceTypeTag key=\{k\} type=\{k\}/);
  assert.match(library, /Object\.keys\(CONNECTION_TAG\)[\s\S]{0,120}<ConnectionTypeTag key=\{c\} category=\{c\}/);
  assert.match(library, /<ConnectionTypeTag category="A Category Nobody Defined" \/>/);
});

test('the status-colour mapping, the eligibility outcome cards and the validation states are specimens', () => {
  assert.match(library, /Badge - By Status Meaning/);
  assert.match(library, /badgeVariantFor\(status\)/);
  for (const tone of ['hard-stop', 'soft-stop', 'approval-routing', 'advisory', 'pass']) assert.match(fs.readFileSync('src/capabilities/eligibilitySampleRows.ts', 'utf8'), new RegExp(`tone: '${tone}'`), `eligibility outcome ${tone}`);
  assert.match(library, /<EligibilityChecksList rows=\{ELIGIBILITY_SAMPLE_ROWS\} \/>/);
  const states = /export type ValidationVariant =([^;]*);/.exec(read('src/components/patterns/ValidationStatus.tsx'))?.[1] ?? '';
  for (const v of [...states.matchAll(/'([\w-]+)'/g)].map((m) => m[1])) assert.match(library, new RegExp(`<ValidationStatus variant="${v}"`), `validation state ${v}`);
});

test('the Capability Library\'s eligibility preview has a scenario for every outcome a customer can reach: clear, approval, soft stop, hard stop and the upfront payment advisory', () => {
  const demos = read('src/capabilities/previewDemos.tsx');
  for (const key of ['clear', 'approval', 'soft', 'hard', 'upfront']) assert.match(demos, new RegExp(`key: '${key}'`), key);
});

// ---- rendered: the groups draw without error and show what they promise -------------------------------------------------------------
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { before, after } from 'node:test';
import { boot, load, close } from './harness.mjs';
import { storeApi } from './storeTesting.mjs';

globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
let wrap;
before(async () => {
  ({ wrap } = await storeApi());
  await boot();
});
after(close);

test('rendered: Tags & Badges shows the info and violet badges, every service-type tag, the status mapping and the connection tags', async () => {
  const { UiComponentsLibrarySection } = await load('/src/workspace/administration/UiComponentsLibrarySection.tsx');
  const tags = await load('/src/lib/serviceTypeTag.ts');
  const out = renderToStaticMarkup(wrap(React.createElement(UiComponentsLibrarySection, { initialGroup: 'tags' })));
  assert.match(out, />Info</);
  assert.match(out, />Violet</);
  for (const { label } of Object.values(tags.SERVICE_TYPE_TAGS)) assert.ok(out.includes(`>${label}<`), `service tag ${label}`);
  for (const word of ['Completed', 'Pending', 'Rejected', 'New', 'Not Applicable']) assert.ok(out.includes(`>${word}<`), `status ${word}`);
  assert.match(out, /A Category Nobody Defined/);
});

test('rendered: Alerts & Notifications shows one card per eligibility outcome and every validation state', async () => {
  const { UiComponentsLibrarySection } = await load('/src/workspace/administration/UiComponentsLibrarySection.tsx');
  const out = renderToStaticMarkup(wrap(React.createElement(UiComponentsLibrarySection, { initialGroup: 'alerts' })));
  for (const tone of ['hard-stop', 'soft-stop', 'approval-routing', 'advisory', 'pass']) assert.match(out, new RegExp(`eligibility-alert-${tone}`), tone);
  for (const title of ['Identity Validated', 'ID Not Found in MOI', 'MOI Is Unavailable', 'Validating the Identity Document', 'Trying Again']) assert.ok(out.includes(title), title);
});
