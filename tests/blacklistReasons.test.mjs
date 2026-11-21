// A customer can be blacklisted for MORE THAN ONE reason at once; the record holds a list and every reason is judged and shown.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { boot, load, close } from './harness.mjs';

globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};

let br, engine, resolvers;
before(async () => {
  await boot();
  br = await load('/src/engines/blacklistReasons.ts');
  engine = await load('/src/engines/eligibilityEngine.ts');
  resolvers = await load('/src/workspace/customer360/sections/blacklistResolvers.tsx');
});
after(close);

const customers = JSON.parse(fs.readFileSync('public/mock-data/customers.json', 'utf8'));
const read = (p) => fs.readFileSync(p, 'utf8');

// What each blacklisted customer IS blacklisted for, written independently of the code that reads it.
const EXPECTED = {
  'CUST-1004': ['collections'],
  'CUST-1006': ['security'],
  'CUST-3043': ['security'],
  'CUST-3046': ['collections'],
  'CUST-3047': [], // blacklisted with no reason recorded: unclassified
  'CUST-3073': ['collections'],
  'CUST-3074': ['collections'],
  'CUST-3075': ['collections', 'security'], // the fixture: two reasons at once
};

test('every blacklisted customer in the data has exactly the reasons expected, and nobody else has any (both directions)', () => {
  const blacklisted = customers.filter((c) => c.blacklisted).map((c) => c.customerId).sort();
  assert.deepEqual(blacklisted, Object.keys(EXPECTED).sort(), 'the blacklisted population');
  for (const c of customers) {
    const got = (c.blacklistReasons ?? []).map((r) => r.category);
    assert.deepEqual(got, EXPECTED[c.customerId] ?? [], c.customerId);
    for (const r of c.blacklistReasons ?? []) assert.ok(['collections', 'security'].includes(r.category) && r.reason?.trim(), `${c.customerId}: a reason has a kind and a text`);
    assert.ok(!('blacklistCategory' in c) && !('blacklistReason' in c), `${c.customerId}: the single-reason fields are gone`);
  }
  assert.ok(customers.some((c) => (c.blacklistReasons ?? []).length > 1), 'the data has a customer blacklisted for more than one reason');
});

test('the accessors return every reason, in order, and an empty list for none', () => {
  const both = customers.find((c) => c.customerId === 'CUST-3075');
  assert.deepEqual(br.blacklistReasonsOf(both).map((r) => r.category), ['collections', 'security']);
  assert.deepEqual([...br.blacklistCategoriesOf(both)].sort(), ['collections', 'security']);
  assert.equal(br.blacklistReasonText(both), 'Outstanding dues > threshold; Security restriction on new connections');
  assert.deepEqual(br.blacklistReasonsOf(undefined), []);
  assert.deepEqual(br.blacklistReasonsOf({}), []);
  assert.equal(br.blacklistReasonText({}), undefined);
  assert.equal(br.blacklistReasonLabel({ category: 'security', reason: 'x' }), 'Security: x');
});

const baseCtx = (customer, over = {}) => ({
  customer: { customerId: 'C', idType: 'QID', dob: '1990-01-01', ...customer },
  doc: { documentType: 'QID', expiryDate: '2099-01-01' },
  deals: [],
  outstandingQar: 0,
  lineCapReached: false,
  activeLinesDetail: '1/5 postpaid mobile lines used.',
  ...over,
});
const byId = (checks, id) => checks.find((c) => c.id === id);
const R = (category) => ({ category, reason: `${category} reason` });

test('eligibility judges EVERY reason: collections and security together give both rows, the security hard stop wins, prepaid is not rescued', () => {
  const asOf = new Date('2026-10-13');
  const both = { blacklisted: true, blacklistReasons: [R('collections'), R('security')] };
  for (const journeyType of [undefined, 'prepaid']) {
    const checks = engine.evaluateEligibilityChecks(baseCtx(both, { outstandingQar: 350.5, journeyType }), asOf);
    assert.equal(byId(checks, 'blacklist-security').outcome, 'hard-stop', `security, ${journeyType ?? 'postpaid'}`);
    assert.equal(byId(checks, 'blacklist-collections').outcome, journeyType === 'prepaid' ? 'pass' : 'soft-stop', `collections, ${journeyType ?? 'postpaid'}`);
    assert.ok(!byId(checks, 'blacklist-unclassified'), 'a classified blacklist is never also unclassified');
    assert.equal(engine.hasHardStop(checks), true);
  }
  // The order of the list does not matter.
  const flipped = engine.evaluateEligibilityChecks(baseCtx({ ...both, blacklistReasons: [R('security'), R('collections')] }, { outstandingQar: 350.5 }), asOf);
  assert.equal(byId(flipped, 'blacklist-security').outcome, 'hard-stop');
  assert.equal(byId(flipped, 'blacklist-collections').outcome, 'soft-stop');
});

