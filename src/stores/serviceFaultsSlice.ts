import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { FaultKind, ServiceName } from '../engines/serviceCall';

// Fault injection for demos: lets a demo arm each failure kind of a system call so the recovery states can be shown. Inert unless a
// fault is armed (see engines/serviceCall.ts).
export interface Fault {
  kind: FaultKind;
  /** Calls left that will fail (or return duplicates) before the service recovers. */
  remaining: number;
}

export interface ServiceFaultsState {
  faults: Partial<Record<ServiceName, Fault>>;
}

const slice = createSlice({
  name: 'serviceFaults',
  initialState: { faults: {} } as ServiceFaultsState,
  reducers: {
    arm: {
      reducer(state, action: PayloadAction<{ service: ServiceName; kind: FaultKind; remaining: number }>) {
        state.faults[action.payload.service] = { kind: action.payload.kind, remaining: action.payload.remaining };
      },
      prepare: (service: ServiceName, kind: FaultKind, remaining: number) => ({ payload: { service, kind, remaining } }),
    },
    /** One call of a fault has been used up. */
    faultConsumed(state, action: PayloadAction<ServiceName>) {
      const f = state.faults[action.payload];
      if (f) f.remaining -= 1;
    },
    clear(state) {
      state.faults = {};
    },
  },
});

export const serviceFaultsReducer = slice.reducer;
export const serviceFaultsActions = slice.actions;
