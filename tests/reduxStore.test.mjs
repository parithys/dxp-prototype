// The Redux store: what the browser saved is read back exactly as the app's persisted state has always been written, the slices keep the
// behaviours the screens depend on (no-op updates keep the same reference, a held journey cannot be replaced), and persistence writes the
// `{ state, version }` envelope under the same `vfq-` keys that sign-out clears by prefix.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { load, close } from './harness.mjs';
import { storeApi } from './storeTesting.mjs';

let persist, persona, region, sidebar, auth, theme, ctxSlice, notif, workflow, redux;
before(async () => {
  persist = await load('/src/stores/persist.ts');
  persona = await load('/src/stores/personaSlice.ts');
  region = await load('/src/stores/regionSlice.ts');
  sidebar = await load('/src/stores/sidebarSlice.ts');
  auth = await load('/src/stores/authSlice.ts');
  theme = await load('/src/stores/themeSlice.ts');
  ctxSlice = await load('/src/stores/customerContextSlice.ts');
  notif = await load('/src/stores/notificationSlice.ts');
  workflow = await load('/src/stores/workflowSlice.ts');
  redux = await storeApi();
});
after(close);
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const save = (key, state, version, storage = localStorage) => storage.setItem(key, JSON.stringify(version === undefined ? { state } : { state, version }));

// ---- reading back what was saved ------------------------------------------------------------------------------------------------
test('persona: a current save is kept; a dead id (older version, or saved before versioning) falls back to the default role', () => {
  const read = () => persist.hydrateSlice(persona.personaInitialState, persona.personaPersist).activePersonaId;
  assert.equal(read(), persona.DEFAULT_PERSONA_ID, 'nothing saved');
  save('vfq-persona-store', { activePersonaId: 'ROLE-12' }, 2);
  assert.equal(read(), 'ROLE-12');
  save('vfq-persona-store', { activePersonaId: 'PERSONA-024' }, 1);
  assert.equal(read(), persona.DEFAULT_PERSONA_ID, 'an older version is migrated to the default');
  save('vfq-persona-store', { activePersonaId: 'PERSONA-024' }, undefined);
  assert.equal(read(), persona.DEFAULT_PERSONA_ID, 'no version at all: the id shape is validated instead');
  save('vfq-persona-store', { activePersonaId: 'ROLE-05' }, undefined);
  assert.equal(read(), 'ROLE-05', 'no version, but a valid id');
});

test('auth: a session saved before the persona re-key requires a fresh sign-in; a current one is kept', () => {
  const read = () => persist.hydrateSlice(auth.authInitialState, auth.authPersist);
  save('vfq-auth-store', { isAuthenticated: true, staffId: 'VFQ12341', profile: { userId: 'u' } }, 1);
  assert.deepEqual(read(), { isAuthenticated: false, staffId: '', profile: null });
  save('vfq-auth-store', { isAuthenticated: true, staffId: 'VFQ12341', profile: { userId: 'u' } }, 2);
  assert.equal(read().isAuthenticated, true);
});

test('region and sidebar: unknown ids are dropped, an empty list of open groups is respected, an old sidebar is reset once', () => {
  save('vfq-region-store', { regionId: 'NOWHERE' });
  assert.equal(persist.hydrateSlice(region.regionInitialState, region.regionPersist).regionId, 'DOHA-CENTRAL');
  save('vfq-region-store', { regionId: 'AL-WAKRAH' });
  assert.equal(persist.hydrateSlice(region.regionInitialState, region.regionPersist).regionId, 'AL-WAKRAH');
  const read = () => persist.hydrateSlice(sidebar.sidebarInitialState, sidebar.sidebarPersist);
  save('vfq-sidebar-store', { pinned: false, expandedNavKeys: ['mobile'] }, 4);
  assert.deepEqual([read().pinned, read().expandedNavKeys], [true, []], 'version 4 -> 5 resets to pinned and collapsed');
  save('vfq-sidebar-store', { pinned: false, expandedNavKeys: [] }, 5);
  assert.deepEqual([read().pinned, read().expandedNavKeys], [false, []], 'a current empty list stays empty');
  save('vfq-sidebar-store', { pinned: true, expandedNavKeys: ['mobile', 'gone-key'] }, 5);
  assert.deepEqual(read().expandedNavKeys, ['mobile'], 'keys that left the nav manifest are dropped');
  assert.equal(read().mobileOpen, false, 'the mobile drawer is never restored');
});

