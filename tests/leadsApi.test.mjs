// The API layer (RTK Query, services/apiSlice.ts) serving leads from the mock data: the whole list, filters and paging, the empty and
// not-found cases, the simulated delay, mutations that refresh the cache - and that a lead written through the generic entity operations
// (activation, cross-sell) refreshes it too, and the other way round.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';
import { storeApi } from './storeTesting.mjs';

let api, engine, ops, store;
before(async () => {
  await boot();
  api = (await load('/src/services/apiSlice.ts')).apiSlice;
  engine = await load('/src/engines/mockDataEngine.ts');
  ops = await load('/src/services/entityOps.ts');
  ({ store } = await storeApi());
});
after(close);

const seeded = JSON.parse(fs.readFileSync('public/mock-data/leads.json', 'utf8'));
const run = (initiate) => store.dispatch(initiate);
/** Waits for an asynchronous refetch to land (mock calls take a simulated delay each). */
const until = async (check, ms = 6000) => {
  for (const start = Date.now(); Date.now() - start < ms; await new Promise((r) => setTimeout(r, 50))) if (check()) return;
  assert.fail('timed out waiting for the cache to refresh');
};
const cachedLeads = () => api.endpoints.getLeads.select()(store.getState()).data?.items ?? [];

test('the lead list is the mock data - every record, once - after the simulated delay', async () => {
  const t0 = Date.now();
  const res = await run(api.endpoints.getLeads.initiate(undefined, { forceRefetch: true }));
  assert.ok(Date.now() - t0 >= engine.LATENCY_MIN - 20, 'the call takes the mock engine\'s simulated latency, so a loading state is visible');
  assert.equal(res.isSuccess, true);
  assert.deepEqual(res.data.items.map((l) => l.leadId), seeded.map((l) => l.leadId));
  assert.deepEqual([res.data.total, res.data.page, res.data.pageSize], [seeded.length, 1, seeded.length]);
});

test('filters, paging and the empty case', async () => {
  const get = (args) => run(api.endpoints.getLeads.initiate(args, { forceRefetch: true })).then((r) => r.data);
  const news = await get({ status: 'New' });
  assert.deepEqual(news.items.map((l) => l.leadId), seeded.filter((l) => l.status === 'New').map((l) => l.leadId));
  const p2 = await get({ page: 2, pageSize: 4 });
  assert.deepEqual([p2.items.length, p2.total, p2.page, p2.pageSize], [4, seeded.length, 2, 4]);
  assert.deepEqual(p2.items.map((l) => l.leadId), seeded.slice(4, 8).map((l) => l.leadId));
  assert.equal((await get({ page: 99, pageSize: 4 })).items.length, 0, 'past the end: an empty page, not an error');
  const none = await get({ status: 'No Such Status' });
  assert.deepEqual([none.items, none.total], [[], 0], 'no match: an empty list to render the empty state');
  const byId = await get({ search: seeded[0].leadId.toLowerCase() });
  assert.deepEqual(byId.items.map((l) => l.leadId), [seeded[0].leadId], 'search is case-insensitive');
});

test('one lead by id; an unknown id is a 404 error the screen can show', async () => {
  const ok = await run(api.endpoints.getLead.initiate(seeded[1].leadId));
  assert.equal(ok.data.leadId, seeded[1].leadId);
  const missing = await run(api.endpoints.getLead.initiate('LEAD-NOPE'));
  assert.deepEqual([missing.isError, missing.error.status, missing.error.data.message], [true, 404, 'No lead LEAD-NOPE']);
});

test('a second ask for the same list is served from the cache, with no new call', async () => {
  await run(api.endpoints.getLeads.initiate({ status: 'Contacted' }, { forceRefetch: true }));
  const t0 = Date.now();
  const again = await run(api.endpoints.getLeads.initiate({ status: 'Contacted' }));
  assert.ok(Date.now() - t0 < engine.LATENCY_MIN / 2, 'cached: no simulated delay');
  assert.equal(again.isSuccess, true);
});

test('creating and updating a lead refreshes the cached list; the cache stays one with the engine', async () => {
  const sub = store.dispatch(api.endpoints.getLeads.initiate());
  const before = (await sub).data.items.length;
  const created = await store.dispatch(api.endpoints.createLead.initiate({ leadId: 'LEAD-API-1', serviceNeeded: 'Mobile', status: 'New', ownerId: 'AGENT-X', createdVia: 'Test' }));
  assert.equal(created.data.leadId, 'LEAD-API-1');
  await until(() => cachedLeads().length === before + 1);
  assert.equal(cachedLeads().length, before + 1, 'the active list refetched after the mutation');
  await store.dispatch(api.endpoints.updateLead.initiate({ leadId: 'LEAD-API-1', patch: { status: 'Contacted' } }));
  await until(() => cachedLeads().find((l) => l.leadId === 'LEAD-API-1')?.status === 'Contacted');
  const bad = await store.dispatch(api.endpoints.updateLead.initiate({ leadId: 'LEAD-NOPE', patch: { status: 'New' } }));
  assert.equal(bad.error.status, 404);
  sub.unsubscribe();
});

