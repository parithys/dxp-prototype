// ID verification errors: every one is an error panel with a specific title (ValidationStatus, business failure), never a line of small red text under the field.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load, close } from './harness.mjs';
import { uiComponentsCss } from './libPaths.mjs';

let rec;
before(async () => {
  rec = await load('/src/components/patterns/idReconciliation.ts');
});
after(close);

const MISMATCH = [{ label: 'ID expiry date', result: 'mismatch' }, { label: 'Date of birth', result: 'mismatch' }, { label: 'Name', result: 'match' }];

test('each lookup outcome names its specific issue: a title for the panel and the detail the agent acts on', () => {
  const issue = rec.idVerificationIssue;
  assert.deepEqual(issue({}), undefined, 'nothing wrong: no panel');
  assert.deepEqual(issue({ notFound: true }), { title: 'ID Not Found in MOI', detail: 'No MOI record found for this ID - try again.' });
  assert.deepEqual(issue({ linkProblem: 'This Passport is linked to another QID.' }), { title: 'ID Cannot Be Linked to a Customer', detail: 'This Passport is linked to another QID.' });
  assert.deepEqual(issue({ ownerMismatch: 'Aisha Al-Naimi' }), { title: 'ID Belongs to Another Customer', detail: 'This ID belongs to another customer. This journey is for Aisha Al-Naimi.' });
  const m = issue({ reconciliation: MISMATCH });
  assert.equal(m.title, 'Scanned ID Does Not Match MOI: ID expiry date, Date of birth', 'the title names every attribute that differs');
  assert.equal(m.detail, 'The scanned ID does not match the MOI record: ID expiry date, Date of birth. Check the card and try again.');
  assert.deepEqual(issue({ reconciliation: [{ label: 'Name', result: 'match' }] }), undefined, 'a reconciliation with no difference is not an error');
});

test('when several things are wrong the most specific is shown: link problem, then not found, then mismatch, then another owner', () => {
  const issue = rec.idVerificationIssue;
  assert.equal(issue({ linkProblem: 'x', notFound: true, reconciliation: MISMATCH, ownerMismatch: 'y' }).title, 'ID Cannot Be Linked to a Customer');
  assert.equal(issue({ notFound: true, reconciliation: MISMATCH, ownerMismatch: 'y' }).title, 'ID Not Found in MOI');
  assert.match(issue({ reconciliation: MISMATCH, ownerMismatch: 'y' }).title, /^Scanned ID Does Not Match MOI/);
  assert.equal(issue({ ownerMismatch: 'y' }).title, 'ID Belongs to Another Customer');
});

test('the ID step shows these as an error panel, and the number field keeps only its red border', () => {
  const step = fs.readFileSync('src/components/patterns/IdLookupStep.tsx', 'utf8');
  assert.match(step, /verificationIssue && \(\s*<ValidationStatus variant="business-failure" title=\{verificationIssue\.title\}>/);
  assert.match(step, /invalid=\{Boolean\(verificationIssue\)\}/);
  assert.doesNotMatch(step, /<QidNumberField[\s\S]*?\berror=/, 'no small red text under the number field');
  const field = fs.readFileSync('src/components/domain/QidInput.tsx', 'utf8');
  assert.match(field, /error \|\| invalid \? 'border-\[var\(--field-border-error\)\]'/);
});

test('every failed or pending check panel is the same card as an eligibility result: icon tile, bold title, full-strength body, border all round', () => {
  const status = fs.readFileSync('src/components/patterns/ValidationStatus.tsx', 'utf8');
  for (const [name, src] of [['ValidationStatus', status]]) {
    assert.match(src, /className=\{?[`"']eligibility-alert /, `${name} is built on the eligibility card`);
    assert.match(src, /eligibility-alert-icon/, `${name} has the icon tile`);
    assert.match(src, /title title-md/, `${name} has the bold title`);
    assert.doesNotMatch(src, /caps-strong/, `${name} has no label above the title`);
  }
  // Each validation state takes the matching result outcome.
  for (const [state, card] of [['success', 'pass'], ['business-failure', 'hard-stop'], ['technical', 'soft-stop'], ['retry', 'soft-stop'], ['pending', 'pending']]) {
    assert.match(status, new RegExp(`${state.includes('-') ? `'${state}'` : state}: \\{ card: 'eligibility-alert-${card}'`), `${state} -> ${card}`);
  }
  assert.match(uiComponentsCss(), /\.eligibility-alert-pending \{/);
});

test('an unsupported ID type is an error panel with a title and the context, not a bare line of red text', async () => {
  const src = fs.readFileSync('src/components/patterns/IdLookupStep.tsx', 'utf8');
  assert.match(src, /<ValidationStatus variant="business-failure" title=\{UNSUPPORTED_ID_TYPE_TITLE\}>/);
  assert.doesNotMatch(src, /ErrorBanner/);
  const ids = await load('/src/data/idTypes.ts');
  const detail = ids.unsupportedIdTypeDetail('Other ID');
  assert.match(detail, /This ID type is not supported\./);
  assert.match(detail, /Others \(Demo\) cannot be used to identify a customer\./);
  for (const t of ids.ID_TYPES.filter((x) => x.supported)) assert.ok(detail.includes(t.label), t.label);
  assert.ok(!detail.includes('Choose Others'), 'the unsupported type is not offered as an alternative');
});