test('customer context: the viewed customer comes from localStorage and the journey hold from sessionStorage, as before the merge into one slice', () => {
  const customer = { customerId: 'CUST-1', name: 'A' };
  save('vfq-active-customer-store', { customer, recentCustomerIds: ['CUST-1'] }, 0);
  save('vfq-journey-customer', { active: { wizardId: 'w', customerName: 'A' } }, 0, sessionStorage);
  const s = persist.hydrateSlice(ctxSlice.customerContextInitialState, ctxSlice.customerContextPersist);
  assert.deepEqual([s.customer, s.recentCustomerIds, s.journey?.wizardId], [customer, ['CUST-1'], 'w']);
  localStorage.setItem('vfq-active-customer-store', '{not json');
  assert.deepEqual(persist.hydrateSlice(ctxSlice.customerContextInitialState, ctxSlice.customerContextPersist), ctxSlice.customerContextInitialState, 'unreadable saved state is ignored');
});

test('the workflow drafts are read from sessionStorage', () => {
  save('vfq-workflow-store', { drafts: { w: { currentStep: 2, maxStepReached: 3, values: {} } } }, 0, sessionStorage);
  assert.equal(persist.hydrateSlice(workflow.workflowInitialState, workflow.workflowPersist).drafts.w.currentStep, 2);
});

// ---- writing ---------------------------------------------------------------------------------------------------------------------
test('a changed persisted slice is written as { state, version } under its vfq- key; an unchanged one is not rewritten; only the chosen fields are written', () => {
  let state = { theme: theme.themeInitialState, sidebar: sidebar.sidebarInitialState };
  const listeners = [];
  persist.persistSlices({ getState: () => state, subscribe: (l) => void listeners.push(l) }, { theme: theme.themePersist, sidebar: sidebar.sidebarPersist });
  const notify = () => listeners.forEach((l) => l());
  notify();
  assert.equal(localStorage.getItem('vfq-theme-store'), null, 'nothing changed: nothing written');
  state = { ...state, theme: { theme: 'dark' } };
  notify();
  assert.deepEqual(JSON.parse(localStorage.getItem('vfq-theme-store')), { state: { theme: 'dark' }, version: 0 });
  state = { ...state, sidebar: { ...state.sidebar, mobileOpen: true, peeking: true } };
  notify();
  assert.deepEqual(JSON.parse(localStorage.getItem('vfq-sidebar-store')), { state: { pinned: true, expandedNavKeys: [] }, version: 5 }, 'the drawer state is not persisted');
});

// ---- slices ----------------------------------------------------------------------------------------------------------------------
const journey = (extra = {}) => ({ wizardId: 'w1', path: '/p', journey: 'J', customerName: 'A', idNumber: '1', startedAt: 'now', ...extra });

