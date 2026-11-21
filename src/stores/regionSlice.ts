import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PersistConfig } from './persist';

/** Scope ids matching channel-performance.json's scopeId values. */
export const REGIONS = [
  { id: 'NATIONAL', label: 'Vodafone Qatar' },
  { id: 'DOHA-CENTRAL', label: 'Doha Central' },
  { id: 'AL-WAKRAH', label: 'Al Wakrah' },
] as const;

export interface RegionState {
  regionId: string;
}

export const regionInitialState: RegionState = { regionId: 'DOHA-CENTRAL' };

// The oversight scope a Hybrid role is looking at. Read by BOTH the header
// context chip and the dashboard zones, so "Switch" actually changes the
// numbers rather than being a decorative label.
const slice = createSlice({
  name: 'region',
  initialState: regionInitialState,
  reducers: {
    setRegion(state, action: PayloadAction<string>) {
      state.regionId = action.payload;
    },
  },
});

export const regionReducer = slice.reducer;
export const regionActions = slice.actions;

export const regionPersist: PersistConfig<RegionState> = {
  key: 'vfq-region-store',
  merge: (persisted, current) => {
    const p = (persisted ?? {}) as Partial<RegionState>;
    // Guard against a scope id that no longer exists in the seed, which
    // would leave every product metric blank with no visible cause.
    const known = REGIONS.some((r) => r.id === p.regionId);
    return { ...current, ...p, regionId: known ? p.regionId! : current.regionId };
  },
};
