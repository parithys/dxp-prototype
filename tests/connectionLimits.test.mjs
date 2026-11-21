// The connection-limit notification on the Contact page: what the customer holds against the limits, and whether a limit is exceeded / approval is required.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

let dom, toast, eng;
before(async () => {
  await boot();
  dom = await load('/src/domain/eligibility/index.ts');
  toast = await load('/src/capabilities/EligibilityGate/connectionLimitToast.ts');
  eng = await load('/src/engines/connectionEligibility.ts');
});
after(close);

const counts = (postpaid, fixedFwa, prepaid = 0) => ({ prepaid, postpaid, mobileTotal: prepaid + postpaid, fixedFwa });
const level = (segment, type, n) => dom.connectionLimitReport(counts(type === 'postpaid' ? n : 0, type === 'fixed' ? n : 0), segment, dom.ruleConfigV1).limits.find((l) => l.type === type).level;

// The business rules, written independently of the configuration: [segment, type, count, expected level].
const TABLE = [
  // Expat Mobile Postpaid: up to 2 free, 3 to 5 approval (above that the segment's maximum is exceeded).
  ['EXPATRIATE', 'postpaid', 0, 'within'], ['EXPATRIATE', 'postpaid', 1, 'within'], ['EXPATRIATE', 'postpaid', 2, 'within'],
  ['EXPATRIATE', 'postpaid', 3, 'approval'], ['EXPATRIATE', 'postpaid', 4, 'approval'], ['EXPATRIATE', 'postpaid', 5, 'approval'], ['EXPATRIATE', 'postpaid', 6, 'blocked'],
  // Expat Fixed: 1 free, more than 1 approval.
  ['EXPATRIATE', 'fixed', 0, 'within'], ['EXPATRIATE', 'fixed', 1, 'within'], ['EXPATRIATE', 'fixed', 2, 'approval'], ['EXPATRIATE', 'fixed', 7, 'approval'],
  // Qatari Mobile Postpaid: up to 5 free, more than 5 approval.
  ['QATARI', 'postpaid', 0, 'within'], ['QATARI', 'postpaid', 5, 'within'], ['QATARI', 'postpaid', 6, 'approval'], ['QATARI', 'postpaid', 12, 'approval'],
  // Qatari Fixed: up to 2 free, more than 2 approval.
  ['QATARI', 'fixed', 0, 'within'], ['QATARI', 'fixed', 2, 'within'], ['QATARI', 'fixed', 3, 'approval'], ['QATARI', 'fixed', 9, 'approval'],
];
test('the limits: each segment and connection type against the stated rules', () => {
  for (const [segment, type, n, expected] of TABLE) assert.equal(level(segment, type, n), expected, `${segment} ${type} ${n}`);
});

test('the report: total counts every connection, the breakdown adds up, and exceeded follows the levels', () => {
  const r = dom.connectionLimitReport(counts(3, 2, 4), 'EXPATRIATE', dom.ruleConfigV1);
  assert.equal(r.total, 9);
  assert.equal(r.postpaid + r.prepaid + r.fixed, r.total, 'conservation: the breakdown is the total');
  assert.equal(r.exceeded, true);
  assert.equal(dom.connectionLimitReport(counts(2, 1, 9), 'EXPATRIATE', dom.ruleConfigV1).exceeded, false, 'prepaid has no no-approval limit here; 2 postpaid + 1 fixed is within');
  assert.equal(dom.connectionLimitReport(counts(0, 0), 'QATARI', dom.ruleConfigV1).exceeded, false, 'zero connections');
});

test('the toast: the breakdown rows, the threshold statement and whether approval is required', () => {
  const r = dom.connectionLimitReport(counts(3, 1, 2), 'EXPATRIATE', dom.ruleConfigV1);
  const t = toast.connectionLimitToast(r);
  assert.equal(t.message, 'Connection Limit Exceeded');
  const row = (label) => t.rows.find((x) => x.label === label);
  assert.equal(row('Total Connections').value, '6');
  assert.equal(row('Mobile Postpaid Connections').value, '3');
  assert.match(row('Mobile Postpaid Connections').sub, /Limit of 2 without approval exceeded: approval is required \(up to 5\)/);
  assert.equal(row('Fixed Connections').value, '1');
  assert.match(row('Fixed Connections').sub, /Within the limit of 1 without approval/);
  assert.equal(row('Prepaid Connections').value, '2');
  assert.equal(toast.connectionLimitToast(dom.connectionLimitReport(counts(0, 0), 'QATARI', dom.ruleConfigV1)).rows.some((x) => x.label === 'Prepaid Connections'), false, 'no prepaid row when none are held');
  assert.match(toast.limitStatement({ type: 'postpaid', count: 6, freeUpTo: 2, approvalUpTo: 5, level: 'blocked' }), /Over the maximum of 5/);
  assert.match(toast.limitStatement({ type: 'fixed', count: 4, freeUpTo: 2, approvalUpTo: null, level: 'approval' }), /approval is required$/);
});

