// The Pagination capability: ONE definition of paging (page maths, summary, pager, hook), used by every paged list. The maths is checked against a
// table written by hand; the "single source of truth" claim is checked against the import graph and the source, not asserted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// The page maths, the bar and the Pager are tested in the library (dxp-ui-library/tests/pagination.test.mjs).

// ---- single source of truth, read from the source ----
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : []));
const files = walk('src');
const read = (f) => fs.readFileSync(f, 'utf8');

test('the capability is registered, exported from the barrel, previewable, and its implementation is the library', () => {
  const reg = JSON.parse(read('src/capabilities/registry.json'));
  const entry = reg.find((c) => c.id === 'pagination');
  assert.ok(entry, 'registry entry');
  assert.equal(entry.entry, 'Pagination');
  assert.match(read('src/capabilities/index.ts'), /export \* from '\.\/Pagination'/);
  assert.match(read('src/capabilities/previews.tsx'), /pagination: \(\) => <PaginationDemo \/>/);
  assert.match(read('src/capabilities/Pagination/index.ts'), /from 'dxp-ui'/);
});

test('the numbered Pager control is used by the Pagination capability only: no list builds its own pager', () => {
  const importers = files.filter((f) => /(?:import|export) \{[^}]*\bPager\b[^}]*\} from 'dxp-ui'/.test(read(f)));
  assert.deepEqual(importers.map((f) => f.replace(/\\/g, '/')).sort(), ['src/capabilities/Pagination/index.ts']);
});

test('no screen hand-rolls paging: no own Previous/Next buttons, no own "Showing a-b" or "Page a of b" text, no own page-number buttons, no own page maths', () => {
  const own = [];
  for (const f of files) {
    const s = read(f);
    if (/>\s*(Previous|Next)\s*<\/(Button|button)>/.test(s)) own.push(`${f}: own Previous/Next`);
    if (/Showing \{[^}]*\}\s*(-|–|&ndash;)/.test(s)) own.push(`${f}: own "Showing a-b" text`);
    if (/Page \{[^}]*\} of \{/.test(s)) own.push(`${f}: own "Page a of b" text`);
    if (/Array\.from\(\{ length: pages? \}/.test(s)) own.push(`${f}: own page-number buttons`);
    if (/Math\.ceil\([^)]*\/\s*(pageSize|PAGE|PAGE_SIZE|AUDIT_PAGE|FREE_PAGE_SIZE)\)/.test(s)) own.push(`${f}: own page-count maths`);
  }
  assert.deepEqual(own, []);
});

test('the paged lists use the capability: number picker, Customer 360 and Telesales', () => {
  const uses = {
    'src/components/domain/MsisdnPicker.tsx': /<Pagination page=\{safePage \+ 1\} total=\{filtered\.length\} pageSize=\{pageSize\}/,
    'src/workspace/customer360/sections/C360Activities.tsx': /<Pagination /,
    'src/workspace/customer360/sections/C360AlertsRisks.tsx': /<Pagination /,
    'src/workspace/customer360/sections/C360Orders.tsx': /<Pagination /,
    'src/workspace/customer360/telesales/TelesalesOrdersTicketsSection.tsx': /<Pagination /,
    'src/workspace/customer360/telesales/TelesalesAuditSection.tsx': /<Pagination /,
  };
  for (const [f, rx] of Object.entries(uses)) assert.match(read(f), rx, f);
  // Journeys and workspaces reach it through the barrel; the layers below (components) import the primitive directly.
  assert.match(read('src/workspace/customer360/sections/c360KitModel.ts'), /usePagination as usePaging.*'\.\.\/\.\.\/\.\.\/capabilities'/);
});