test('one reason, no reason, and the collections QAR 0 rule behave as before (conservation of the single-reason outcomes)', () => {
  const asOf = new Date('2026-10-13');
  const only = (reasons, outstandingQar = 0) => engine.evaluateEligibilityChecks(baseCtx({ blacklisted: true, blacklistReasons: reasons }, { outstandingQar }), asOf);
  assert.equal(byId(only([R('collections')], 250), 'blacklist-collections').outcome, 'soft-stop');
  assert.equal(byId(only([R('collections')], 250), 'blacklist-security').outcome, 'pass');
  assert.equal(byId(only([R('collections')], 0), 'blacklist-collections').outcome, 'pass', 'the flag alone does not block');
  assert.equal(byId(only([R('security')]), 'blacklist-security').outcome, 'hard-stop');
  assert.equal(byId(only([R('security')]), 'blacklist-collections').outcome, 'pass');
  // Blacklisted with nothing recorded: unclassified, a hard stop; and the same for a missing list.
  for (const reasons of [[], undefined]) assert.equal(byId(only(reasons), 'blacklist-unclassified').outcome, 'hard-stop');
  // Not blacklisted: a stray list means nothing.
  const clean = engine.evaluateEligibilityChecks(baseCtx({ blacklisted: false, blacklistReasons: [R('security')] }), asOf);
  assert.equal(byId(clean, 'blacklist-security').outcome, 'pass');
});

test('Customer 360 shows every reason: the Blacklist View lists each, and the header, alerts, overview and query preview read the whole list', () => {
  const both = customers.find((c) => c.customerId === 'CUST-3075');
  const html = renderToStaticMarkup(resolvers.blacklistResolvers['Blacklisted ID Status']({ customer: both }));
  assert.match(html, /Collections: Outstanding dues &gt; threshold/);
  assert.match(html, /Security: Security restriction on new connections/);
  const none = renderToStaticMarkup(resolvers.blacklistResolvers['Blacklisted ID Status']({ customer: { blacklisted: true } }));
  assert.match(none, /Blacklisted/);
  assert.doesNotMatch(none, /Collections|Security/);
  const clear = renderToStaticMarkup(resolvers.blacklistResolvers['Blacklisted ID Status']({ customer: { blacklisted: false } }));
  assert.match(clear, /Not Blacklisted/);
  const header = read('src/workspace/customer360/CustomerProfileHeader.tsx');
  assert.match(header, /new Set\(\(p\.blacklistReasons \?\? \[\]\)\.map\(\(r\) => r\.category\)\)[\s\S]*BLACKLIST_CATEGORY_LABELS\[category\]/, 'a chip per kind beside the badge');
  assert.match(header, /map\(\(r\) => r\.reason\)\.join\(' · '\) : 'No reason recorded'/, 'every reason text on its own line; none recorded says so');
  assert.match(read('src/workspace/customer360/Customer360Layout.tsx'), /blacklistReasons=\{blacklistReasonsOf\(data\.customer\)\}/);
  assert.match(read('src/workspace/customer360/Customer360Layout.tsx'), /label: `Blacklisted - \$\{BLACKLIST_CATEGORY_LABELS\[r\.category\]\}`/, 'the Alerts & Attention card has an item per reason');
  assert.match(read('src/workspace/customer360/sections/C360AlertsRisks.tsx'), /reasons\.forEach\(\(r, i\) => add\(\{ id: `blacklist-\$\{i\}`/, 'one alert per reason');
  assert.match(read('src/workspace/customer360/sections/C360Overview.tsx'), /blacklistReasonText\(data\.customer\)/);
  assert.match(read('src/workspace/customer360/queryFlow/QueryPreviewModal.tsx'), /blacklistReasonText\(data\.customer\)/);
});

test('nothing in src reads a single blacklist category or reason off a customer: the list is the one source', () => {
  const files = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : /\.(ts|tsx)$/.test(e.name) && files.push(`${d}/${e.name}`)));
  walk('src');
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, /\.blacklistCategory\b|blacklistCategory\??:/, `${f} reads a single category`);
    assert.doesNotMatch(src, /(customer|match|c)\??\.blacklistReason\b/, `${f} reads a single reason off a customer`);
  }
});

test('the Collections Check message names the account the balance is on, when known, and says nothing about it when not', async () => {
  const asOf = new Date('2026-10-13');
  const msg = (extra) => byId(engine.evaluateEligibilityChecks(baseCtx({ blacklisted: true, blacklistReasons: [R('collections')] }, { outstandingQar: 496.25, ...extra }), asOf), 'blacklist-collections').message;
  assert.match(msg({ outstandingAccounts: ['ACC-5001'] }), /^This account has an outstanding balance of QAR 496\.25 on account ACC-5001\.\nPostpaid cannot be issued\. Prepaid is available on this QID\.$/);
  assert.match(msg({ outstandingAccounts: ['ACC-1', 'ACC-2'] }), /on accounts ACC-1, ACC-2\./);
  assert.match(msg({}), /^This account has an outstanding balance of QAR 496\.25\.\n/, 'no account known: nothing added');
  const { unpaidInvoiceAccounts } = await load('/src/engines/billingBalance.ts');
  assert.deepEqual(unpaidInvoiceAccounts([{ type: 'bill', status: 'billed', accountId: 'ACC-9' }, { type: 'bill', status: 'overdue', accountId: 'ACC-9' }, { type: 'bill', status: 'paid', accountId: 'ACC-8' }]), ['ACC-9'], 'only unsettled invoices, each account once');
});
