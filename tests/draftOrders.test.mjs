// Mobile Postpaid Activation: after the customer is identified, the Draft Orders THIS agent saved for THIS customer are offered (resume one, or start new).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
let d;
before(async () => { await boot(); d = await load('/src/modules/new-connection/draftOrders.ts'); });
after(close);

const R = (n) => JSON.parse(fs.readFileSync(`public/mock-data/${n}.json`, 'utf8'));
const read = (p) => fs.readFileSync(p, 'utf8');
const orders = R('orders');
const tasks = R('tasks');
const offered = (customerId, agentId) => d.applicableDraftOrders(orders, tasks, { customerId, agentId }).map((o) => o.orderId).sort();

const FATIMA = 'USR-1101'; // Retail Sales, the demo agent
const RACHEL = 'USR-1103';
const OMAR = 'USR-1102';

test('the seeded scenarios: none / one / several for this agent, only another agent\'s, and a mixture (AC01-AC05)', () => {
  assert.deepEqual(offered('CUST-3001', FATIMA), [], 'no drafts at all');
  assert.deepEqual(offered('CUST-1001', FATIMA), ['ORD-90020'], 'one');
  assert.deepEqual(offered('CUST-3002', FATIMA), ['ORD-90030', 'ORD-90031'], 'several, each independently');
  assert.deepEqual(offered('CUST-3401', FATIMA), [], 'drafts by another agent only');
  assert.deepEqual(offered('CUST-3401', RACHEL), ['ORD-90032'], '... which is that agent\'s own');
  assert.deepEqual(offered('CUST-3003', FATIMA), ['ORD-90033'], 'a mixture: only this agent\'s');
  assert.deepEqual(offered('CUST-3003', RACHEL), ['ORD-90034']);
  assert.deepEqual(offered('CUST-3003', OMAR), ['ORD-90035']);
});

test('filtering uses the customer AND the agent: neither alone is enough (conservation over every draft in the data)', () => {
  const drafts = orders.filter((o) => o.status === 'Draft');
  assert.ok(drafts.length >= 8);
  for (const o of drafts) {
    const owner = o.createdBy;
    const customer = o.customerId;
    assert.ok(offered(customer, owner).includes(o.orderId), `${o.orderId} is offered to its own agent for its own customer`);
    for (const other of ['USR-1101', 'USR-1102', 'USR-1103'].filter((a) => a !== owner)) assert.ok(!offered(customer, other).includes(o.orderId), `${o.orderId} is not offered to ${other}`);
    for (const c of ['CUST-3001', 'CUST-3002', 'CUST-3003', 'CUST-3401', 'CUST-1001', 'CUST-1003'].filter((c) => c !== customer)) assert.ok(!offered(c, owner).includes(o.orderId), `${o.orderId} is not offered for ${c}`);
  }
  // Every offered draft is a draft (never a submitted order), from this journey.
  for (const cid of ['CUST-1001', 'CUST-3002', 'CUST-3003']) for (const o of d.applicableDraftOrders(orders, tasks, { customerId: cid, agentId: FATIMA })) {
    assert.equal(o.order.status, 'Draft');
    assert.equal(o.order.draftWizardId, 'new-connection');
  }
});

test('nothing is offered without an identified customer or a signed-in agent, and a record that is not a draft of this journey is never offered', () => {
  assert.deepEqual(d.applicableDraftOrders(orders, tasks, { customerId: undefined, agentId: FATIMA }), []);
  assert.deepEqual(d.applicableDraftOrders(orders, tasks, { customerId: 'CUST-3002', agentId: undefined }), []);
  const base = { orderId: 'X', status: 'Draft', customerId: 'C', createdBy: 'A', draftWizardId: 'new-connection', orderType: 'New Postpaid Activation', draftValues: {} };
  const ids = (list) => d.applicableDraftOrders(list, [], { customerId: 'C', agentId: 'A' }).map((o) => o.orderId);
  assert.deepEqual(ids([base]), ['X']);
  assert.deepEqual(ids([{ ...base, status: 'Complete' }]), [], 'a submitted order');
  assert.deepEqual(ids([{ ...base, draftWizardId: 'fixed-line' }]), [], 'another journey\'s draft');
  assert.deepEqual(ids([{ ...base, draftValues: { product: 'prepaid' } }]), [], 'another product');
  assert.deepEqual(ids([{ ...base, orderType: 'Fixed Line Activation' }]), [], 'an order type this journey does not write');
  assert.deepEqual(ids([{ ...base, draftValues: { product: 'postpaid' }, orderType: 'New Connection' }]), ['X']);
  assert.deepEqual(ids([{ ...base, orderType: 'New Connection' }]), ['X'], 'saved before a product was chosen');
});

test('a draft with no customerId or createdBy of its own is judged by what the journey saved with it (the identified customer, the task\'s agent)', () => {
  const legacy = { orderId: 'L', status: 'Draft', draftWizardId: 'new-connection', orderType: 'New Connection', draftValues: { eligibility: { customerId: 'C' } } };
  const task = { taskId: 'T', relatedOrderId: 'L', assignedAgentId: 'A' };
  assert.deepEqual(d.applicableDraftOrders([legacy], [task], { customerId: 'C', agentId: 'A' }).map((o) => o.orderId), ['L']);
  assert.deepEqual(d.applicableDraftOrders([legacy], [task], { customerId: 'C', agentId: 'B' }), [], 'another agent');
  assert.deepEqual(d.applicableDraftOrders([legacy], [], { customerId: 'C', agentId: 'A' }), [], 'no agent on record: not guessed');
  assert.deepEqual(d.applicableDraftOrders([{ ...legacy, draftValues: {} }], [task], { customerId: 'C', agentId: 'A' }), [], 'no customer on record: not guessed');
});

