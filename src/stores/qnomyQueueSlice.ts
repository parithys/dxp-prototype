import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface QnomyQueueState {
  /** The Qnomy ticket THIS login session pulled from the queue, or null.
   *
   * Assignment is session-owned on purpose. The header previously showed any
   * ticket whose status was 'Fed to Agent-in-DXP' for the loaded customer, so a
   * pre-fed seed record made it look as though a customer had been assigned to
   * the agent the moment they logged in. A ticket is now only ever "yours"
   * because you clicked Next Customer in this session. */
  assignedQTicketId: string | null;
  /** The mobile number the customer typed on the Qnomy kiosk, carried for the
   * whole interaction. Held here rather than on customerContext because it
   * belongs to the INTERACTION, not to a customer record - a walk-in whose
   * number matches nobody on file still has a kiosk number that the journey
   * needs to keep and pre-fill. */
  kioskMobileNumber: string | null;
  /** True in the window between an agent clicking Finish and clicking Next
   * Customer - the system must sit here and do nothing on its own; only an
   * explicit Next Customer click may end this state. */
  awaitingNext: boolean;
  /**
   * How many customers this login session has finished servicing.
   *
   * Incremented by Finish only, NOT by Abandoned: a walk-in who left before
   * servicing completed was not served, and counting them would overstate the
   * agent's throughput with the one outcome they did not achieve.
   *
   * Held here rather than derived from qtickets.json because the release path
   * writes `agentInDxpSessionId: null` when it completes a ticket - the record
   * keeps the 'Completed' status but loses the link to who completed it, so
   * the dataset cannot answer "how many did I serve".
   */
  customersServed: number;
  /**
   * The servicing timer for the ticket in hand. Starts when the agent calls Next Customer and stops when the interaction ends - Finish,
   * Done & Exit, View My Orders, Additional Comments (all through closeHeldQnomyTicket) or Abandoned. A stopped timer keeps its final
   * reading until the next call. Both are epoch milliseconds, null when no interaction has started.
   */
  serviceStartedAt: number | null;
  serviceStoppedAt: number | null;
}

export const qnomyQueueInitialState: QnomyQueueState = { assignedQTicketId: null, kioskMobileNumber: null, awaitingNext: false, customersServed: 0, serviceStartedAt: null, serviceStoppedAt: null };

// Not persisted deliberately: both fields are live front-desk state for the
// current login session, not something that should survive a hard reload as if
// the agent were still holding a customer after restarting the app. A reload
// therefore returns the agent to "no customer called", which is the correct
// starting state.
const slice = createSlice({
  name: 'qnomyQueue',
  initialState: qnomyQueueInitialState,
  reducers: {
    setAssignedQTicketId(state, action: PayloadAction<string | null>) {
      state.assignedQTicketId = action.payload;
    },
    setKioskMobileNumber(state, action: PayloadAction<string | null>) {
      state.kioskMobileNumber = action.payload;
    },
    setAwaitingNext(state, action: PayloadAction<boolean>) {
      state.awaitingNext = action.payload;
    },
    startServiceTimer(state, action: PayloadAction<number>) {
      state.serviceStartedAt = action.payload;
      state.serviceStoppedAt = null;
    },
    stopServiceTimer(state, action: PayloadAction<number>) {
      if (state.serviceStartedAt !== null && state.serviceStoppedAt == null) state.serviceStoppedAt = action.payload;
    },
    recordCustomerServed(state) {
      state.customersServed += 1;
    },
  },
});

export const qnomyQueueReducer = slice.reducer;
export const qnomyQueueActions = slice.actions;
