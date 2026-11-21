// Phase 5: the specialised components the shadcn/ui migration must not replace (docs/migration/phase5-specialised-components.md). The design-system ones
// (Select, PhoneNumberInput, SignaturePad, DataTable, Tooltip) live in the library and are pinned in dxp-ui-library/tests/protectedComponents.test.mjs;
// here: the app-owned ones (QidInput, notifications) and the rule that the app never re-implements a protected component or adds a second system.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load, close } from './harness.mjs';

const h = React.createElement;
const html = renderToStaticMarkup;
const read = (f) => fs.readFileSync(f, 'utf8');
after(close);

const walk = (d, out = []) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p.split(path.sep).join('/'));
  }
  return out;
};

// ---- the protected set -----------------------------------------------------------------------------------------------------------------------
const PROTECTED = {
  'src/components/domain/QidInput.tsx': 'QidInput',
  'src/stores/notificationSlice.ts': 'notification slice',
  'src/capabilities/Toasts/Toast.tsx': 'ToastContainer',
};

test('every protected component carries its PROTECTED marker, so replacing one is a deliberate act with a paper trail', () => {
  for (const f of Object.keys(PROTECTED)) {
    assert.match(read(f), /PROTECTED \(docs\/migration\/phase5-specialised-components\.md\)/, f);
  }
});

// ---- QidInput --------------------------------------------------------------------------------------------------------------------------------
test('QidInput: the number field follows the chosen ID type (label, keypad, placeholder), a scanned number is read-only and out of the tab order, Fetch is explicit', async () => {
  const { QidNumberField, QidTypeSelector } = await load('/src/components/domain/QidInput.tsx');
  const { ID_TYPES } = await load('/src/data/idTypes.ts');
  const byType = Object.fromEntries(ID_TYPES.map((t) => [t.type, t]));
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The expectation is written here, independent of the component: which types are digits-only.
  assert.deepEqual(ID_TYPES.filter((t) => t.numericNumber).map((t) => t.type).sort(), ['GCC ID', 'QID']); // a Diplomatic ID number has letters (DIP-QA-...)
  const field = (idType, extra = {}) => html(h(QidNumberField, { idType, value: '', onChange() {}, onFetch() {}, ...extra }));
  assert.match(field('QID'), /inputMode="numeric"/);
  assert.match(field('Passport'), /inputMode="text"/);
  assert.match(field('QID'), new RegExp(`>${esc(byType.QID.numberLabel)}</label>`));
  assert.match(field('QID'), new RegExp(`placeholder="${esc(byType.QID.placeholder)}"`));
  const scanned = field('QID', { value: '28456701234', readOnly: true });
  assert.match(scanned, /readOnly=""/);
  assert.match(scanned, /tabindex="-1"/);
  assert.doesNotMatch(scanned, /Fetch/, 'a scanned number triggers its own lookup: no Fetch');
  assert.match(field('QID'), /Fetch/, 'an editable number has Fetch');
  assert.match(field('QID', { readOnly: true, showFetch: true }), /Fetch/, 'unless the owner asks for it on a scanned number');
  assert.match(field('QID', { value: '1' }), /<button[^>]*type="button"/);
  const sel = html(h(QidTypeSelector, { idType: 'QID', onIdTypeChange() {}, allowedTypes: ['QID', 'Diplomatic ID'], unavailableTypes: ['Passport'], unavailableHint: 'Closed' }));
  assert.match(sel, /aria-pressed="true"/);
  assert.match(sel, /aria-disabled="true"/, 'an unavailable type is shown, greyed, not omitted');
  assert.match(sel, /Closed/);
});

test('Tooltip: the app uses the library tooltip (one system, no local copy) in many places', () => {
  const users = walk('src').filter((f) => /<Tooltip\b/.test(read(f)));
  assert.ok(users.length >= 15, `the app tooltip is used in ${users.length} files`);
  assert.ok(users.every((f) => /import \{[^}]*\bTooltip\b[^}]*\} from '(dxp-ui|[./]+\/[\w/]*)'/.test(read(f))), 'every user imports it');
});