test('the whole customer population: counts conserve, levels follow the table, and nothing unknown is reported', async () => {
  const customers = JSON.parse(fs.readFileSync('public/mock-data/customers.json', 'utf8'));
  const docs = JSON.parse(fs.readFileSync('public/mock-data/identity-documents.json', 'utf8'));
  let covered = 0, over = 0, unknown = 0;
  for (const c of customers) {
    const doc = docs.find((d) => d.customerId === c.customerId);
    const r = await eng.connectionLimitsFor({ customerId: c.customerId, nationality: c.nationality, idType: doc?.documentType ?? c.idType, dob: c.dob });
    if (!r) { unknown += 1; continue; }
    covered += 1;
    assert.equal(r.postpaid + r.prepaid + r.fixed, r.total, c.customerId);
    const seg = c.nationality === 'Qatari' ? 'QATARI' : 'EXPATRIATE';
    assert.equal(r.segment, seg, c.customerId);
    for (const l of r.limits) assert.equal(l.level, level(seg, l.type, l.count), `${c.customerId} ${l.type}`);
    assert.equal(r.exceeded, r.limits.some((l) => l.level !== 'within'), c.customerId);
    if (r.exceeded) over += 1;
  }
  assert.equal(covered + unknown, customers.length);
  assert.ok(covered > 0 && unknown > 0, 'ID types the engine does not cover (GCC, Diplomatic, Other) are left unreported, not assumed within limits');
  assert.ok(over > 0, 'the seeded data has customers over a limit to demonstrate it');
});

test('wiring: only the Contact page announces, once per identity, for a person with a customer record (also when typed in as a new customer), and keeps the report on the eligibility result for the Existing Connections Summary (no toast)', () => {
  const gate = fs.readFileSync('src/capabilities/EligibilityGate/EligibilityGateStep.tsx', 'utf8');
  assert.match(gate, /announceConnectionLimits && !nasCustomer\) \{/);
  assert.doesNotMatch(gate, /CLDEBUG|console\./);
  assert.doesNotMatch(gate, /connectionLimitToast|connection-limits-/, 'the breakdown is a panel beside the Journey Summary, not a toast');
  assert.match(gate, /connectionLimits,\n/, 'the report rides on the result');
  for (const f of ['src/capabilities/CustomerQualification/step.tsx', 'src/capabilities/CustomerQualification/representativeStep.tsx']) assert.match(fs.readFileSync(f, 'utf8'), /announceConnectionLimits/, f);
  assert.doesNotMatch(fs.readFileSync('src/modules/new-connection/steps/ProductEligibility.tsx', 'utf8'), /announceConnectionLimits/, 'the product stage has its own Active Lines row');
});

test('the Existing Connections Summary: shown only for a customer who holds connections; a warning for a limit reached or exceeded whether or not blacklisted; nothing but connection limits', async () => {
  const m = await load('/src/capabilities/EligibilityGate/existingConnectionsSummaryModel.ts');
  const result = (report, extra = {}) => ({ connectionLimits: report, checks: [], blacklisted: false, ...extra });
  const rep = (p, f, pre, seg = 'EXPATRIATE') => dom.connectionLimitReport(counts(p, f, pre), seg, dom.ruleConfigV1);
  assert.equal(m.existingConnectionsSummary(undefined), null, 'not judged');
  assert.equal(m.existingConnectionsSummary(result(undefined)), null, 'a customer with no connection data');
  assert.equal(m.existingConnectionsSummary(result(rep(0, 0, 0))), null, 'no active connections: not shown');
  const clean = m.existingConnectionsSummary(result(rep(1, 0, 2)));
  assert.deepEqual([clean.total, clean.postpaid, clean.prepaid, clean.fixed], [3, 1, 2, 0]);
  assert.deepEqual(clean.warnings, [], 'all pass: no warning panel');
  const exceeded = m.existingConnectionsSummary(result(rep(3, 0, 0)));
  assert.equal(exceeded.warnings.length, 1, 'over the limit, customer NOT blacklisted: still warned');
  assert.match(exceeded.warnings[0], /^Mobile Postpaid: Connection limit exceeded\. Approval is required for activation\.$/);
  const reached = m.existingConnectionsSummary(result(rep(2, 0, 0)));
  assert.match(reached.warnings[0], /limit of 2 reached/, 'reaching the limit is warned too');
  // Only connection-limit warnings: a blacklist, a failed security / balance check or any other eligibility result is never listed here.
  const check = { id: 'blacklist-security', label: 'Security', passed: false, outcome: 'hard-stop', message: 'Security check failed' };
  const balance = { id: 'blacklist-collections', label: 'Collections', passed: false, outcome: 'soft-stop', message: 'Outstanding balance of QAR 496.25' };
  const unrelated = m.existingConnectionsSummary(result(rep(1, 0, 0), { checks: [check, balance], blacklisted: true, blacklistReason: 'Security' }));
  assert.deepEqual(unrelated.warnings, [], 'within the limits: nothing, whatever else is wrong with the customer');
  const mixed = m.existingConnectionsSummary(result(rep(3, 0, 0), { checks: [check, balance], blacklisted: true }));
  assert.equal(mixed.warnings.length, 1);
  assert.match(mixed.warnings[0], /Connection limit exceeded/);
});

test('the Summary is the full-width banner under the page title on the Contact steps only; the stacked card above the Journey Summary is gone', () => {
  const used = [];
  for (const dir of ['src/capabilities', 'src/modules']) {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
    for (const f of walk(dir)) {
      if (!/\.tsx?$/.test(f)) continue;
      const src = fs.readFileSync(f, 'utf8');
      if (/asideAbove:/.test(src) && /ExistingConnectionsSummary/.test(src)) assert.fail(`${f}: the Summary is not shown in the aside`);
      if (/belowTitle:[\s\S]{0,300}<ExistingConnectionsSummary/.test(src)) used.push(f);
    }
  }
  assert.deepEqual(used.sort(), ['src/capabilities/CustomerQualification/representativeStep.tsx', 'src/capabilities/CustomerQualification/step.tsx']);
});
