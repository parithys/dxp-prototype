import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PersistConfig } from './persist';

export interface CustomerVerificationState {
  verifiedCustomerIds: string[];
}

export const customerVerificationInitialState: CustomerVerificationState = { verifiedCustomerIds: [] };

// Customer 360 BRSD v3.1 Annex_02 status model: Unverified -> Verified, no
// transition back out of Verified. Modeled here as a one-way accumulating
// set rather than a per-customer enum precisely so "no transition out of
// Verified" is structurally impossible to violate - there is no remove/unset
// action anywhere in this slice's API.
const slice = createSlice({
  name: 'customerVerification',
  initialState: customerVerificationInitialState,
  reducers: {
    verifyCustomer(state, action: PayloadAction<string>) {
      if (!state.verifiedCustomerIds.includes(action.payload)) state.verifiedCustomerIds.push(action.payload);
    },
  },
});

export const customerVerificationReducer = slice.reducer;
export const customerVerificationActions = slice.actions;
export const isCustomerVerified = (s: { customerVerification: CustomerVerificationState }, customerId: string): boolean =>
  s.customerVerification.verifiedCustomerIds.includes(customerId);

export const customerVerificationPersist: PersistConfig<CustomerVerificationState> = { key: 'vfq-customer-verification-store' };
