import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { customerContextActions } from './customerContextSlice';
import { resetApplicationState } from '../auth/resetSession';
import type { PersistConfig } from './persist';
import type { AppThunk } from './types';

export interface AgentProfile {
  userId: string;
  name: string;
  jobTitle: string;
  team: string;
  /** Agent 360 BRSD APM-08/DF-AGT-006 - MFA is off by default; method values
   * are a placeholder LOV (OI-AGN-06 leaves the real allowed set open). */
  mfaEnabled?: boolean;
  mfaMethod?: 'Authenticator App' | 'SMS OTP';
}

export interface AuthState {
  isAuthenticated: boolean;
  staffId: string;
  profile: AgentProfile | null;
}

export const authInitialState: AuthState = { isAuthenticated: false, staffId: '', profile: null };

// Mocked SSO gate - no real backend, so "signing in" just flips this flag.
// Persisted like the persona slice so a page refresh doesn't force re-login.
// `profile` is resolved from users-agents.json at sign-in time (see
// LoginPage's pickProfileForRole) rather than typed in, matching how the
// rest of the app treats identity as already-known-by-the-system once
// authenticated (QID/MOI lookups work the same way).
const slice = createSlice({
  name: 'auth',
  initialState: authInitialState,
  reducers: {
    signIn: {
      reducer(state, action: PayloadAction<{ staffId: string; profile: AgentProfile }>) {
        state.isAuthenticated = true;
        state.staffId = action.payload.staffId;
        state.profile = action.payload.profile;
      },
      prepare: (staffId: string, profile: AgentProfile) => ({ payload: { staffId, profile } }),
    },
    signedOut(state) {
      state.isAuthenticated = false;
      state.staffId = '';
      state.profile = null;
    },
    /** Re-resolve the displayed identity (name/job title/team) when switching
     * role from the profile menu, without a full sign-out/sign-in - staffId is
     * unchanged since that's the logged-in user, not the active role. */
    setProfile(state, action: PayloadAction<AgentProfile>) {
      state.profile = action.payload;
    },
  },
});

export const authReducer = slice.reducer;

export const authActions = {
  signIn: slice.actions.signIn,
  setProfile: slice.actions.setProfile,
  // Signing out ends the session (there is no idle timeout in this prototype): every persisted
  // slice is cleared and the page reloads, so the next login starts from the code's defaults
  // (see resetApplicationState).
  signOut: (): AppThunk => (dispatch) => {
    dispatch(customerContextActions.endJourney());
    dispatch(slice.actions.signedOut());
    resetApplicationState();
  },
};

export const authPersist: PersistConfig<AuthState> = {
  key: 'vfq-auth-store',
  // Bumped alongside the persona slice for the 2026-09-24 persona re-key. A
  // persisted session carries a staffId whose meaning may have changed
  // (VFQ12342-VFQ12347 all map to different roles now) and a profile
  // resolved from the old 3-identity directory, so the only safe
  // migration is to require a fresh sign-in.
  version: 2,
  migrate: () => ({ ...authInitialState }),
};
