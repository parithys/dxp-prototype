import { createSlice, original, type PayloadAction } from '@reduxjs/toolkit';
import type { PersistConfig, PersistStorage } from './persist';

// The ONE slice that holds who the customer is: ID, name, segment and the rest of the summary. Two
// parts share it, with different lifetimes:
//
//   customer / recentCustomerIds   The customer the agent is looking at or serving (set from Customer
//                                  Search, Customer 360, the session reference box). Cleared from the
//                                  Dashboard and Sales workspace. Survives a browser restart.
//
//   journey                        The customer a journey is being run for, held from the moment they
//                                  are identified until the journey is explicitly ended. Nothing else may
//                                  replace it while it is held:
//                                    - Close Activity on the Activity Final page
//                                    - Save as Draft
//                                    - Abandon Order
//                                    - the session ending (sign-out; it lives in sessionStorage, so
//                                      closing the tab too)
//                                  Every record the journey writes (draft order, order, activity, lead)
//                                  takes its customer from here, so they all name the same person.

export interface ActiveCustomerSummary {
  customerId: string;
  name: string;
  qid: string;
  idType: 'QID' | 'Passport';
  dob: string;
  nationality: string;
  email?: string;
  phone?: string;
  segment: string;
  blacklisted: boolean;
  /** Benefits the customer holds (retired | mada | b2b2c | loyalty | prepaid-welcome); journeys read it to choose which discounts to offer. */
  benefitEligibility?: string[];
}

export interface JourneyContext {
  /** The wizard (draft) this context belongs to. */
  wizardId: string;
  /** Where that journey lives, so another entry point can be sent back to it. */
  path: string;
  journey: string;
  customerName: string;
  idNumber: string;
  /** The kind of document idNumber is (QID, Passport, GCC ID, Diplomatic ID); unknown stays unknown, and is then shown without a type. */
  idType?: string;
  /** Known once the eligibility check has resolved the customer record. */
  customerId?: string;
  /** Known once customerId is: the customer's segment (Consumer, Enterprise ...). */
  segment?: string;
  startedAt: string;
  /** The task reference of this journey, shown wherever the journey is named so it can be quoted; a saved draft keeps it. */
  taskId?: string;
  /** Set once the order is submitted: the Activity Final page can then be shown again until it is closed. */
  finalOrder?: Record<string, unknown>;
}

// Persistence keeps the two lifetimes (and the storage keys and shapes that existed before the stores were
// merged): the viewed customer in localStorage, the journey hold in sessionStorage.
const VIEWED_KEY = 'vfq-active-customer-store';
const JOURNEY_KEY = 'vfq-journey-customer';

// Corrupt stored JSON, or storage that is full or blocked, must not break startup: unreadable state is dropped
// (so it cannot fail again on every load) and a failed write is ignored - the in-memory state still works.
const splitStorage: PersistStorage = {
  getItem: () => {
    try {
      const viewed = localStorage.getItem(VIEWED_KEY);
      const journey = sessionStorage.getItem(JOURNEY_KEY);
      if (viewed === null && journey === null) return null;
      const v = viewed ? (JSON.parse(viewed) as { state?: Record<string, unknown>; version?: number }) : {};
      const j = journey ? (JSON.parse(journey) as { state?: { active?: unknown } }) : {};
      return JSON.stringify({ state: { ...v.state, journey: j.state?.active ?? null }, version: v.version ?? 0 });
    } catch {
      try {
        localStorage.removeItem(VIEWED_KEY);
        sessionStorage.removeItem(JOURNEY_KEY);
      } catch {
        /* storage unavailable */
      }
      return null;
    }
  },
  setItem: (_name, value) => {
    try {
      const { state, version } = JSON.parse(value) as { state: { customer: unknown; recentCustomerIds: unknown; journey: unknown }; version: number };
      localStorage.setItem(VIEWED_KEY, JSON.stringify({ state: { customer: state.customer, recentCustomerIds: state.recentCustomerIds }, version }));
      sessionStorage.setItem(JOURNEY_KEY, JSON.stringify({ state: { active: state.journey }, version }));
    } catch {
      /* storage full or blocked */
    }
  },
  removeItem: () => {
    localStorage.removeItem(VIEWED_KEY);
    sessionStorage.removeItem(JOURNEY_KEY);
  },
};

