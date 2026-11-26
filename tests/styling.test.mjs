// STYLING contracts of the application's own layout (the design-system classes of Button, fields, tabs, overlays are pinned in the library:
// dxp-ui-library/tests/styling.test.mjs). Compared as sets of class tokens, so swapping a wrapper or the order of classes cannot fail it.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { load, close } from './harness.mjs';

after(close);
const h = React.createElement;

function hasClasses(set, expected, forbidden = [], msg = '') {
  for (const c of expected) assert.ok(set.has(c), `${msg} expected class "${c}" in [${[...set].join(' ')}]`);
  for (const c of forbidden) assert.ok(!set.has(c), `${msg} unexpected class "${c}" in [${[...set].join(' ')}]`);
}

test('StandaloneStepPage layout: the wizard title band, the step card 32px in from the page edges, a full-width fixed action bar', async () => {
  const { StandaloneStepPage } = await import('dxp-ui');
  const withNext = html(h(StandaloneStepPage, { title: 'T', step: { key: 'k', label: 'Step', render: () => null }, onNext() {}, canProceed: false }, h('p', null, 'x')));
  assert.match(withNext, /title-band-pad title-band/);
  hasClasses(new Set(/class="([^"]*card[^"]*m-8[^"]*)"/.exec(withNext)?.[1].split(/\s+/)), ['card', 'm-8', 'p-6']);
  assert.match(withNext, /action-bar[^"]*bottom-0/);
  const without = html(h(StandaloneStepPage, { title: 'T', step: { key: 'k', label: 'Done', render: () => null } }, h('p', null, 'x')));
  assert.doesNotMatch(without, /fixed inset-x-0|pb-24/, 'no action bar, and no room reserved for one');
});

test('the component library specimens carry the shared look classes (button variants, the selected tick)', async () => {
  const { UiComponentsLibrarySection } = await load('/src/workspace/administration/UiComponentsLibrarySection.tsx');
  const all5 = ['buttons', 'forms', 'cards'].map((g) => html(h(UiComponentsLibrarySection, { initialGroup: g }))).join('');
  for (const c of ['btn-secondary', 'btn-primary', 'card-tick']) assert.ok(all5.includes(c), c);
});
