// PROTECTED (docs/migration/phase5-specialised-components.md): the Redux notification queue every toast, the bell and the history read; do not add a second toast/notification state (Sonner, Radix Toast).
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AppThunk } from './types';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

/**
 * A service the agent can open from inside a notification. A DESCRIPTOR, not
 * a rendered <Link>: this slice is plain data that `history` retains for the
 * session, so it holds where to go rather than the element that goes there.
 */
export interface ToastServiceLink {
  /** Link text - an MSISDN, service id, bundle id or device number. */
  label: string;
  /** Whose Customer 360 to open. */
  customerId: string;
  /** Which Customer 360 tab to activate on arrival. */
  tab: string;
  /**
   * Which service that tab should load, matched against CustomerService.ref.
   *
   * Optional since 2026-09-25: the breakdown groups services by CATEGORY, and
   * a category link opens its tab without singling out one service. Left in
   * place because a single-service link is still the right shape elsewhere.
   */
  serviceRef?: string;
  /**
   * Product name. NOT displayed - the breakdown shows identifiers only as of
   * 2026-09-25. It survives as the link's accessible name, which is the one
   * place the name is still needed: a bare identifier read aloud conveys
   * nothing about where the link leads.
   */
  note?: string;
}

/**
 * A label/value row in a structured toast. `tone` picks the value's colour:
 * 'id' for a reference the agent will quote back, 'success' for a positive
 * state, default for plain facts.
 *
 * `links` renders BENEATH the value as a breakdown - the value stays the
 * headline figure (a count) and each link is one of the things it counts.
 */
export interface ToastRow {
  label: string;
  value: string;
  tone?: 'default' | 'id' | 'success';
  /**
   * A quieter second line under the value - for a qualifier that belongs to
   * the value rather than being a fact of its own, e.g. "(Postpaid)" under a
   * mobile number. Distinct from `links`, which renders a list of navigable
   * items, and from a separate row, which would imply a separate field.
   */
  sub?: string;
  links?: ToastServiceLink[];
  /**
   * Makes the VALUE ITSELF a link to this path - distinct from `links`, which
   * renders a list beneath it. For a row whose value names something the
   * agent can act on, e.g. the purpose of visit launching its journey.
   *
   * A resolved path, not a screen id: the slice holds no engine lookups, so
   * whoever pushes the toast resolves the route.
   */
  to?: string;
  /** Router state sent with `to` (e.g. { startFresh: true } when the link starts a journey). */
  state?: Record<string, unknown>;
}

/**
 * Which operator the person this notification is about belongs to, and - for
 * a Vodafone customer - what kind of relationship they hold.
 *
 * A DESCRIPTOR, not a rendered logo: this slice is plain data that `history`
 * retains for the session, so putting a ReactNode in it would park React
 * elements in global state and make a history entry unserialisable. The Toast
 * maps `operator` to a mark.
 *
 * `relationship` is deliberately optional and NOT defaulted. A registered
 * customer with no active lines has no Prepaid/Postpaid relationship yet, and
 * three of the eight seeded customers are in exactly that state - including
 * the one queued for a new postpaid connection. Guessing "Prepaid" there
 * would state a fact the data does not contain.
 */
export interface ToastBrand {
  operator: 'vodafone' | 'other';
  /**
   * Consumer or Business - what the header shows beside the mark as of
   * 2026-09-25, replacing the relationship that used to sit there.
   */
  segment?: string;
  /**
   * Prepaid or Postpaid on the walk-in's number. Only meaningful for
   * 'vodafone'.
   *
   * Still carried even though the header no longer shows it: the Mobile
   * number row renders it as its "(Postpaid)" sub-line, so this is the field
   * that feeds it. The two are deliberately separate - one describes the
   * CUSTOMER, the other a single line they hold.
   */
  relationship?: string;
}

export interface ToastOptions {
  /**
   * Stable identity for a notification that can be raised more than once -
   * currently the queue ticket, which the agent can reopen from the header's
   * info icon after dismissing it.
   *
   * Pushing with a key that is already present REPLACES rather than appends,
   * in both the visible stack and history. Without it, reopening pushes a
   * fresh notification every time: the stack grows a duplicate per click and
   * the bell counts each one as unread, so "reopen the message" silently
   * became "create another message".
   */
  key?: string;
  /** Closes the toast by itself after this many milliseconds. Absent: it stays until the agent dismisses it. */
  autoDismissMs?: number;
  /** Quieter second line under the headline. Ignored when `rows` is set. */
  detail?: string;
  /** Plain toasts only: the second line carries a link - `prefix` text, then `label` as a link to `to`, then `suffix` (the toast closes when it is followed). */
  detailLink?: { prefix?: string; label: string; to: string; suffix?: string };
  /**
   * Turns the toast into a structured card: the message becomes an uppercase
   * header and these render as label/value rows beneath a divider. For
   * notifications the agent has to READ rather than merely notice - a queue
   * assignment is five separate facts, and a sentence made them compete.
   */
  rows?: ToastRow[];
  /** Operator mark, right-aligned on the header line. Structured toasts only. */
  brand?: ToastBrand;
  /**
   * A reference number belonging to the headline, rendered after `message` in
   * the same colour a `tone: 'id'` row value gets.
   *
   * Separate from `message` because it has to be styled separately, and the
   * store holds strings rather than markup - concatenating it into the
   * headline would make the number unstyleable, which is what it was when the
   * ticket id first moved out of the rows and into the message.
   */
  reference?: string;
  /** Plain toasts only: render on the tinted success surface (green fill and
   * border, dark text) instead of the dark charcoal card. Only meaningful with
   * kind 'success'. */
  tinted?: boolean;
}

