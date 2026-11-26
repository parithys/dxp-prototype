// The design system lives in dxp-ui (../dxp-ui-library), with its Storybook; this application keeps no Storybook and no reusable UI.
//
// 1. No Storybook here (folders, scripts, dependencies).
// 2. A component under src/components that needs nothing from the app - it imports only react, dxp-ui and other such files - is generic UI by
//    construction, and belongs in the library. It may stay only if it is keyed to this product's own data and is listed in KEEP_IN_APP with the reason.
//    A new generic component therefore fails here until it is built in the library (develop it there, `npm run dev:app`), or is listed with a reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const KEEP_IN_APP = {
  'src/components/domain/IdFileUpload.tsx': 'identity-document upload: ID wording and the QID / passport rules',
  'src/components/patterns/BulkOperationPortal.tsx': 'billing-profile bulk operation: its columns are this product\'s billing fields',
  'src/components/patterns/CafPaperPanel.tsx': 'Sign on Paper for the CAF: this product\'s document and wording',
  'src/components/patterns/DiscountCard.tsx': 'a discount offer card: the offer model is this product\'s',
  'src/components/patterns/PlanGroupPanel.tsx': 'a plan group: the plan catalogue is this product\'s',
  'src/components/patterns/PlanSearchBox.tsx': 'plan search: typed to the plan catalogue and QAR',
  'src/components/patterns/PlanTabStrip.tsx': 'plan group tabs: typed to the plan catalogue',
  'src/components/patterns/PostpaidDiscountsPanel.tsx': 'postpaid discounts: this product\'s discount rules',
  'src/components/patterns/PostpaidPlanCard.tsx': 'a postpaid plan card',
  'src/components/patterns/PrepaidPackDetailsDrawer.tsx': 'prepaid pack details',
  'src/components/patterns/PrepaidPlanCard.tsx': 'a prepaid plan card',
  'src/components/patterns/RestrictedRowsNotice.tsx': 'the restricted-customer notice: this product\'s access rule',
  'src/components/patterns/SimSwapFormStep.tsx': 'the SIM swap form step',
  'src/components/primitives/ConnectionTypeTag.tsx': 'keyed to this product\'s service categories (Postpaid, Prepaid, GigaHome ...)',
  'src/components/primitives/ServiceTypeTag.tsx': 'keyed to this product\'s service types (new-postpaid, mnp-prepaid ...)',
  'src/components/primitives/offerCardParts.tsx': 'the selected-plan figure: plan wording over the library\'s card marks',
};

const read = (f) => fs.readFileSync(f, 'utf8');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

test('this application has no Storybook', () => {
  for (const d of ['storybook', '.storybook', 'storybook-static', 'vitest.config.ts', 'tsconfig.storybook.json']) assert.equal(fs.existsSync(d), false, `${d} belongs in dxp-ui-library`);
  const pkg = JSON.parse(read('package.json'));
  const all = { ...pkg.scripts, ...pkg.dependencies, ...pkg.devDependencies };
  assert.deepEqual(Object.keys(all).filter((k) => /storybook|vitest/i.test(k) || /storybook/i.test(String(all[k]))), []);
});

const OWN = ['src/components', 'src/lib', 'src/hooks'];
const files = OWN.flatMap((d) => walk(d)).filter((f) => /\.tsx?$/.test(f));
const resolve = (from, spec) => {
  const base = path.normalize(path.join(path.dirname(from), spec));
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((e) => base + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
};
const memo = new Map();
function independent(f, seen = new Set()) {
  if (memo.has(f)) return memo.get(f);
  if (seen.has(f)) return true;
  seen.add(f);
  let ok = true;
  for (const m of strip(read(f)).matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)) {
    const spec = m[1] ?? m[2];
    if (!spec.startsWith('.')) {
      if (spec !== 'dxp-ui' && !/^react(\/|$)/.test(spec)) ok = false;
      continue;
    }
    const r = resolve(f, spec);
    if (!r || !OWN.some((d) => r.startsWith(d + path.sep)) || !independent(r, seen)) ok = false;
  }
  memo.set(f, ok);
  return ok;
}

test('a component that needs nothing from the app is built in dxp-ui, unless it is keyed to this product and listed with a reason', () => {
  const generic = files.filter((f) => f.endsWith('.tsx') && independent(f)).sort();
  assert.deepEqual(generic.filter((f) => !KEEP_IN_APP[f]), [], 'generic UI: build it in ../dxp-ui-library (see its README, "Promote a component"), or list it in KEEP_IN_APP with the reason it is this product\'s');
});

test('KEEP_IN_APP has no stale entries', () => {
  const generic = new Set(files.filter((f) => f.endsWith('.tsx') && independent(f)));
  assert.deepEqual(Object.keys(KEEP_IN_APP).filter((f) => !fs.existsSync(f) || !generic.has(f)), [], 'a file that is gone, or that now uses the app, is no longer a keep-in-app exception');
  for (const [f, why] of Object.entries(KEEP_IN_APP)) assert.ok(why.length > 15, `${f}: give a reason`);
});
