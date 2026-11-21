import { createSlice } from '@reduxjs/toolkit';
import type { PersistConfig } from './persist';

/**
 * Dev Mode: a switch at the foot of the left navigation, for roles that reach Administration. It only records whether developer mode is on (off by default, remembered in the
 * browser); nothing reads it yet - developer aids attach to `s.devMode.enabled` as they are added.
 */
export interface DevModeState {
  enabled: boolean;
}

export const devModeInitialState: DevModeState = { enabled: false };

const slice = createSlice({
  name: 'devMode',
  initialState: devModeInitialState,
  reducers: {
    toggled(state) {
      state.enabled = !state.enabled;
    },
  },
});

export const devModeReducer = slice.reducer;

export const devModeActions = { toggle: slice.actions.toggled };

export const devModePersist: PersistConfig<DevModeState> = { key: 'vfq-dev-mode-store' };
