import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { boot, load, close } from './harness.mjs';
import { uiComponentsCss } from './libPaths.mjs';

globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};

// Eligibility results are prominent everywhere they are listed: a card each, a white icon on a solid rounded-square tile, an alert role, no shadow.
let list;
before(async () => {
  await boot();
  list = await load('/src/components/domain/EligibilityRows.tsx');
});
after(close);

const rows = [
  { id: 'gcc-id-postpaid', title: 'Postpaid Not Permitted With GCC ID', detail: 'Postpaid activation is not permitted with a GCC ID.', tone: 'soft-stop' },
  { id: 'age', title: 'Underage Customer', detail: 'The connection cannot proceed.', tone: 'hard-stop' },
  { id: 'id-type-routing', title: 'Credit Control Approval Required', detail: 'Routed for approval.', tone: 'approval-routing' },
];

test('one alert card per result, a white icon on a solid rounded-square tile, the title and instruction in full strength', () => {
  const out = html(React.createElement(list.EligibilityChecksList, { rows }));
  assert.equal((out.match(/role="alert"/g) ?? []).length, 3);
  for (const t of ['soft-stop', 'hard-stop', 'approval-routing']) assert.match(out, new RegExp(`eligibility-alert-${t}`));
  assert.doesNotMatch(out, /eyebrow|>Soft Stop<|>Hard Stop</, 'no outcome label above the title');
  assert.doesNotMatch(out, /text-\[var\(--warn-text\)\]|text-danger/, 'the icon is white (the tile carries the colour)');
  assert.match(out, /Postpaid Not Permitted With GCC ID/);
  assert.match(out, /title title-md/);
  assert.doesNotMatch(out, /list-frame/);
});

test('the same card everywhere results are listed, with no shadow: the step, the drawer, the preview, the HRN advance and the ID type notice', () => {
  const out = html(React.createElement(list.EligibilityChecksList, { rows: [...rows, { id: 'hrn', title: 'Upfront Payment Required (HRN)', detail: 'An advance payment is required at checkout.', tone: 'advisory' }, { id: 'ok', title: 'ID Validity', detail: 'Valid', tone: 'pass' }] }));
  assert.equal((out.match(/class="eligibility-alert eligibility-alert-/g) ?? []).length, 5, 'every tone is the same card');
  assert.doesNotMatch(out, /list-frame/);
  const css = uiComponentsCss();
  const card = css.slice(css.indexOf('.eligibility-alert {'), css.indexOf('}', css.indexOf('.eligibility-alert {')));
  assert.doesNotMatch(card, /shadow/, 'no shadow');
  for (const t of ['hard-stop', 'soft-stop', 'approval-routing', 'pass', 'advisory']) assert.match(css, new RegExp(`\\.eligibility-alert-${t} \\{`), t);
  for (const f of ['src/capabilities/EligibilityGate/EligibilityGateStep.tsx', 'src/capabilities/EligibilityGate/EligibilityOutcomes.tsx', 'src/capabilities/PlanSelection/postpaidStep.tsx', 'src/modules/new-connection/steps/IdTypeApprovalNotice.tsx'])
    assert.match(fs.readFileSync(f, 'utf8'), /<EligibilityChecksList rows=\{[^}]+\} \/>/, f);
  assert.doesNotMatch(fs.readFileSync('src/components/domain/EligibilityRows.tsx', 'utf8'), /prominent/, 'there is one layout');
});

test('the result card is a flush icon panel beside the text: the card (a rounded square, like every card) clips a full-height icon panel, which has no radius of its own', () => {
  const css = uiComponentsCss();
  const card = /\.eligibility-alert \{[^}]*\}/.exec(css)?.[0] ?? '';
  const alertIcon = /\.eligibility-alert-icon \{[^}]*\}/.exec(css)?.[0] ?? '';
  assert.match(card, /rounded-\[var\(--radius-card\)\]/);
  assert.match(card, /overflow-hidden/);
  assert.match(card, /items-stretch/);
  assert.match(alertIcon, /w-\[var\(--size-alert-icon-w\)\]/);
  assert.doesNotMatch(alertIcon, /rounded-|\bsize-12\b/);
  assert.match(css, /\.eligibility-alert > :not\(\.eligibility-alert-icon\) \{\s*@apply p-5;/, 'the text carries the padding');
});

test('status cards and rows carry no coloured strip down one side: the border runs all round', () => {
  const css = uiComponentsCss();
  const alert = /\.eligibility-alert \{[^}]*\}/.exec(css)?.[0] ?? '';
  assert.match(alert, /\bborder\b/);
  assert.doesNotMatch(alert, /border-s-|border-l-/, 'no thick edge on the card');
  const approval = fs.readFileSync('src/modules/order-management/OrderApprovalDetail.tsx', 'utf8');
  assert.doesNotMatch(/function decisionTone[\s\S]*?\n\}/.exec(approval)?.[0] ?? '', /border-l-/, 'the Rejected / Returned history rows have no side strip either');
  // Nowhere in the app does a 4px side strip mark a status.
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : /\.(tsx?|css)$/.test(e.name) ? [`${d}/${e.name}`] : []));
  const offenders = walk('src').filter((f) => /border-(s|l)-4\b|border-(s|l)-\[var\(--(danger|warn|success)/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('each eligibility outcome has its own hue and its own icon: red, amber, violet, blue, green and cross, warning triangle, clock, info, tick', async () => {
  const css = uiComponentsCss();
  // The declarations of one rule: from `selector {` to its closing brace.
  const rule = (sel) => {
    const at = css.indexOf(`${sel} {`);
    return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
  };
  assert.match(rule('.eligibility-alert-icon'), /text-\[var\(--alert-wash\)\]/, 'the icon is drawn in the card\'s own wash');
  const OUTCOMES = ['hard-stop', 'soft-stop', 'approval-routing', 'advisory', 'pass'];
  const fills = OUTCOMES.map((o) => /bg-\[color-mix\(in_oklab,var\((--[\w-]+)\),var\(--bg\)_var\(--alert-panel-soften\)\)\]/.exec(rule(`.eligibility-alert-${o} .eligibility-alert-icon`))?.[1]);
  const borders = OUTCOMES.map((o) => /border-(?:\[var\((--[\w-]+)\)\]|([a-z]+)\b)/.exec(rule(`.eligibility-alert-${o}`).replace('@apply ', ''))?.slice(1).find(Boolean));
  assert.ok(fills.every(Boolean), `every outcome fills its icon panel with its own hue, softened toward the page: ${fills}`);
  assert.equal(new Set(fills).size, OUTCOMES.length, `five different icon fills: ${fills}`);
  assert.equal(new Set(borders).size, OUTCOMES.length, `five different border colours: ${borders}`);
  assert.match(rule('.eligibility-alert-approval-routing'), /--info-solid/, 'approval is violet, the design system\'s needs-approval colour');
  assert.doesNotMatch(css, /--tone-approval-bg|bg-tone-approval/, 'the orange approval wash is gone: it sat too close to the amber soft stop');
  const model = await load('/src/components/domain/eligibilityRowsModel.ts');
  assert.equal(new Set(OUTCOMES.map((o) => model.ROW_ICON[o])).size, OUTCOMES.length, 'five different icon shapes');
});
