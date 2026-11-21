import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { EWALLET_OPENING_BALANCE_QAR } from '../data/prepaidActivation';
import type { AppThunk } from './types';

/**
 * The prototype's eWallet balances, by role. MOCK: there is no eWallet integration - the opening balance comes from data/prepaidActivation.ts, lives in the front end only
 * (it resets with the page) and is reduced when a payment from the eWallet is confirmed. Never persisted.
 */
export interface EWalletState {
  balances: Record<string, number>;
}

export const eWalletInitialState: EWalletState = { balances: { ...EWALLET_OPENING_BALANCE_QAR } };

const slice = createSlice({
  name: 'eWallet',
  initialState: eWalletInitialState,
  reducers: {
    /** The balance after a deduction the caller has already checked against the balance. */
    balanceSet(state, action: PayloadAction<{ roleId: string; balance: number }>) {
      state.balances[action.payload.roleId] = action.payload.balance;
    },
  },
});

export const eWalletReducer = slice.reducer;

export const eWalletBalanceOf = (s: { eWallet: EWalletState }, roleId: string): number => s.eWallet.balances[roleId] ?? 0;

export const eWalletActions = {
  /** Simulates the automatic deduction on payment confirmation; refuses (returns false, changes nothing) when the balance does not cover the amount. */
  deduct:
    (roleId: string, amountQar: number): AppThunk<boolean> =>
    (dispatch, getState) => {
      const balance = getState().eWallet.balances[roleId] ?? 0;
      if (amountQar < 0 || amountQar > balance) return false;
      dispatch(slice.actions.balanceSet({ roleId, balance: Math.round((balance - amountQar) * 100) / 100 }));
      return true;
    },
};
