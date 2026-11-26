// The HRN advance ("Upfront Payment Required") is announced as an info toast; no other eligibility check takes that treatment.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';
import { uiComponentsCss, presetCss } from './libPaths.mjs';

let m;
before(async () => { await boot(); m = await load('/src/components/domain/eligibilityRowsModel.ts'); });
after(close);

const check = (id, outcome) => ({ id, label: id, message: `${id} ${outcome}`, outcome });

test('only the HRN advance row is the upfront-payment row; every other outcome and the non-HRN pass row are not', () => {
  const hrnRows = m.buildEligibilityRows([], true, 'Pakistani', 'postpaid', false, true);
  const upfront = hrnRows.filter(m.isUpfrontPaymentRow);
  assert.equal(upfront.length, 1);
  assert.equal(upfront[0].title, 'Upfront Payment Required (HRN)');
  assert.match(upfront[0].detail, /advance payment/i);
  // Not HRN: the "Non-HRN new account" pass row is not the upfront row.
  assert.equal(m.buildEligibilityRows([], false, 'Qatari', 'postpaid', false, true).filter(m.isUpfrontPaymentRow).length, 0);
  // Every other outcome, alongside an HRN customer, keeps its own row and is never mistaken for the upfront row.
  for (const outcome of ['hard-stop', 'soft-stop', 'approval-routing', 'advisory', 'pass']) {
    const rows = m.buildEligibilityRows([check('X-1', outcome)], true, 'Pakistani', 'postpaid', false, true);
    const other = rows.find((r) => r.id === 'X-1');
    assert.ok(other, outcome);
    assert.equal(m.isUpfrontPaymentRow(other), false, outcome);
    assert.equal(rows.filter(m.isUpfrontPaymentRow).length, 1, outcome);
  }
});

test('the step lists the upfront payment row with the other checks and shows no toast for it', () => {
  const src = fs.readFileSync('src/capabilities/EligibilityGate/EligibilityGateStep.tsx', 'utf8');
  assert.doesNotMatch(src, /UPFRONT_PAYMENT_TITLE/, 'no upfront-payment toast');
  assert.match(src, /row\.tone !== 'pass' && \(showRow\?\.\(row\) \?\? true\)/);
  assert.doesNotMatch(src, /!isUpfrontPaymentRow\(row\) && \(showRow/, 'the HRN row is not filtered out of the list');
  // The step raises no info toast at all: the connection-limit breakdown is the Existing Connections Summary, and the upfront payment is a row.
  const infos = src.match(/pushToast\('info', [^)]*\)/g) ?? [];
  assert.deepEqual(infos, [], 'no upfront-payment info toast');
});

test('the upfront payment row carries the info treatment (blue edge, wash and icon panel), as the same card as the other checks', () => {
  const css = uiComponentsCss();
  assert.match(css, /\.eligibility-alert-advisory \{\s*--alert-wash: var\(--info-banner-bg\);\s*@apply border-\[var\(--advisory-solid\)\] bg-\[var\(--alert-wash\)\]/);
  assert.match(css, /\.eligibility-alert-advisory \.eligibility-alert-icon \{\s*@apply bg-\[color-mix\(in_oklab,var\(--advisory-solid\),var\(--bg\)_var\(--alert-panel-soften\)\)\]/);
  const list = fs.readFileSync('src/components/domain/EligibilityRows.tsx', 'utf8');
  assert.match(list, /eligibility-alert eligibility-alert-\$\{row\.tone\}/, 'one card for every tone, the advisory included');
});

test('the Approximate Bill Explainer is the agent\'s: its table is marked agent-only, so the customer view (mirror window) hides it', () => {
  assert.match(fs.readFileSync('src/components/patterns/checkoutDetailedTables.ts', 'utf8'), /title: 'Approximate Bill Explainer',\s*\/\/[^\n]*\n\s*agentOnly: true/);
  assert.match(presetCss(), /\.mirror-window \.agent-only \{\s*display: none !important;/);
});
