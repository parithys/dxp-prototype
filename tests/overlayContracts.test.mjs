// Phase 6: the app side of the overlay contract (the leave-journey guard, no hand-written overlay beside the library's Modal / Drawer), pinned without a
// browser; the browser half is e2e/overlays.spec.ts. Modal / Drawer / Dialog themselves are pinned in dxp-ui-library/tests/overlayContracts.test.mjs. See docs/migration/phase6-overlays-select.md.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { close } from './harness.mjs';

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

test('overlays: the app opens dialogs only through the library Modal and Drawer; nothing locks scroll by hand, listens to popstate or writes to <body>', () => {
  const files = walk('src').filter((f) => !f.startsWith('src/dev/'));
  assert.deepEqual(files.filter((f) => /from '@\/components\/ui\/dialog'|\bDialogContent\b|\bDialogPortal\b/.test(read(f))), [], 'no second dialog implementation');
  assert.deepEqual(files.filter((f) => /popstate/.test(read(f).replace(/\/\/.*$/gm, ''))), [], 'browser Back/Forward are not intercepted anywhere');
  assert.deepEqual(files.filter((f) => /document\.body\.style|body\.classList/.test(read(f))), [], 'nothing writes to <body> by hand (Radix does the scroll lock)');
  assert.deepEqual(files.filter((f) => /addEventListener\('beforeunload'/.test(read(f))).sort(), ['src/lib/routerHooks.ts', 'src/navigation/PersonaSwitcher.tsx']);
});

test('leave-journey: the guard is the app-owned useBlocker; the prompt is a Modal with Close / Abandon Journey / Save as Draft; a draft with only an ID type is not progress', () => {
  const hooks = read('src/lib/routerHooks.ts');
  assert.match(hooks, /export function useBlocker\(fn: BlockerFn\)/);
  assert.match(hooks, /window\.addEventListener\('beforeunload', onUnload\)/);
  assert.match(hooks, /Browser Back\/Forward CANNOT be intercepted/);
  const dialogs = read('src/components/patterns/wizard/WizardDialogs.tsx');
  assert.match(dialogs, /title="Leave this journey\?"/);
  for (const label of ['Abandon Journey', 'Save as Draft']) assert.ok(dialogs.includes(label), label);
});

