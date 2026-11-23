import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

// New Home Connection on a KID in use: the warning (Service FLN, Status, PON) with Proceed / Cancel, a mandatory Tenancy Document after the CAF, an approval task for the Fulfilment Team,
// the existing connection disconnected and its inventory released on approval, and no second order on a KID that has one in progress. Expectations are written per case.
let kid, docs, data, model;
before(async () => {
  await boot();
  kid = await load('/src/engines/kidInUse.ts');
  docs = await load('/src/engines/journeyDocuments.ts');
  data = await load('/src/data/reference/serviceAvailabilityData.ts');
  model = await load('/src/modules/check-rfs/serviceAvailabilityModel.ts');
});
after(close);

const unit = (extra = {}) => ({ kid: 'KID-1', existingService: { fln: '44201201', status: 'Active', pon: 'PON-1' }, ...extra });

test('a KID is in use while the feasibility response reports a service on it that no approved order has disconnected', () => {
  assert.deepEqual(kid.kidInUseOf(unit(), []), { fln: '44201201', status: 'Active', pon: 'PON-1' });
  assert.equal(kid.kidInUseOf({ kid: 'KID-2' }, []), undefined, 'no service reported: not in use');
  const suspended = unit({ existingService: { fln: '44201202', status: 'Suspended', pon: 'PON-2' } });
  assert.equal(kid.kidInUseOf(suspended, []).status, 'Suspended', 'Suspended counts as in use');
  assert.equal(kid.kidInUseOf(unit(), [{ orderId: 'O1', existingConnection: { kid: 'KID-1', state: 'To Be Disconnected' } }]) !== undefined, true, 'still there until the order is approved');
  assert.equal(kid.kidInUseOf(unit(), [{ orderId: 'O1', existingConnection: { kid: 'KID-1', state: 'Disconnected' } }]), undefined, 'disconnected on approval: free again');
  assert.equal(kid.kidInUseOf(unit(), [{ orderId: 'O1', existingConnection: { kid: 'KID-9', state: 'Disconnected' } }]) !== undefined, true, 'another KID\'s disconnection does not free this one');
});

test('an order in progress for a KID blocks a new one, whoever it is for; a draft, a decided or another KID\'s order does not', () => {
  const orders = [
    { orderId: 'A', kid: 'KID-1', status: 'Submitted for Approval' },
    { orderId: 'B', kid: 'KID-2', status: 'Complete' },
    { orderId: 'C', kid: 'KID-3', status: 'Draft' },
    { orderId: 'D', kid: 'KID-4', status: 'Rejected - Correction' },
    { orderId: 'E', kid: 'KID-5', status: 'Missing Information' },
  ];
  assert.equal(kid.orderInProgressForKid(orders, 'KID-1')?.orderId, 'A');
  assert.equal(kid.orderInProgressForKid(orders, 'KID-5')?.orderId, 'E');
  for (const k of ['KID-2', 'KID-3', 'KID-4', 'KID-9', undefined]) assert.equal(kid.orderInProgressForKid(orders, k), undefined, String(k));
  assert.equal(kid.orderInProgressForKid(orders, 'KID-1', 'A'), undefined, 'an order is not blocked by itself');
});

test('proceeding on a KID in use makes the Tenancy Document required under Additional Documents; otherwise it is not asked', () => {
  const labels = (values) => docs.requiredDocumentsFor({ values: { product: 'fixed-line', ...values }, journey: 'new-connection' }).map((d) => d.label);
  assert.ok(labels({ rfsCheck: { kid: 'KID-1', kidInUse: { fln: '1', status: 'Active', pon: 'P' } } }).includes('Tenancy Document'));
  assert.ok(!labels({ rfsCheck: { kid: 'KID-1' } }).includes('Tenancy Document'));
  assert.ok(!labels({}).includes('Tenancy Document'));
  const cfg = JSON.parse(fs.readFileSync('public/config/document-types.json', 'utf8')).types.find((t) => t.id === 'tenancy-document');
  assert.deepEqual(cfg.requiredWhen, ['kid-in-use']);
});

test('the sample units: Al Waab 201 carries an Active service and 202 a Suspended one, with their FLN and PON', () => {
  const units = data.AVAILABILITY_BUILDINGS.find((b) => b.name === 'Al Waab Residence Tower').units;
  assert.deepEqual(units.find((u) => u.unit === '201').existingService, { fln: '44201201', status: 'Active', pon: 'PON-WAB-12-01' });
  assert.equal(units.find((u) => u.unit === '202').existingService.status, 'Suspended');
  assert.equal(units.find((u) => u.unit === '101').existingService, undefined);
});

test('submission and approval: the order goes to the Fulfilment Team with the KID recorded; approving it disconnects the old connection and releases its inventory', () => {
  const submit = fs.readFileSync('src/modules/fixed-line-fibre/fixedActivation/submitFixedActivationOrder.ts', 'utf8');
  assert.match(submit, /const FULFILMENT_TEAM_ROLE = 'Back Office Fulfilment';/);
  assert.match(submit, /\|\| Boolean\(kidInUse\);/, 'a KID in use holds the order for approval');
  assert.match(submit, /\.\.\.\(kidInUse \? \{ approverRole: FULFILMENT_TEAM_ROLE \} : \{\}\)/);
  assert.match(submit, /existingConnection: \{ \.\.\.kidInUse, kid: rfsCheck\.kid, state: 'To Be Disconnected' \}/);
  assert.match(submit, /orderInProgressForKid\([\s\S]*throw new Error/, 'judged again at submission');
  const approve = fs.readFileSync('src/modules/order-management/OrderApprovalDetail.tsx', 'utf8');
  assert.match(approve, /replaced && replaced\.state !== 'Disconnected'[\s\S]*state: 'Disconnected', releasedInventory: \[\.\.\.RELEASED_INVENTORY\]/);
  assert.deepEqual([...kid.RELEASED_INVENTORY], ['KID', 'PON port', 'Fixed line number', 'Fibre ONT / CPE', 'Billing service record']);
});

test('Check RFS shows the KID in Use warning with Proceed / Cancel, and stops a second order', () => {
  const sa = fs.readFileSync('src/modules/check-rfs/ServiceAvailability.tsx', 'utf8');
  assert.match(sa, /KID In Use/);
  assert.match(sa, /Service FLN[\s\S]*Status[\s\S]*PON/);
  assert.match(sa, /<Modal[\s\S]*title="KID In Use"[\s\S]*<Button variant="secondary" onClick=\{abandonOrder\}>Abandon Order<\/Button>[\s\S]*navigate\(startTarget\.to, \{ state: startTarget\.state \}\)[\s\S]*Proceed<\/Button>/);
  assert.match(sa, /const abandonOrder = \(\) => \{\s*clearResult\(\);\s*navigate\('\/'\);/);
  assert.match(sa, /Order In Progress For This KID/);
  assert.ok(typeof model.lookupAvailability === 'function');
});
