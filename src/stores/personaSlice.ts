import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PersistConfig } from './persist';

export interface PersonaState {
  activePersonaId: string;
}

/** ROLE-01 (Retail Sales) - the broadest frontline grant set, so the
 * most usable starting demo view. */
export const DEFAULT_PERSONA_ID = 'ROLE-01';

export const personaInitialState: PersonaState = { activePersonaId: DEFAULT_PERSONA_ID };

const slice = createSlice({
  name: 'persona',
  initialState: personaInitialState,
  reducers: {
    setActivePersona(state, action: PayloadAction<string>) {
      state.activePersonaId = action.payload;
    },
  },
});

export const personaReducer = slice.reducer;
export const personaActions = slice.actions;
export const selectActivePersonaId = (s: { persona: PersonaState }) => s.persona.activePersonaId;

// `version: 2` is load-bearing, not housekeeping. This slice persists
// activePersonaId to localStorage, and on 2026-09-24 the id scheme changed
// from PERSONA-0xx (66 evidence-cited personas) to ROLE-xx (26 operational
// roles). Without the bump, a returning user boots holding a dead id:
// getPersona() returns undefined, so the dashboard greeting silently
// disappears, PersonaSwitcher's Select renders blank, and every capability
// gate returns false - an app that never crashes and never works.
//
// The id scheme was deliberately changed rather than reusing PERSONA-0xx:
// six of the seven old login personas fell inside 001-025, so a stale
// 'PERSONA-024' (Supervisor) would have silently re-resolved to the new #24
// (System Administrator) instead of cleanly missing.
export const personaPersist: PersistConfig<PersonaState> = {
  key: 'vfq-persona-store',
  version: 2,
  migrate: () => ({ activePersonaId: DEFAULT_PERSONA_ID }),
  // `migrate` alone is NOT enough: it only runs when the stored payload carries a `version` that differs from the current one.
  // State persisted before versioning was introduced has no `version` key at all and is rehydrated as-is without calling migrate -
  // so every genuine pre-existing user would have kept a dead PERSONA-0xx id while a synthetic `version: 1` payload migrated fine.
  // This merge validates the id shape instead of trusting the version, so it also catches any future renumbering.
  merge: (persisted, current) => {
    const id = (persisted as Partial<PersonaState> | undefined)?.activePersonaId;
    return { ...current, activePersonaId: id?.startsWith('ROLE-') ? id : DEFAULT_PERSONA_ID };
  },
};
