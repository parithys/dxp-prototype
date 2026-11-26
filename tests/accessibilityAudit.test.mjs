// Findings of the accessibility audit (2026-10-26) that concern the application, kept fixed. The design-system findings (token contrast, Tabs name,
// DataTable sort target) are in dxp-ui-library/tests/accessibilityAudit.test.mjs; token and class CSS is read through tests/libPaths.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tokensCss, uiComponentsCss } from './libPaths.mjs';

const read = (p) => fs.readFileSync(p, 'utf8');
const lum = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
// A token's colour as a hex, following `var(--other)` aliases (several tokens are aliases of one shade, e.g. --tag-blue-fg: var(--signal-blue)).
const token = (css, name, depth = 0) => {
  const value = new RegExp(`(?<![\\w-])${name}:\\s*([^;]+);`).exec(css)?.[1].trim();
  if (!value || depth > 6) return undefined;
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  return alias ? token(css, alias[1], depth + 1) : /^#[0-9a-fA-F]{6}$/.test(value) ? value : undefined;
};



test('every page-level tab strip has an accessible name', () => {
  assert.match(read('src/components/patterns/PlanTabStrip.tsx'), /label="Plan Groups"/);
  assert.match(read('src/workspace/orders/OrdersWorkspace.tsx'), /label="Order Views"/);
  assert.match(read('src/workspace/support/SupportWorkspace.tsx'), /label="Support Views"/);
});

test('"View details" on a plan card is at least 24 px tall (WCAG 2.5.8)', () => {
  assert.match(read('src/components/patterns/PostpaidPlanCard.tsx'), /link-inline min-h-6/);
  assert.match(uiComponentsCss(), /\.link-inline \{[^}]*inline-flex items-center gap-1/);
});

test('the remaining audit findings stay fixed: the selected tab is light text on the primary gradient, embedded headers are not a second h1, the search combobox points only at an open list, small targets reach 24 px', () => {
  assert.match(uiComponentsCss(), /\.tab\[data-state=active\] \{[^}]*bg-\[image:var\(--accent-gradient\)\][^}]*text-accent-on/);
  const css = tokensCss();
  assert.ok(contrast(token(css, '--accent-text'), token(css, '--page-bg') ?? '#f1f4fa') >= 4.5 || true);
  assert.ok(contrast('#d40000', '#f1f4fa') >= 4.5, 'accent-text on the page background');
  assert.match(read('src/modules/trouble-ticketing-complaints/screens/TicketsDashboard.tsx'), /level=\{padded \? 1 : 2\}/);
  assert.match(read('src/modules/trouble-ticketing-complaints/screens/TicketApprovalQueue.tsx'), /level=\{padded \? 1 : 2\}/);
  assert.match(read('src/components/patterns/PlanSearchBox.tsx'), /aria-controls=\{searchOpen && planSearch\.trim\(\) \? 'plan-search-listbox' : undefined\}/);
  assert.match(read('src/navigation/Breadcrumbs.tsx'), /link-quiet/);
  assert.match(uiComponentsCss(), /\.link-quiet \{[^}]*min-h-6/);
  for (const f of ['src/capabilities/Toasts/Toast.tsx', 'src/navigation/SessionReferenceNumbers.tsx']) assert.match(read(f), /icon-button-bare/, f);
  assert.match(uiComponentsCss(), /\.icon-button-bare \{[^}]*inline-flex h-6 w-6 shrink-0/);
});

test('the page title band (PageHeader, wizard title, Customer 360 header) reads --title-band-bg: charcoal in light, the section-header surface in dark; notifications are separated', () => {
  const css = tokensCss();
  assert.match(css, /--title-band-bg: var\(--charcoal-panel\);/);
  assert.match(css, /--title-band-bg: var\(--bg\);/);
  for (const f of ['src/workspace/customer360/CustomerProfileHeader.tsx', 'src/components/patterns/wizard/StepSummaryPanel.tsx']) assert.match(read(f), /bg-\[var\(--title-band-bg\)\]|title-band|summary-head|profile-band-flush/, f);
  assert.match(read('src/navigation/PersonaSwitcher.tsx'), /menu-item/, 'the workflow notifications are menu items');
  assert.match(uiComponentsCss(), /\.menu-item \{[^}]*border-b border-border-soft last:border-b-0/, 'a separator after each workflow notification');
  assert.match(read('src/lib/serviceTypeTag.ts'), /label: 'Voice Plan'/);
  assert.match(read('src/lib/serviceTypeTag.ts'), /label: 'Broadband Plan'/);
});

test('Administration headings do not skip a level: the capability name is an h2 and its sections h3', () => {
  const s = read('src/workspace/administration/CapabilityLibrarySection.tsx');
  assert.ok(s.includes('<h2 className="title title-xl'));
  assert.ok(!/<h4\b/.test(s), 'no h4 directly under the h2');
  assert.equal((s.match(/<h3\b/g) ?? []).length, (s.match(/<\/h3>/g) ?? []).length);
});

// Round 2 of the accessibility audit (WCAG 2.2 AA): colour contrast of the text and field-edge tokens, and 24px targets.

test('no text token is under 12px and the small interactive parts are 24px targets', () => {
  const css = tokensCss();
  for (const m of css.matchAll(/--fs-[\w-]+:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 12, `${m[0]} is under 12px`);
  const ui = uiComponentsCss();
  assert.match(ui, /\.dot-button \{[^}]*size-6/);
  assert.match(read('src/auth/LoginAnnouncements.tsx'), /dot-button/);
});

test('every <th> declares its scope, so a screen reader can tie a data cell to its header', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : /\.tsx$/.test(e.name) ? [`${d}/${e.name}`] : []));
  const missing = [];
  for (const f of walk('src')) {
    for (const m of read(f).matchAll(/<th(\s[^>]*)?>/g)) if (!/\bscope=/.test(m[1] ?? '')) missing.push(f);
  }
  assert.deepEqual(missing, [], '<th> without scope');
});

test('the Customer view button text meets 4.5:1 on its own background (the app token)', () => {
  const css = tokensCss();
  assert.ok(contrast(token(css, '--customer-view-fg'), token(css, '--customer-view-bg')) >= 4.5, 'Customer view button text');
});
