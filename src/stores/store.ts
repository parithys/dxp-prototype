// The application's one Redux store: a slice per area of state (persona, auth, workflow, customer context ...), the application's whole
// client state. Screens read it through `useAppSelector` / `useAction` (hooks.ts); code outside React (engines, stores) uses `store`.
import { combineReducers, configureStore, createAction, type UnknownAction } from '@reduxjs/toolkit';
import { setAutoFreeze } from 'immer';
import { apiSlice } from '../services/apiSlice';
import { hydrateSlice, persistSlices, type PersistConfig } from './persist';
import { appPath } from '../lib/basePath';
import { authInitialState, authPersist, authReducer } from './authSlice';
import { configInitialState, configReducer } from './configSlice';
import { customerContextInitialState, customerContextPersist, customerContextReducer } from './customerContextSlice';
import { customerVerificationInitialState, customerVerificationPersist, customerVerificationReducer } from './customerVerificationSlice';
import { devModeInitialState, devModePersist, devModeReducer } from './devModeSlice';
import { eWalletInitialState, eWalletReducer } from './eWalletSlice';
import { notificationInitialState, notificationReducer } from './notificationSlice';
import { outcomePreviewReducer } from './outcomePreviewSlice';
import { personaInitialState, personaPersist, personaReducer } from './personaSlice';
import { qnomyQueueInitialState, qnomyQueueReducer } from './qnomyQueueSlice';
import { regionInitialState, regionPersist, regionReducer } from './regionSlice';
import { serviceFaultsReducer } from './serviceFaultsSlice';
import { sidebarInitialState, sidebarPersist, sidebarReducer } from './sidebarSlice';
import { summaryPanelInitialState, summaryPanelPersist, summaryPanelReducer } from './summaryPanelSlice';
import { themeInitialState, themePersist, themeReducer } from './themeSlice';
import { workflowInitialState, workflowPersist, workflowReducer } from './workflowSlice';

// The entity cache holds the mock-data engine's own record objects, and the engine keeps working on them: Immer must not freeze them.
setAutoFreeze(false);

const sliceReducers = {
  // RTK Query's cache (services/apiSlice.ts). Never persisted: it is rebuilt from the API on demand.
  [apiSlice.reducerPath]: apiSlice.reducer,
  auth: authReducer,
  config: configReducer,
  customerContext: customerContextReducer,
  customerVerification: customerVerificationReducer,
  devMode: devModeReducer,
  eWallet: eWalletReducer,
  notification: notificationReducer,
  outcomePreview: outcomePreviewReducer,
  persona: personaReducer,
  qnomyQueue: qnomyQueueReducer,
  region: regionReducer,
  serviceFaults: serviceFaultsReducer,
  sidebar: sidebarReducer,
  summaryPanel: summaryPanelReducer,
  theme: themeReducer,
  workflow: workflowReducer,
};

export type RootState = { [K in keyof typeof sliceReducers]: ReturnType<(typeof sliceReducers)[K]> };

/** Seeds a slice with a partial state: for tests and tooling that need a known starting point. Application code uses each slice's own actions. */

/** Seeds a slice with a partial state: for tests and tooling that need a known starting point. Application code uses each slice's own actions. */
export const patchSliceState = createAction<{ slice: keyof RootState; patch: Record<string, unknown> }>('app/patchSliceState');

const combined = combineReducers(sliceReducers);
const rootReducer = (state: RootState | undefined, action: UnknownAction): RootState => {
  if (patchSliceState.match(action)) {
    const base = state ?? combined(undefined, { type: '@@init' });
    return { ...base, [action.payload.slice]: { ...base[action.payload.slice], ...action.payload.patch } } as RootState;
  }
  return combined(state, action);
};

// What the browser saved, read once at start-up (the persisted slices; see persist.ts for the format).
const persisted: { [K in keyof RootState]?: PersistConfig<RootState[K]> } = {
  auth: authPersist,
  customerContext: customerContextPersist,
  customerVerification: customerVerificationPersist,
  devMode: devModePersist,
  persona: personaPersist,
  region: regionPersist,
  sidebar: sidebarPersist,
  summaryPanel: summaryPanelPersist,
  theme: themePersist,
  workflow: workflowPersist,
};

const preloadedState: RootState = {
  api: apiSlice.reducer(undefined, { type: '@@init' }),
  auth: hydrateSlice(authInitialState, authPersist),
  config: configInitialState,
  customerContext: hydrateSlice(customerContextInitialState, customerContextPersist),
  customerVerification: hydrateSlice(customerVerificationInitialState, customerVerificationPersist),
  devMode: hydrateSlice(devModeInitialState, devModePersist),
  eWallet: eWalletInitialState,
  notification: notificationInitialState,
  outcomePreview: { open: null },
  persona: hydrateSlice(personaInitialState, personaPersist),
  qnomyQueue: qnomyQueueInitialState,
  region: hydrateSlice(regionInitialState, regionPersist),
  serviceFaults: { faults: {} },
  sidebar: hydrateSlice(sidebarInitialState, sidebarPersist),
  summaryPanel: hydrateSlice(summaryPanelInitialState, summaryPanelPersist),
  theme: hydrateSlice(themeInitialState, themePersist),
  workflow: hydrateSlice(workflowInitialState, workflowPersist),
};

export const store = configureStore({
  reducer: rootReducer,
  preloadedState,
  // The state holds the mock-data engine's records and live journey data: checking every action for
  // non-serialisable or mutated values would only slow the app down.
  middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false }).concat(apiSlice.middleware),
});

persistSlices(store, persisted);

export type AppDispatch = typeof store.dispatch;

// Signing out in one tab clears the persisted session; every other tab of the app learns of it here and returns to the
// login screen instead of carrying on as an agent who is no longer signed in.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (e) => {
    if (e.key !== authPersist.key || !store.getState().auth.isAuthenticated) return;
    let stillSignedIn = false;
    try {
      stillSignedIn = Boolean(e.newValue && JSON.parse(e.newValue)?.state?.isAuthenticated);
    } catch {
      /* an unreadable value is treated as signed out */
    }
    if (!stillSignedIn) window.location.replace(appPath('/'));
  });
}