test('customer context: a held journey cannot be replaced; a patch that changes nothing keeps the very same state (effects patch it in a loop)', () => {
  const { store } = redux;
  const A = ctxSlice.customerContextActions;
  store.dispatch(A.endJourney());
  store.dispatch(A.beginJourney(journey()));
  store.dispatch(A.beginJourney(journey({ wizardId: 'w2', customerName: 'B' })));
  assert.equal(store.getState().customerContext.journey.wizardId, 'w1', 'the customer can never be switched');
  store.dispatch(A.patchJourney('w1', { customerId: 'CUST-9', segment: 'Consumer' }));
  const before = store.getState().customerContext;
  store.dispatch(A.patchJourney('w1', { customerId: 'CUST-9', segment: 'Consumer' }));
  assert.equal(store.getState().customerContext, before, 'no change: same reference');
  store.dispatch(A.patchJourney('other', { customerId: 'CUST-1' }));
  assert.equal(store.getState().customerContext, before, 'another journey cannot patch it');
  const order = { id: 'O1' };
  store.dispatch(A.patchJourney('w1', { finalOrder: order }));
  const withOrder = store.getState().customerContext;
  store.dispatch(A.patchJourney('w1', { finalOrder: order }));
  assert.equal(store.getState().customerContext, withOrder, 'the same object patched again is no change either');
  store.dispatch(A.patchJourney('w1', { customerId: 'CUST-10' }));
  assert.equal(store.getState().customerContext.journey.segment, undefined, 'a different customer drops the segment learned for the previous one');
  store.dispatch(A.endJourney('other'));
  assert.ok(store.getState().customerContext.journey, 'another journey cannot end it');
  store.dispatch(A.endJourney('w1'));
  assert.equal(store.getState().customerContext.journey, null);
});

test('customer context: forgetting customers clears the active customer, the recent list and a journey held for them', () => {
  const { store } = redux;
  const A = ctxSlice.customerContextActions;
  const c = (id) => ({ customerId: id, name: id, qid: 'q', idType: 'QID', dob: 'd', nationality: 'n', segment: 'Consumer', blacklisted: false });
  store.dispatch(A.setActiveCustomer(c('CUST-1')));
  store.dispatch(A.setActiveCustomer(c('CUST-2')));
  store.dispatch(A.beginJourney(journey({ customerId: 'CUST-2' })));
  store.dispatch(A.forgetCustomers(new Set(['CUST-2'])));
  const s = store.getState().customerContext;
  assert.deepEqual([s.customer, s.recentCustomerIds, s.journey], [null, ['CUST-1'], null]);
});

test('notifications: a keyed re-push replaces the toast and its history entry (same id, no duplicate); the history is capped', () => {
  const { store } = redux;
  store.dispatch(notif.notificationActions.dismissAllToasts());
  store.dispatch(notif.notificationActions.purgeMentioning(['']));
  const A = notif.notificationActions;
  store.dispatch(A.pushToast('info', 'first', { key: 'k' }));
  const id = store.getState().notification.toasts.find((t) => t.key === 'k').id;
  store.dispatch(A.pushToast('info', 'second', { key: 'k' }));
  const { toasts, history } = store.getState().notification;
  assert.deepEqual([toasts.filter((t) => t.key === 'k').length, toasts.find((t) => t.key === 'k').id, toasts.find((t) => t.key === 'k').message], [1, id, 'second']);
  assert.deepEqual([history.filter((h) => h.key === 'k').length, history[0].message], [1, 'second']);
  for (let i = 0; i < 40; i += 1) store.dispatch(A.pushToast('info', `m${i}`));
  assert.equal(store.getState().notification.history.length, 30);
});

test('workflow: a draft is created on first write; consuming a resume target returns it once; clearing removes the draft', () => {
  const { store } = redux;
  const A = workflow.workflowActions;
  store.dispatch(A.clearDraft('wf'));
  assert.equal(workflow.selectDraft(store.getState(), 'wf').currentStep, 0, 'an absent draft reads as the shared empty draft');
  store.dispatch(A.hydrateDraft('wf', { currentStep: 4, maxStepReached: 5, values: { a: 1 }, resumeToStepKey: 'payment' }));
  assert.equal(store.dispatch(A.consumeResumeTarget('wf')), 'payment');
  assert.equal(store.dispatch(A.consumeResumeTarget('wf')), undefined, 'taken once');
  store.dispatch(A.setStep('wf', 2));
  assert.deepEqual([workflow.selectDraft(store.getState(), 'wf').currentStep, workflow.selectDraft(store.getState(), 'wf').maxStepReached], [2, 5], 'setStep never lowers the furthest step');
  store.dispatch(A.clearDraft('wf'));
  assert.equal(store.getState().workflow.drafts.wf, undefined);
});
