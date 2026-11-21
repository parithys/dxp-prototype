import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type OutcomeKey = 'Hard Stop' | 'Soft Stop' | 'Approval Routing' | 'Advisory Only';

export interface OutcomePreviewState {
  open: OutcomeKey | null;
}

// The footer links and the inline panel of the Eligibility step live in different parts of the wizard
// (footer vs step body), so the selected outcome is shared through this slice.
const slice = createSlice({
  name: 'outcomePreview',
  initialState: { open: null } as OutcomePreviewState,
  reducers: {
    toggle(state, action: PayloadAction<OutcomeKey>) {
      state.open = state.open === action.payload ? null : action.payload;
    },
    close(state) {
      state.open = null;
    },
  },
});

export const outcomePreviewReducer = slice.reducer;
export const outcomePreviewActions = slice.actions;