// ---- notification system ---------------------------------------------------------------------------------------------------------------------
test('notifications: the Redux slice queues, replaces a keyed re-push (same id), caps history, dismisses, purges - and the container announces by kind', async () => {
  const { notificationReducer, notificationInitialState, notificationActions } = await load('/src/stores/notificationSlice.ts');
  let state = notificationInitialState;
  const getState = () => ({ notification: state });
  const dispatch = (a) => (typeof a === 'function' ? a(dispatch, getState) : void (state = notificationReducer(state, a)));
  dispatch(notificationActions.pushToast('success', 'Saved'));
  dispatch(notificationActions.pushToast('error', 'Failed', { detail: 'Try again' }));
  assert.deepEqual(state.toasts.map((t) => t.kind), ['success', 'error']);
  assert.equal(state.history.length, 2);
  dispatch(notificationActions.pushToast('info', 'Ticket 1', { key: 'ticket' }));
  const id = state.toasts.find((t) => t.key === 'ticket').id;
  dispatch(notificationActions.pushToast('info', 'Ticket 1 again', { key: 'ticket' }));
  assert.equal(state.toasts.filter((t) => t.key === 'ticket').length, 1, 'a keyed re-push replaces, it does not append');
  assert.equal(state.toasts.find((t) => t.key === 'ticket').id, id, 'and keeps the id, so the element does not flicker');
  assert.equal(state.history.filter((h) => h.key === 'ticket').length, 1);
  dispatch(notificationActions.dismissToast(state.toasts[0].id));
  assert.equal(state.toasts.length, 2);
  dispatch(notificationActions.dismissAllToasts());
  assert.equal(state.toasts.length, 0);
  assert.ok(state.history.length >= 3, 'the bell keeps what was dismissed');
  dispatch(notificationActions.markAllRead());
  assert.ok(state.history.every((h) => h.read));
  for (let i = 0; i < 40; i++) dispatch(notificationActions.pushToast('info', `n${i}`));
  assert.equal(state.history.length, 30, 'history is capped');
  dispatch(notificationActions.pushToast('info', 'Call Fatima Al-Kuwari'));
  dispatch(notificationActions.purgeMentioning(['fatima']));
  assert.ok(!state.toasts.some((t) => /Fatima/.test(t.message)) && !state.history.some((x) => /Fatima/.test(x.message)));
  const src = read('src/capabilities/Toasts/Toast.tsx');
  assert.match(src, /role=\{t\.kind === 'error' \? 'alert' : 'status'\}/);
  assert.match(src, /aria-live=\{t\.kind === 'error' \? 'assertive' : 'polite'\}/);
});

// ---- what Phase 4 did to the protected components -------------------------------------------------------------------------------------------
test('Phase 4 only let QidInput consume the migrated Button; its logic is untouched, and the notification code composes no shadcn primitive', () => {
  assert.match(read('src/components/domain/QidInput.tsx'), /import \{[^}]*\bButton\b[^}]*\} from 'dxp-ui'/);
  for (const f of ['src/stores/notificationSlice.ts', 'src/capabilities/Toasts/Toast.tsx']) {
    assert.doesNotMatch(read(f), /components\/ui\//, `${f} composes no shadcn primitive`);
  }
});

// ---- governance: no second system, no local copy of a library component ----------------------------------------------------------------------
const SRC = () => walk('src').filter((f) => !f.startsWith('src/dev/'));
const PROTECTED_LIB = ['Select', 'PhoneNumberInput', 'SignaturePad', 'DataTable', 'Tooltip'];

test('governance: the app does not re-implement a protected library component (no local Select, PhoneNumberInput, SignaturePad, DataTable or Tooltip)', () => {
  const def = new RegExp(`(?:export\\s+)?(?:default\\s+)?(?:function|const|class)\\s+(?:${PROTECTED_LIB.join('|')})\\b`);
  assert.deepEqual(SRC().filter((f) => def.test(read(f))), []);
  assert.deepEqual(SRC().filter((f) => new RegExp(`(?:${PROTECTED_LIB.join('|')})\\.tsx?$`).test(f)), [], 'no file named for a protected component');
});

test('governance: no shadcn Select, Tooltip, Toast/Sonner or Dropdown is imported by the application, and the application carries no shadcn copy of its own', () => {
  const banned = /from ['"]@\/components\/ui\/(select|tooltip|sonner|toast|dropdown-menu|table|command|combobox|popover)['"]/;
  assert.deepEqual(SRC().filter((f) => banned.test(read(f))), []);
  assert.deepEqual(SRC().filter((f) => /import \{[^}]*\b(?:DropdownMenu\w*)\b[^}]*\} from 'dxp-ui'/.test(read(f))), [], 'the stock Dropdown Menu is unused');
  assert.ok(!fs.existsSync('src/components/ui'), 'the shadcn components live in the library');
});

test('governance: one notification system, one tooltip system, one table, one signature canvas', () => {
  const files = SRC();
  const offenders = (re) => files.filter((f) => re.test(read(f)));
  assert.deepEqual(offenders(/from ['"]sonner['"]|<Toaster\b|@radix-ui\/react-toast/), [], 'no second toast system');
  assert.deepEqual(offenders(/<TooltipProvider\b|@radix-ui\/react-tooltip|from ['"]radix-ui['"][^;]*Tooltip/), [], 'no second tooltip provider');
  assert.equal(files.filter((f) => /<ToastContainer\b/.test(read(f))).length, 1, 'ToastContainer is mounted once');
  assert.deepEqual(offenders(/@tanstack\/react-table/), [], 'no second table engine');
  assert.deepEqual(files.filter((f) => /<canvas\b/.test(read(f))), [], 'no canvas in the app: the signature pad is the library\'s');
});
