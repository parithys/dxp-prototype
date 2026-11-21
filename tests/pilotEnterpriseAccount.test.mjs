// Phase 3 pilot: the Enterprise Account Creation credit-limit approval (Card + Label + Checkbox) now uses the themed shadcn/ui primitives.
// Pinned here: the checked -> boolean mapping the screen keeps; the markup contract of Card + Label + Checkbox is pinned in the library
// (dxp-ui-library/tests/pilotEnterpriseAccount.test.mjs). Runtime parity (geometry, colours,
// label click, the create flow, dark and tablet) was measured live: docs/baseline/phase3/pilot-report.md.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { close } from './harness.mjs';

const read = (f) => fs.readFileSync(f, 'utf8');
const SCREEN = 'src/modules/enterprise-iot-b2b/screens/EnterpriseAccountCreation.tsx';
after(close);

const walk = (d, out = []) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
};

test('pilot screen: Radix reports a boolean through onCheckedChange and the screen maps it straight to its own state', () => {
  const src = read(SCREEN);
  for (const name of ['Card', 'Checkbox', 'Label']) assert.match(src, new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from 'dxp-ui'`), name);
  assert.doesNotMatch(src, /primitives\/Checkbox/);
  assert.match(src, /onCheckedChange=\{\(checked\) => setFinanceApproved\(checked === true\)\}/, "'indeterminate' can never mean approved");
  assert.doesNotMatch(src, /<label /, 'no leftover hand-rolled label');
  // The logic around the control is untouched.
  assert.match(src, /evaluateRule\('BR-ENTERPRISE-CREDIT-LIMIT-APPROVAL', \{ approved: financeApproved \}\)/);
  assert.match(src, /\(!creditLimit \|\| approvalResult\.pass\)/);
  assert.match(src, /\{!approvalResult\.pass && <p className="text-danger text-\[length:var\(--fs-caption\)\] mt-2">\{approvalResult\.message\}<\/p>\}/);
  assert.match(src, /navigate\('\/enterprise-iot-b2b'\)/);
});

test('scope: the shadcn components are the library\'s - nothing is imported from a local components/ui', () => {
  for (const f of walk('src').filter((x) => !x.startsWith('src/dev/'))) assert.doesNotMatch(read(f), /from '@\/components\/ui\//, f);
});
