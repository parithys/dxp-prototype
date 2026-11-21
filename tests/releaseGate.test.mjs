// Keeps docs/migration/release-gate.md honest: the matrix lists every installed shadcn component's family, uses only the allowed vocabulary,
// and a family is COMPLETE only when every gate is PASS (or NOT APPLICABLE with a reason in the table of exceptions).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const doc = fs.readFileSync('docs/migration/release-gate.md', 'utf8');
const section = (title) => doc.slice(doc.indexOf(title), doc.indexOf('\n## ', doc.indexOf(title) + 5) === -1 ? undefined : doc.indexOf('\n## ', doc.indexOf(title) + 5));
const tableRows = (md) => md.split('\n').filter((l) => l.startsWith('|') && !/^\|[-| ]+\|$/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const matrix = tableRows(section('## 2. Release-gate matrix').split('### Every FAIL')[0]);
const [header, ...rows] = matrix;
const GATES = header.slice(1, -1);
const ALLOWED = new Set(['PASS', 'FAIL', 'BLOCKED', 'NOT APPLICABLE', 'NOT RUN']);

test('the matrix has every mandatory gate as a column and a row per migrated family', () => {
  for (const g of ['Visual', 'Functional', 'A11y', 'Desktop', 'Tablet', 'Mobile', 'Dark', 'Type check', 'Lint', 'Unit', 'Integration', 'E2E', 'Visual regression', 'Build', 'No duplicate systems', 'Independent rollback']) assert.ok(GATES.includes(g), g);
  const families = rows.map((r) => r[0]);
  for (const f of ['Foundation', 'Label', 'Card', 'Checkbox', 'Button', 'Standard inputs', 'Tabs', 'Dialog (Modal / Drawer)', 'Accessibility tokens']) assert.ok(families.includes(f), f);
});

test('every installed shadcn component belongs to a family in the matrix or is declared out of scope', () => {
  const owner = { button: 'Button', card: 'Card', checkbox: 'Checkbox', dialog: 'Dialog', input: 'Standard inputs', label: 'Label', tabs: 'Tabs', textarea: 'Standard inputs' };
  const outOfScope = { 'dropdown-menu': /Dropdown Menu/ };
  for (const f of fs.readdirSync('node_modules/dxp-ui/dist/components/ui').filter((x) => x.endsWith('.d.ts')).map((x) => x.replace(/\.d\.ts$/, ''))) {
    if (owner[f]) assert.ok(rows.some((r) => r[0].startsWith(owner[f])), `${f} -> ${owner[f]}`);
    else assert.match(doc, outOfScope[f] ?? /$^/, `${f} is neither in the matrix nor declared out of scope`);
  }
});

test('only the allowed values are used, and a status is never ambiguous', () => {
  for (const r of rows) {
    for (const v of r.slice(1, -1)) assert.ok(ALLOWED.has(v), `${r[0]}: "${v}"`);
    assert.ok(['COMPLETE', 'INCOMPLETE', 'BLOCKED'].includes(r.at(-1)), `${r[0]} overall`);
  }
  assert.doesNotMatch(doc, /mostly complete|nearly done|looks fine|expected to pass|should work|probably safe/i);
});

test('COMPLETE means every gate PASS; any FAIL is INCOMPLETE; a BLOCKED gate (and no FAIL) is BLOCKED; every non-PASS gate is explained', () => {
  const exceptions = section('### Every FAIL');
  for (const r of rows) {
    const gates = r.slice(1, -1);
    const overall = r.at(-1);
    const expected = gates.some((g) => g === 'FAIL' || g === 'NOT RUN') ? 'INCOMPLETE' : gates.includes('BLOCKED') ? 'BLOCKED' : 'COMPLETE';
    assert.equal(overall, expected, r[0]);
    gates.forEach((g, i) => { if (g !== 'PASS') assert.ok(exceptions.includes(GATES[i]) || exceptions.includes(g), `${r[0]} / ${GATES[i]} = ${g} has no explanation`); });
  }
});

test('the evidence the matrix cites exists: the commands, the specs and the test files', () => {
  for (const f of ['e2e/a11y.spec.ts', 'e2e/tabs.spec.ts', 'e2e/overlays.spec.ts', 'e2e/checkbox.spec.ts', 'e2e/button.spec.ts', 'e2e/input.spec.ts', 'e2e/protected.spec.ts', 'e2e/sweep.spec.ts', 'tests/styling.test.mjs', 'tests/overlayContracts.test.mjs', 'tests/protectedComponents.test.mjs']) assert.ok(fs.existsSync(f), f);
  assert.match(doc, /npx tsc -b/);
  assert.match(doc, /npm run build/);
});
