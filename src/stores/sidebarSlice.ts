import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { NAV_BY_KEY, type NavKey } from '../navigation/navManifest';
import type { PersistConfig } from './persist';
import type { AppThunk } from './types';

export interface SidebarState {
  /** Desktop only: true (default) = the side navigation stays open and the body sits beside it; false = it is revealed on hover, over the content. */
  pinned: boolean;
  mobileOpen: boolean;
  /** Desktop only: while the panel is collapsed, hovering the top-bar menu button shows it as an overlay. Ephemeral. */
  peeking: boolean;
  /** Expanded nav groups (e.g. Mobile). A real preference, so persisted. */
  expandedNavKeys: string[];
}

// Pinned and open by default for every persona: sign-out clears this slice's saved copy (resetApplicationState), so each
// login starts here. An agent may unpin during a session; that choice lasts until they sign out.
// Everything collapsed by default. The rail then opens on a short list of
// primary destinations rather than 10+ rows of nested categories. A group
// opens when its row is clicked, or on arrival at a deep link inside it
// (Sidebar's expandNavGroup effect), so nothing becomes unreachable.
export const sidebarInitialState: SidebarState = { pinned: true, mobileOpen: false, peeking: false, expandedNavKeys: [] };

const PEEK_CLOSE_DELAY = 180;
let peekTimer: ReturnType<typeof setTimeout> | null = null;
const clearPeekTimer = () => {
  if (peekTimer) clearTimeout(peekTimer);
  peekTimer = null;
};

const slice = createSlice({
  name: 'sidebar',
  initialState: sidebarInitialState,
  reducers: {
    pinnedToggled(state) {
      state.pinned = !state.pinned;
      state.peeking = false;
    },
    toggleMobileOpen(state) {
      state.mobileOpen = !state.mobileOpen;
    },
    closeMobile(state) {
      state.mobileOpen = false;
    },
    peekSet(state, action: PayloadAction<boolean>) {
      state.peeking = action.payload;
    },
    toggleNavGroup(state, action: PayloadAction<string>) {
      const key = action.payload;
      state.expandedNavKeys = state.expandedNavKeys.includes(key) ? state.expandedNavKeys.filter((k) => k !== key) : [...state.expandedNavKeys, key];
    },
    /** Idempotent "make sure this group is open" - NOT a toggle.
     *
     * Exists because the toggle cannot be called from an effect. Sidebar opens
     * the group owning a deep-linked route on arrival, and StrictMode
     * double-invokes effects in dev: the toggle opened the group, then the second
     * invocation read the same stale `expandedNavKeys` from its render closure,
     * concluded the group was still shut, and toggled it closed again. Net
     * effect: nothing opened, and only in dev. */
    expandNavGroup(state, action: PayloadAction<string>) {
      if (!state.expandedNavKeys.includes(action.payload)) state.expandedNavKeys.push(action.payload);
    },
  },
});

export const sidebarReducer = slice.reducer;

export const sidebarActions = {
  togglePinned: (): AppThunk => (dispatch) => {
    clearPeekTimer();
    dispatch(slice.actions.pinnedToggled());
  },
  toggleMobileOpen: slice.actions.toggleMobileOpen,
  closeMobile: slice.actions.closeMobile,
  openPeek: (): AppThunk => (dispatch) => {
    clearPeekTimer();
    dispatch(slice.actions.peekSet(true));
  },
  /** Closes the peek after a short delay, so the pointer can cross from the button onto the panel. */
  closePeekSoon: (): AppThunk => (dispatch) => {
    clearPeekTimer();
    peekTimer = setTimeout(() => dispatch(slice.actions.peekSet(false)), PEEK_CLOSE_DELAY);
  },
  closePeek: (): AppThunk => (dispatch) => {
    clearPeekTimer();
    dispatch(slice.actions.peekSet(false));
  },
  toggleNavGroup: slice.actions.toggleNavGroup,
  expandNavGroup: slice.actions.expandNavGroup,
};

export const sidebarPersist: PersistConfig<SidebarState> = {
  key: 'vfq-sidebar-store',
  // Only persist the genuine preferences - the mobile drawer's open/closed
  // state is ephemeral per-session.
  partialize: (state) => ({
    pinned: state.pinned,
    expandedNavKeys: state.expandedNavKeys,
  }),
  version: 5,
  // A `version` MUST be paired with a `migrate`, even a trivial one: without it a version
  // mismatch discards the stored state altogether. Removing the version instead is not an
  // option - anyone who loaded an intermediate build already has a version in localStorage,
  // which would then mismatch downwards just the same.
  //
  // v3 drops any persisted expandedNavKeys. Collapsed-by-default would
  // otherwise only apply to brand-new sessions: everyone who had already
  // loaded the app carried the previous DEFAULT of ['mobile','fibre-home'],
  // and there is no way to tell that apart from a deliberate choice of the
  // same two groups. Resetting once is the only way to make the new default
  // actually take effect.
  migrate: (persisted) => {
    // v5: pinned (docked open) is the default for everyone. Anyone holding an older unpinned default is moved to it
    // once; a pin choice made from here on is respected for the rest of the session.
    const p = (persisted ?? {}) as Partial<SidebarState>;
    return { ...p, pinned: true, expandedNavKeys: [] } as SidebarState;
  },
  // Older persisted state has no expandedNavKeys; without a default the
  // Sidebar would read undefined and crash on .includes(). Applies after
  // migrate, so it normalises both paths.
  merge: (persisted, current) => {
    const p = (persisted ?? {}) as Partial<SidebarState>;
    // Drop nav keys that no longer exist in the manifest (e.g. a persisted
    // 'products' from before Mobile/Fibre & Home were promoted to top
    // level). Fall back to the defaults only when the stored value is
    // unusable - absent, or written against a nav scheme where NONE of the
    // keys still exist - otherwise a returning user would get a rail with
    // every group collapsed and no hint the categories are there.
    //
    // An EMPTY stored array is deliberately respected rather than treated
    // as unusable: it means the user collapsed everything. Falling back
    // there made "all collapsed" impossible to persist - the defaults
    // reopened both groups on every reload.
    const stored = p.expandedNavKeys;
    const valid = Array.isArray(stored) ? stored.filter((k) => NAV_BY_KEY.has(k as NavKey)) : undefined;
    const usable = valid !== undefined && (valid.length > 0 || stored!.length === 0);
    return {
      ...current,
      ...p,
      expandedNavKeys: usable ? valid! : current.expandedNavKeys,
    };
  },
};