export interface CustomerContextState {
  customer: ActiveCustomerSummary | null;
  recentCustomerIds: string[];
  journey: JourneyContext | null;
}

export const customerContextInitialState: CustomerContextState = { customer: null, recentCustomerIds: [], journey: null };

const slice = createSlice({
  name: 'customerContext',
  initialState: customerContextInitialState,
  reducers: {
    setActiveCustomer(state, action: PayloadAction<ActiveCustomerSummary>) {
      const customer = action.payload;
      state.customer = customer;
      state.recentCustomerIds = [customer.customerId, ...state.recentCustomerIds.filter((id) => id !== customer.customerId)].slice(0, 8);
    },
    clearActiveCustomer(state) {
      state.customer = null;
    },
    /** Forgets these customers everywhere in the context: the active one, the recent list, and a journey held for one of them. */
    customersForgotten(state, action: PayloadAction<string[]>) {
      const ids = new Set(action.payload);
      if (ids.size === 0) return;
      if (state.customer && ids.has(state.customer.customerId)) state.customer = null;
      if (state.recentCustomerIds.some((id) => ids.has(id))) state.recentCustomerIds = state.recentCustomerIds.filter((id) => !ids.has(id));
      if (state.journey?.customerId && ids.has(state.journey.customerId)) state.journey = null;
    },
    /** Starts the journey context. A no-op while one is already held - the customer can never be switched. */
    beginJourney(state, action: PayloadAction<JourneyContext>) {
      if (!state.journey) state.journey = action.payload;
    },
    /** Fills in details learned later (customer id, segment, final order) without changing who the customer is. */
    patchJourney: {
      reducer(state, action: PayloadAction<{ wizardId: string; patch: Partial<Pick<JourneyContext, 'customerId' | 'segment' | 'finalOrder'>> }>) {
        // Compared against the stored (original) journey, not the draft: reading an object field off the draft would hand back a
        // proxy that never equals the value being patched in, and every call would look like a change.
        const a = original(state.journey);
        const { wizardId, patch: p } = action.payload;
        if (!a || a.wizardId !== wizardId) return;
        // No-op when nothing changes: callers patch from effects, and a fresh object every call
        // would re-trigger them forever.
        const changed = (Object.keys(p) as (keyof typeof p)[]).some((k) => p[k] !== undefined && a[k] !== p[k]);
        if (!changed) return;
        // A different customerId means the segment learned for the previous one no longer applies.
        const clearSegment = p.customerId !== undefined && p.customerId !== a.customerId && p.segment === undefined;
        const journey = state.journey!;
        Object.assign(journey, p);
        if (clearSegment) delete journey.segment;
      },
      prepare: (wizardId: string, patch: Partial<Pick<JourneyContext, 'customerId' | 'segment' | 'finalOrder'>>) => ({ payload: { wizardId, patch } }),
    },
    /** Ends the journey context. With a wizardId, only if that journey owns it. */
    endJourney(state, action: PayloadAction<string | undefined>) {
      const a = state.journey;
      if (a && (!action.payload || a.wizardId === action.payload)) state.journey = null;
    },
  },
});

export const customerContextReducer = slice.reducer;
export const customerContextActions = {
  setActiveCustomer: slice.actions.setActiveCustomer,
  clearActiveCustomer: slice.actions.clearActiveCustomer,
  forgetCustomers: (ids: ReadonlySet<string>) => slice.actions.customersForgotten([...ids]),
  beginJourney: slice.actions.beginJourney,
  patchJourney: slice.actions.patchJourney,
  endJourney: (wizardId?: string) => slice.actions.endJourney(wizardId),
};

export const customerContextPersist: PersistConfig<CustomerContextState> = {
  key: 'vfq-customer-context',
  storage: splitStorage,
  partialize: (s) => ({ customer: s.customer, recentCustomerIds: s.recentCustomerIds, journey: s.journey }),
};
