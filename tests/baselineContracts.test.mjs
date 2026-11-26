// The app side of the behavioural BASELINE (Phase 2 of the shadcn/ui migration): characterisation tests that pin what the application does today - including
// where that falls short - so a later component replacement shows up as a failing assertion instead of a silent change. These describe the
// current behaviour, not the ideal one; a defect recorded here is recorded, not endorsed (docs/baseline/phase2-behaviour-baseline.md lists them).
// Runtime behaviour (focus, keyboard, overlays, the leave prompt in a real browser) was observed live and is written up in that report; what can be
// asserted without a browser is asserted here, from the rendered markup and the source that implements it. The design-system half (component
// ARIA contracts, overlays, tokens, device rules) is in dxp-ui-library/tests/baselineContracts.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { load, close } from './harness.mjs';
import { tokensCss } from './libPaths.mjs';

const read = (f) => fs.readFileSync(f, 'utf8');
after(close);

let policy;
before(async () => {
  policy = await load('/src/auth/passwordPolicy.ts');
});

test('leave-warning baseline: asked only for an in-app change of PATH while the draft has unsaved progress (not for ID-type-only, not in the customer pop-up, not when the journey opts out); the three choices are Close (stay), Abandon Journey, Save as Draft', async () => {
  const wiz = read('src/capabilities/GuidedActivationWizard/GuidedActivationWizard.tsx');
  assert.match(wiz, /if \(!confirmLeave \|\| isMirror \|\| currentLocation\.pathname === nextLocation\.pathname\) return false;\s*return draftNeedsSaving/);
  const dialogs = read('node_modules/dxp-ui/dist/index.js');
  assert.match(dialogs, /title: "Leave this journey\?"/);
  assert.match(dialogs, /Abandon Journey/);
  assert.match(dialogs, /Save as Draft/);
  const wf = await load('/src/stores/workflowSlice.ts');
  assert.equal(wf.draftHasProgress({ currentStep: 0, maxStepReached: 0, values: { contact: { idType: 'QID', idNumber: '' } } }), false, 'an ID type alone is not progress');
  assert.equal(wf.draftHasProgress({ currentStep: 0, maxStepReached: 0, values: { contact: { idType: 'QID', idNumber: '29303051200106' } } }), true);
  assert.equal(wf.draftNeedsSaving({ currentStep: 2, maxStepReached: 2, values: {}, savedSnapshot: JSON.stringify([2, {}]) }), false, 'saved: nothing unsaved');
});

test('leave-warning baseline: the guard covers navigate(), Link and search-param changes plus the browser\'s own prompt on reload/close - and NOT the browser Back/Forward buttons (a documented App Router gap)', () => {
  const hooks = read('src/lib/routerHooks.ts');
  assert.match(hooks, /runBlockers\(url, go\)/);
  assert.match(hooks, /window\.addEventListener\('beforeunload', onUnload\)/);
  assert.match(hooks, /e\.preventDefault\(\);\s*e\.returnValue = ''/);
  assert.match(hooks, /Browser Back\/Forward and reload CANNOT be intercepted|Browser Back\/Forward CANNOT be intercepted/);
  assert.match(hooks, /A replace that only consumes state is never a departure/);
  assert.match(read('src/lib/routerLinks.tsx'), /navigate\(to, \{ replace, state \}\)/, 'Link goes through navigate and so through the blockers');
});

test('device baseline: the app sets data-device="tablet" on <html> from the library\'s device detection', () => {
  assert.match(read('src/next/AppFrame.tsx'), /detectDeviceType\(\) === 'tablet'\) document\.documentElement\.dataset\.device = 'tablet'/);
});

test('tablet baseline: the tertiary link and pager get the touch target on [data-device=tablet]', () => {
  assert.match(tokensCss(), /--touch-target: 2\.75rem;/);
  const tablet = read('src/tablet.css');
  assert.match(tablet, /\[data-device='tablet'\] \.btn-tertiary \{|\[data-device='tablet'\] \.btn-tertiary,?/);
  assert.match(tablet, /min-height: var\(--touch-target\)/);
});

test('responsive baseline: no custom --breakpoint-* in the app; the brand panel and the queue need >= 1024px AND a pointer device', () => {
  assert.doesNotMatch(read('src/index.css') + read('src/app-components.css') + tokensCss(), /--breakpoint-/);
  assert.match(read('src/auth/LoginPage.tsx'), /useMinWidth\(1024\) && detectDeviceType\(\) === 'web'/);
});

test('validation baseline: the password policy messages and their order; login and customer-search messages', () => {
  assert.equal(policy.passwordPolicyError('abc'), 'Password must be at least 8 characters.');
  assert.equal(policy.passwordPolicyError('abcdefgh'), 'Password must include at least one number.');
  assert.equal(policy.passwordPolicyError('12345678'), 'Password must include at least one letter.');
  assert.equal(policy.passwordPolicyError('abcd1234'), null);
  const login = read('src/auth/LoginPage.tsx');
  assert.match(login, /setLoginError\('Enter your Staff ID and password\.'\)/);
  assert.match(login, /setLoginError\('Staff ID not recognised\.'\)/);
  const profile = read('src/workspace/profile/AgentProfileWorkspace.tsx');
  // submit-time, first failure wins: current password, then the code, then the policy, then the confirmation
  const order = ['Current password is incorrect.', 'Invalid or expired verification code.', 'policyError', 'New password and confirmation do not match.'].map((s) => profile.indexOf(s, profile.indexOf('const submitPasswordChange')));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(order.every((i) => i > 0));
  assert.match(profile, /disabled=\{!currentPassword \|\| !newPassword \|\| !confirmPassword \|\| !verificationCode\}/, 'Save is disabled until all four are filled; nothing is validated before submit');
  // Was a characterisation of a recorded gap (a loose paragraph, nothing tied to a field). Fixed: each error is the failing field's own `error` prop
  // (aria-invalid, aria-describedby, role=alert via the Input composite); a browser check in e2e/a11y.spec.ts covers the result.
  assert.doesNotMatch(profile, /\{error && <p /, 'no loose error paragraph');
  assert.match(profile, /error=\{error\?\.field === 'current' \? error\.message : undefined\}/, 'the current-password error belongs to its field');
});

test('page baseline: a skip link to #main-content (the focus target, tabIndex=-1), a polite sr-only route announcer, <html lang="en">, the page title set per route', () => {
  const app = read('src/App.tsx');
  assert.match(app, /className="no-print skip-link"/);
  assert.match(app, /document\.getElementById\(MAIN_ID\)\?\.focus\(\)/);
  assert.match(app, /<main id=\{MAIN_ID\} tabIndex=\{-1\}/);
  assert.match(app, /role="status" aria-live="polite"/);
  assert.match(read('app/layout.tsx'), /<html lang="en">/);
  assert.match(read('src/navigation/useRouteAnnouncer.ts'), /document\.title/);
});

test('every screenshot in the baseline is named <screen>--<viewport>--<theme>--<state> and is listed in the report', () => {
  const dir = 'docs/baseline/screenshots';
  const report = read('docs/baseline/phase2-behaviour-baseline.md');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg'));
  assert.ok(files.length >= 30);
  for (const f of files) {
    assert.match(f, /^[a-z0-9-]+--(?:desktop|tablet|mobile)-\d+x\d+--(?:light|dark)--[a-z0-9-]+\.jpg$/, f);
    assert.ok(report.includes(f), `${f} is not in the report`);
    assert.ok(fs.statSync(path.join(dir, f)).size > 2000, `${f} is empty`);
  }
});
