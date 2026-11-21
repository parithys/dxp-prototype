import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loadConfig, getPersona } from '../engines/configEngine';
import { resolveRoleFromStaffId } from '../auth/staffIdRoleMap';
import { seedMockData } from '../services/mockData';
import { authActions } from './authSlice';
import { personaActions, DEFAULT_PERSONA_ID } from './personaSlice';
import type { AppThunk } from './types';

export interface ConfigState {
  ready: boolean;
  error: string | null;
}

export const configInitialState: ConfigState = { ready: false, error: null };

const slice = createSlice({
  name: 'config',
  initialState: configInitialState,
  reducers: {
    bootSucceeded(state) {
      state.ready = true;
      state.error = null;
    },
    bootFailed(state, action: PayloadAction<string>) {
      state.ready = false;
      state.error = action.payload;
    },
  },
});

export const configReducer = slice.reducer;

/** Drops a persisted session/role that no longer resolves against config.
 *
 * Runs after loadConfig() so it can check the real source of truth rather than
 * guessing from the id shape. Needed because a persisted payload's `migrate` only fires
 * for payloads that carry a `version`, and state persisted before versioning
 * was introduced has none - so a returning
 * user could otherwise boot holding a Staff ID or role id that was removed in
 * the 2026-09-24 re-key. Symptoms would have been silent rather than loud:
 * a blank greeting, an empty role switcher, and every capability gate false.
 *
 * Also covers the narrower ongoing case of a role being removed from
 * personas.json in some later change. */

/** Drops a persisted session/role that no longer resolves against config.
 *
 * Runs after loadConfig() so it can check the real source of truth rather than
 * guessing from the id shape. Needed because a persisted payload's `migrate` only fires
 * for payloads that carry a `version`, and state persisted before versioning
 * was introduced has none - so a returning
 * user could otherwise boot holding a Staff ID or role id that was removed in
 * the 2026-09-24 re-key. Symptoms would have been silent rather than loud:
 * a blank greeting, an empty role switcher, and every capability gate false.
 *
 * Also covers the narrower ongoing case of a role being removed from
 * personas.json in some later change. */
const dropStaleSession = (): AppThunk => (dispatch, getState) => {
  if (!getPersona(getState().persona.activePersonaId)) {
    dispatch(personaActions.setActivePersona(DEFAULT_PERSONA_ID));
  }
  // Must go through resolveRoleFromStaffId, not a direct staffId lookup: the
  // sign-in flow persists the Staff ID exactly as typed, so a user who entered
  // "vfq-12361" or "VFQ 12361" has a non-canonical string stored. An exact
  // match would fail to resolve it and sign them out on every reload.
  const { isAuthenticated, staffId } = getState().auth;
  if (isAuthenticated && !resolveRoleFromStaffId(staffId)) {
    dispatch(authActions.signOut());
  }
};

export const configActions = {
  // Boot-time loader (frontend-architecture.md §10) - reads all config/*.json and
  // mock-data/*.json once; screens/components read through the engine accessors,
  // never these files directly.
  boot: (): AppThunk<Promise<void>> => async (dispatch) => {
    try {
      await Promise.all([loadConfig(), seedMockData()]);
      dispatch(dropStaleSession());
      dispatch(slice.actions.bootSucceeded());
    } catch (err) {
      console.error('[configSlice] boot failed:', err);
      dispatch(slice.actions.bootFailed(err instanceof Error ? err.message : String(err)));
    }
  },
};