export interface Toast {
  id: string;
  key?: string;
  kind: ToastKind;
  message: string;
  /**
   * Optional second line. The toast renders `message` as the headline and
   * this beneath it in a quieter tone, which is what lets a notification say
   * WHAT happened without burying the subject in the same sentence.
   * Optional so the ~55 existing two-argument call sites are unaffected.
   */
  detail?: string;
  detailLink?: { prefix?: string; label: string; to: string; suffix?: string };
  rows?: ToastRow[];
  brand?: ToastBrand;
  reference?: string;
  tinted?: boolean;
}

export interface NotificationHistoryEntry extends Toast {
  at: number;
  read: boolean;
}

export interface NotificationState {
  toasts: Toast[];
  history: NotificationHistoryEntry[];
}

export const notificationInitialState: NotificationState = { toasts: [], history: [] };

const HISTORY_LIMIT = 30;

// In-memory only per frontend-architecture.md §4 - toasts (and their history)
// don't survive reload. `history` backs the notification bell in the top bar,
// keeping every toast this session ever pushed (capped) even after its
// dismissible copy in `toasts` is closed.
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

const slice = createSlice({
  name: 'notification',
  initialState: notificationInitialState,
  reducers: {
    toastPushed(state, action: PayloadAction<{ id: string; kind: ToastKind; message: string; options?: ToastOptions; at: number }>) {
      const { id, kind, message, options, at } = action.payload;
      const key = options?.key;
      const entry: Toast = {
        id,
        key,
        kind,
        message,
        detail: options?.detail,
        detailLink: options?.detailLink,
        rows: options?.rows,
        brand: options?.brand,
        reference: options?.reference,
        tinted: options?.tinted,
      };
      // A keyed re-push replaces the toast (same id, so React keeps the element and it does not flicker); otherwise it is appended.
      if (key && state.toasts.some((t) => t.key === key)) state.toasts = state.toasts.map((t) => (t.key === key ? entry : t));
      else state.toasts.push(entry);
      const historyEntry: NotificationHistoryEntry = { ...entry, at, read: false };
      state.history = (key ? [historyEntry, ...state.history.filter((h) => h.key !== key)] : [historyEntry, ...state.history]).slice(0, HISTORY_LIMIT);
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    /** Clears every visible toast. History is untouched - the bell keeps them. */
    dismissAllToasts(state) {
      state.toasts = [];
    },
    markAllRead(state) {
      state.history = state.history.map((h) => ({ ...h, read: true }));
    },
    /** Removes every visible toast and history entry that mentions any of these strings (a customer's name or id): the bell must not keep naming them. */
    purgeMentioning(state, action: PayloadAction<readonly string[]>) {
      const needles = action.payload;
      const mentions = (entry: Toast) => {
        const text = JSON.stringify([entry.message, entry.detail, entry.rows]).toLowerCase();
        return needles.some((n) => n && text.includes(n.toLowerCase()));
      };
      state.toasts = state.toasts.filter((t) => !mentions(t));
      state.history = state.history.filter((h) => !mentions(h));
    },
  },
});

export const notificationReducer = slice.reducer;

export const notificationActions = {
  dismissAllToasts: slice.actions.dismissAllToasts,
  markAllRead: slice.actions.markAllRead,
  purgeMentioning: slice.actions.purgeMentioning,
  dismissToast: slice.actions.dismissToast,
  pushToast:
    (kind: ToastKind, message: string, options?: ToastOptions): AppThunk =>
    (dispatch, getState) => {
      const key = options?.key;
      // A keyed re-push reuses the id, so React keeps the same element and the
      // toast does not flicker out and back in when it is reopened.
      const existing = key ? getState().notification.toasts.find((t) => t.key === key) : undefined;
      const id = existing?.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      dispatch(slice.actions.toastPushed({ id, kind, message, options, at: Date.now() }));
      if (options?.autoDismissMs) {
        const pending = dismissTimers.get(id);
        if (pending) clearTimeout(pending);
        dismissTimers.set(
          id,
          setTimeout(() => {
            dismissTimers.delete(id);
            dispatch(slice.actions.dismissToast(id));
          }, options.autoDismissMs)
        );
      }
    },
};
