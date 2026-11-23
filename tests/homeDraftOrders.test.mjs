import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, load, close } from './harness.mjs';

// New Home Connection's drafts: this agent's own, for the identified customer, resumable from the step they were saved on, discardable, and amended without keeping what was computed for the
// charges and the CAF. Expectations are written per draft (who it is for and what it is), not derived from the code. The Mobile Postpaid drafts are a separate rule that must not change.
let model;
before(async () => {
  await boot();
  model = await load('/src/modules/new-connection/draftOrders.ts');
});
after(close);

const draft = (orderId, over = {}) => ({ orderId, status: 'Draft', customerId: 'CUST-1', createdBy: 'VFQ12341', draftWizardId: 'new-home-connection', draftStepKey: 'plan', draftValues: { product: 'fixed-line' }, ...over });
const who = { customerId: 'CUST-1', agentId: 'VFQ12341' };
const ids = (orders, w = who) => model.applicableHomeDraftOrders(orders, [], w).map((o) => o.orderId);

test('a home draft is offered to the agent who saved it, for the customer it is for - and to nobody else', () => {
  const orders = [
    draft('ORD-A'),
    draft('ORD-B', { draftWizardId: 'new-home-connection-existing-CUST-1' }),
    draft('ORD-C', { createdBy: 'VFQ12342' }),
    draft('ORD-D', { customerId: 'CUST-2' }),
    draft('ORD-E', { status: 'Submitted' }),
    draft('ORD-F', { draftWizardId: 'new-connection' }),
    draft('ORD-G', { customerId: undefined, draftValues: { eligibility: { customerId: 'CUST-1' } } }),
  ];
  assert.deepEqual(ids(orders).sort(), ['ORD-A', 'ORD-B', 'ORD-G']);
  assert.deepEqual(ids(orders, { customerId: undefined, agentId: 'VFQ12341' }), [], 'nobody identified: nothing offered');
  assert.deepEqual(ids(orders, { customerId: 'CUST-1', agentId: undefined }), []);
});

test('a customer new to the journey has no record: their drafts are found by the ID number the draft was started with', () => {
  const byId = (id, over = {}) => draft(id, { customerId: undefined, draftValues: { contact: { idNumber: '29303051200106' } }, ...over });
  const orders = [byId('ORD-N1'), byId('ORD-N2', { createdBy: 'VFQ12342' }), byId('ORD-N3', { draftValues: { contact: { idNumber: '99999999999' } } }), byId('ORD-N4', { status: 'Submitted' })];
  const found = (w) => model.applicableHomeDraftOrders(orders, [], w).map((o) => o.orderId);
  assert.deepEqual(found({ customerId: undefined, idNumber: '29303051200106', agentId: 'VFQ12341' }), ['ORD-N1'], 'this agent, this ID, still a draft');
  assert.deepEqual(found({ customerId: undefined, idNumber: undefined, agentId: 'VFQ12341' }), [], 'ID not verified yet: nothing offered');
});

test('a home draft is never offered by the Mobile Postpaid rule, and a postpaid draft never by the home one', () => {
  const home = draft('ORD-H');
  const post = draft('ORD-P', { draftWizardId: 'new-connection', draftValues: { product: 'postpaid' } });
  assert.deepEqual(model.applicableDraftOrders([home, post], [], who).map((o) => o.orderId), ['ORD-P']);
  assert.deepEqual(ids([home, post]), ['ORD-H']);
});

test('drafts are listed newest change first, and the stage is the step they were saved on', () => {
  const tasks = [{ taskId: 'T1', relatedOrderId: 'ORD-OLD', updatedAt: '2026-11-20T10:00:00Z' }, { taskId: 'T2', relatedOrderId: 'ORD-NEW', updatedAt: '2026-11-22T10:00:00Z' }];
  const out = model.applicableHomeDraftOrders([draft('ORD-OLD', { draftStepKey: 'number' }), draft('ORD-NEW', { draftStepKey: 'checkout' })], tasks, who);
  assert.deepEqual(out.map((o) => [o.orderId, o.stepKey]), [['ORD-NEW', 'checkout'], ['ORD-OLD', 'number']]);
});

test('a resumed home draft drops what it computed for the CAF and the charges, and keeps the rest; verification stays fresh', () => {
  const saved = {
    product: 'fixed-line', productId: 'PROD-201', addonIds: ['ADO-9501'], address: { zone: '55' },
    caf: { cafType: 'Digital', signatureDataUrl: 'data:image/png;base64,AAAA' }, cafSummary: [1], legalFacts: { a: 1 }, checkoutTotals: { dueTodayQar: 100 },
    eligibility: { customerId: 'CUST-1', stale: true }, contact: { idNumber: '1', note: 'kept' },
  };
  const current = { eligibility: { customerId: 'CUST-1', fresh: true }, contact: { idNumber: '1', moiResult: { name: 'X' } } };
  const v = model.homeResumedDraftValues(saved, current);
  for (const k of model.HOME_DERIVED_KEYS) assert.equal(v[k], undefined, k);
  assert.deepEqual(model.HOME_DERIVED_KEYS, ['caf', 'cafSummary', 'legalFacts', 'checkoutTotals']);
  assert.equal(v.productId, 'PROD-201');
  assert.deepEqual(v.addonIds, ['ADO-9501']);
  assert.deepEqual(v.address, { zone: '55' });
  assert.equal(v.eligibility.fresh, true, 'the eligibility is the fresh one');
  assert.equal(v.contact.note, 'kept');
  assert.ok(v.contact.moiResult, 'the fresh identification is kept');
});

test('the journey wires it for New Home Connection only: the prompt after ID verification, and the cleanup of a resumed draft', async () => {
  const fs = await import('node:fs');
  const w = fs.readFileSync('src/modules/new-connection/NewConnectionWizard.tsx', 'utf8');
  assert.match(w, /const offerHomeDrafts = journey === 'home' && !isMirrorWindow && \(draftStep \?\? 0\) === 0 && !draftOrderId;/);
  assert.match(w, /\{offerHomeDrafts && <HomeDraftOrdersPrompt /);
  assert.match(w, /if \(journey !== 'home' \|\| !resumingStepKey \|\| !hasDerived \|\| isMirrorWindow\) return;/);
  const prompt = fs.readFileSync('src/modules/new-connection/steps/HomeDraftOrdersPrompt.tsx', 'utf8');
  assert.match(prompt, /Discard Draft/);
  assert.match(prompt, /removeRecord\('tasks'[\s\S]*removeRecord\('orders'/, 'a discarded draft takes its task with it');
  assert.match(prompt, /Start New Product Selection/);
});