test('each option carries only what the draft has, newest change first; missing optional information is left out, not invented', () => {
  const [first, second] = d.applicableDraftOrders(orders, tasks, { customerId: 'CUST-3002', agentId: FATIMA });
  assert.equal(first.orderId, 'ORD-90031', 'modified 05/11 before 02/11');
  assert.equal(first.msisdn, '+97433002031');
  assert.equal(first.stepKey, 'number');
  assert.equal(first.planId, 'PROD-109');
  assert.equal(first.comment, 'Waiting on the customer\'s choice of number.');
  assert.equal(second.msisdn, undefined, 'no number chosen yet');
  const bare = d.applicableDraftOrders([{ orderId: 'B', status: 'Draft', customerId: 'C', createdBy: 'A', draftWizardId: 'new-connection', orderType: 'New Connection' }], [], { customerId: 'C', agentId: 'A' })[0];
  assert.deepEqual([bare.createdAt, bare.modifiedAt, bare.stepKey, bare.planId, bare.msisdn, bare.comment], [undefined, undefined, undefined, undefined, undefined, undefined]);
});

test('resuming keeps the draft\'s saved selections over the fresh identification: contact merged, eligibility and special discount fresh, nothing else from this session overwrites the draft', () => {
  const saved = { contact: { idType: 'QID', altPhone: '+97455512345', moiResult: { name: 'old' } }, productId: 'PROD-105', msisdn: '+97433002031', eligibility: { customerId: 'C', pass: false }, address: { zone: '55' } };
  const current = { contact: { idType: 'QID', moiResult: { name: 'fresh' } }, eligibility: { customerId: 'C', pass: true }, customerType: { type: 'none' }, product: undefined };
  const v = d.resumedDraftValues(saved, current, 'New Postpaid Activation');
  assert.equal(v.contact.altPhone, '+97455512345', 'what the agent added to the contact is kept');
  assert.equal(v.contact.moiResult.name, 'fresh', 'the fresh identification wins');
  assert.deepEqual(v.eligibility, { customerId: 'C', pass: true }, 'eligibility is never carried over from the draft');
  assert.deepEqual(v.customerType, { type: 'none' });
  assert.equal(v.productId, 'PROD-105');
  assert.equal(v.msisdn, '+97433002031');
  assert.deepEqual(v.address, { zone: '55' });
  assert.equal(v.product, 'postpaid', 'an earlier-shape Postpaid draft is Postpaid');
  assert.equal(d.resumedDraftValues({ contact: {} }, {}, 'New Connection').product, undefined, 'an undecided draft stays undecided');
  assert.equal(d.resumedDraftValues({ product: 'postpaid' }, { product: undefined }, 'New Connection').product, 'postpaid');
});

test('the journey offers the drafts once the customer is identified, only at Customer Verification and only while Postpaid or undecided; Start New touches no draft; Resume restores and does not create an order', () => {
  const wizard = read('src/modules/new-connection/NewConnectionWizard.tsx');
  assert.match(wizard, /journey === 'connection' && !isMirrorWindow && \(draftStep \?\? 0\) === 0 && !draftOrderId && \(initialProduct === undefined \|\| initialProduct === 'postpaid'\) && \(product === undefined \|\| product === 'postpaid'\)/);
  assert.match(wizard, /customerId=\{identifiedCustomerId\} agentId=\{agentId\}/);
  assert.match(wizard, /s\.auth\.profile\?\.userId/);
  const prompt = read('src/modules/new-connection/steps/DraftOrdersPrompt.tsx');
  assert.match(prompt, /const open = Boolean\(customerId\) && options\.length > 0 && choice\?\.customerId !== customerId/, 'no empty modal when there are no drafts; asked once per customer');
  assert.match(prompt, /Start New Product Selection/);
  assert.match(prompt, /Resume Draft Order/);
  assert.match(prompt, /role="radiogroup" aria-label="Draft Orders"/);
  // Start new: only records the choice in the journey's own draft. It writes no order and no task.
  const startNew = prompt.match(/const startNew = [^\n]*\n/)[0];
  assert.doesNotMatch(startNew, /updateRecord|createRecord|removeRecord/);
  // Resume: re-reads the draft (unavailable: told, not restored), links the journey to THAT order, sends Continue back to the saved step, creates nothing.
  assert.match(prompt, /getEntity<DraftOrderRecord>\('orders', chosen\.orderId\)/);
  assert.match(prompt, /fresh\.status !== 'Draft'/);
  assert.match(prompt, /That Draft Order is no longer available\./);
  assert.match(prompt, /draftOrderId: fresh\.orderId/);
  assert.match(prompt, /resumeToStepKey: stepKey/);
  assert.doesNotMatch(prompt, /createRecord|updateRecord|removeRecord/, 'the prompt itself writes no record');
});

test('a draft saved by the journey carries its agent, customer and creation time, so the next session can offer it', () => {
  const src = read('src/components/patterns/wizard/useWizardDraftActions.ts');
  assert.match(src, /createdBy: currentAgentId\(\),\s*createdAt: new Date\(\)\.toISOString\(\),\s*\.\.\.\(identifiedCustomerId \? \{ customerId: identifiedCustomerId \} : \{\}\)/);
  assert.match(src, /\.\.\.\(identifiedCustomerId \? \{ customerId: identifiedCustomerId \} : \{\}\),\s*\}\);/, 'a later save records the customer once known');
});
