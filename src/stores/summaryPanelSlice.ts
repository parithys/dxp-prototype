import { createSlice } from '@reduxjs/toolkit';
import type { PersistConfig } from './persist';

export interface SummaryPanelState {
  /** Desktop only: true = the Journey Summary is folded to a slim rail on the right; false (default) = the full panel. */
  collapsed: boolean;
}

export const summaryPanelInitialState: SummaryPanelState = { collapsed: false };

const slice = createSlice({
  name: 'summaryPanel',
  initialState: summaryPanelInitialState,
  reducers: {
    toggleCollapsed(state) {
      state.collapsed = !state.collapsed;
    },
  },
});

export const summaryPanelReducer = slice.reducer;
export const summaryPanelActions = slice.actions;

/** A real preference, so persisted; cleared on sign-out with the other `vfq-` keys (see resetApplicationState). */
export const summaryPanelPersist: PersistConfig<SummaryPanelState> = {
  key: 'vfq-summary-panel',
  version: 1,
  partialize: (state) => ({ collapsed: state.collapsed }),
};