test('a lead written through the generic entity operations (activation, cross-sell, the lead screens) refreshes the typed lead views too', async () => {
  const sub = store.dispatch(api.endpoints.getLeads.initiate());
  const before = (await sub).data.items.length;
  await ops.entityOps.createRecord('leads', { leadId: 'LEAD-ENT-1', serviceNeeded: 'Home', status: 'New', ownerId: 'AGENT-Y', createdVia: 'Test' });
  await until(() => cachedLeads().length === before + 1);
  sub.unsubscribe();
});

test('a lead written through the typed API refreshes the generic list of leads that other screens read - one answer for the dashboard counts and owner filters', async () => {
  const sub = store.dispatch(api.endpoints.listEntities.initiate('leads'));
  const rows = () => api.endpoints.listEntities.select('leads')(store.getState()).data ?? [];
  const target = (await sub).data[0].leadId;
  await store.dispatch(api.endpoints.updateLead.initiate({ leadId: target, patch: { ownerId: 'AGENT-REASSIGNED' } }));
  await until(() => rows().find((r) => r.leadId === target)?.ownerId === 'AGENT-REASSIGNED');
  sub.unsubscribe();
});

test('generic writes patch the cached list at once, only extend a list that was loaded, and an update of a missing id changes nothing', async () => {
  const sub = store.dispatch(api.endpoints.listEntities.initiate('leads'));
  const rows = () => api.endpoints.listEntities.select('leads')(store.getState()).data ?? [];
  await sub;
  const n = rows().length;
  await ops.entityOps.createRecord('leads', { leadId: 'LEAD-ENT-2', serviceNeeded: 'Mobile', status: 'New', ownerId: 'AGENT-Z', createdVia: 'Test' });
  assert.equal(rows().length, n + 1, 'the list shows the new record at once, without waiting for the refetch');
  assert.equal(rows().filter((r) => r.leadId === 'LEAD-ENT-2').length, 1, 'once, not twice');
  await ops.entityOps.updateRecord('leads', 'leadId', 'LEAD-ENT-2', { status: 'Contacted' });
  assert.equal(rows().find((r) => r.leadId === 'LEAD-ENT-2').status, 'Contacted');
  await ops.entityOps.updateRecord('leads', 'leadId', 'LEAD-NOPE', { status: 'Rejected' });
  assert.equal(rows().filter((r) => r.status === 'Rejected').length, seeded.filter((l) => l.status === 'Rejected').length, 'no record has that id: nothing changes');
  await ops.entityOps.removeRecord('leads', 'leadId', 'LEAD-ENT-2');
  assert.equal(rows().length, n);
  sub.unsubscribe();
});

test('an ID document added to a customer is written to the audit trail (and the cached trail), a customer edit writes a row per changed field', async () => {
  const trail = store.dispatch(api.endpoints.listEntities.initiate('audit-trail'));
  const rows = () => api.endpoints.listEntities.select('audit-trail')(store.getState()).data ?? [];
  const n = (await trail).data.length;
  await ops.entityOps.createRecord('identity-documents', { identityDocumentId: 'IDD-API-1', customerId: 'CUST-1007', documentType: 'QID', documentNumber: '29999999998' });
  assert.equal(rows().length, n + 1);
  assert.equal(rows().at(-1).fieldModified, 'ID Document Added');
  await ops.entityOps.updateRecord('customers', 'customerId', 'CUST-1007', { idType: 'Diplomatic ID' }, { by: 'tester', how: 'Test edit' });
  assert.equal(rows().length, n + 2);
  assert.deepEqual([rows().at(-1).fieldModified, rows().at(-1).changeBasis], ['ID Type', 'Test edit']);
  trail.unsubscribe();
});

test('the sign-in news is an API endpoint, and a missing file is an error the screen turns into "no news"', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), headers: new Headers(), clone() { return this; }, text: async () => '' });
  const res = await store.dispatch(api.endpoints.getNews.initiate(undefined, { forceRefetch: true }));
  assert.equal(res.isError, true);
});

test('the API cache is registered in the store and is never persisted', () => {
  assert.ok(store.getState().api, 'the api reducer is mounted under its reducerPath');
  const persisted = fs.readFileSync('src/stores/store.ts', 'utf8').match(/const persisted[\s\S]*?\n};/)[0];
  assert.doesNotMatch(persisted, /\bapi\b/);
});

test('the lead details screen reads one lead and writes through the API layer: loading, failed and not found stay distinct', () => {
  const src = fs.readFileSync('src/modules/lead-management/LeadDetailsView.tsx', 'utf8');
  assert.match(src, /useGetLeadQuery\(leadId \?\? skipToken\)/, 'this one lead, and nothing is fetched without an id');
  assert.match(src, /useUpdateLeadMutation\(\)/);
  assert.match(src, /\.unwrap\(\)/, 'a failed write throws, so the submit guard reports it');
  assert.doesNotMatch(src, /entityActions|s\.entity\./, 'no second copy of the lead state');
  assert.match(src, /error\.status === 404/, 'a 404 is "not found"');
  assert.match(src, /error=\{isError && !notFound\}/, 'any other failure is a load error with a retry');
  assert.match(src, /loading=\{isLoading\}/);
});
