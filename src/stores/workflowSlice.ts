import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PersistConfig } from './persist';
import type { AppThunk } from './types';

export interface WizardDraft {
  currentStep: number;
  /** Furthest step index ever reached this session - never decreases when
   * navigating back, so a step already passed stays reachable/marked done
   * even after jumping to an earlier step to edit it. */
  maxStepReached: number;
  values: Record<string, unknown>;
  /** A resumed draft: the step it was saved on. The journey opens on ID verification and, once that passes, Continue goes here. */
  resumeToStepKey?: string;
  /** A resumed draft: the Task ID the draft already has, which the journey keeps. */
  resumeTaskId?: string;
  /** The step and values as they were when the agent last used Save as Draft; unchanged since means nothing is unsaved. */
  savedSnapshot?: string;
  /**
   * The Draft Order this session is working on, when it was opened from one.
   *
   * The slice holds ONE draft per wizardId, which is the working copy at the
   * counter. The durable record is the order itself (status 'Draft' in
   * orders.json), and this is the link back to it - so progress is written
   * there on every step change and several draft orders can exist at once
   * without this slice needing a slot for each.
   */
  draftOrderId?: string;
}

/** Has this draft got real progress in it? A journey starts when the ID is scanned (or a number is read), not when an ID
 * type is merely picked: a value holding nothing but an ID type selection is not progress. */
export function draftHasProgress(d: WizardDraft | undefined): boolean {
  if (!d) return false;
  if (d.currentStep > 0) return true;
  const meaningful = (v: unknown): boolean => {
    if (v === null || v === undefined || v === '' || v === false) return false;
    if (Array.isArray(v)) return v.some(meaningful);
    if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).some(([k, x]) => k !== 'idType' && meaningful(x));
    return true;
  };
  return Object.values(d.values).some(meaningful);
}

/** Progress that is not yet saved: there is progress, and it differs from what the last Save as Draft kept. */
export function draftNeedsSaving(d: WizardDraft | undefined): boolean {
  return draftHasProgress(d) && snapshotOf(d!) !== d!.savedSnapshot;
}
const snapshotOf = (d: WizardDraft) => JSON.stringify([d.currentStep, d.values]);

export interface WorkflowState {
  drafts: Record<string, WizardDraft>;
}

export const workflowInitialState: WorkflowState = { drafts: {} };

const emptyDraft: WizardDraft = { currentStep: 0, maxStepReached: 0, values: {} };

/** The wizard's draft, or the shared empty draft when it has none (a stable reference, safe to select). */
export const selectDraft = (s: { workflow: WorkflowState }, wizardId: string): WizardDraft => s.workflow.drafts[wizardId] ?? emptyDraft;

// The draft for a wizard, created (empty) the first time it is written to.
const draftOf = (state: WorkflowState, wizardId: string): WizardDraft => (state.drafts[wizardId] ??= { ...emptyDraft, values: {} });

const slice = createSlice({
  name: 'workflow',
  initialState: workflowInitialState,
  reducers: {
    setStep(state, action: PayloadAction<{ wizardId: string; step: number }>) {
      const { wizardId, step } = action.payload;
      const draft = draftOf(state, wizardId);
      draft.maxStepReached = Math.max(draft.maxStepReached ?? draft.currentStep, step);
      draft.currentStep = step;
    },
    setFieldValue(state, action: PayloadAction<{ wizardId: string; field: string; value: unknown }>) {
      const { wizardId, field, value } = action.payload;
      draftOf(state, wizardId).values[field] = value;
    },
    setDraftOrderId(state, action: PayloadAction<{ wizardId: string; draftOrderId: string }>) {
      draftOf(state, action.payload.wizardId).draftOrderId = action.payload.draftOrderId;
    },
    resumeTargetConsumed(state, action: PayloadAction<string>) {
      const draft = state.drafts[action.payload];
      if (draft) draft.resumeToStepKey = undefined;
    },
    /** Records that everything entered so far is saved (Save as Draft): leaving the journey no longer warns until something changes. */
    markDraftSaved(state, action: PayloadAction<string>) {
      const draft = state.drafts[action.payload];
      if (draft) draft.savedSnapshot = snapshotOf(draft);
    },
    /**
     * Change several values at once and, optionally, pull progress back to `progressTo`: used when a journey that holds more
     * than one product's steps switches product. The previous product's values go (`unset`), the new one's are set, and the
     * furthest step reached is LOWERED to the product step, so the Summary and Edit never show steps of the product the agent
     * has just left as done. (setStep only ever raises it.)
     */
    patchDraft(state, action: PayloadAction<{ wizardId: string; patch: { set?: Record<string, unknown>; unset?: readonly string[]; progressTo?: number } }>) {
      const { wizardId, patch } = action.payload;
      const draft = draftOf(state, wizardId);
      for (const key of patch.unset ?? []) delete draft.values[key];
      Object.assign(draft.values, patch.set ?? {});
      if (patch.progressTo !== undefined) {
        draft.currentStep = patch.progressTo;
        draft.maxStepReached = patch.progressTo;
      }
    },
    /**
     * Replace a draft wholesale, from a stored Draft Order.
     *
     * A single set rather than a clearDraft + N setFieldValue calls, so the
     * resumed order lands in one render. Done field-by-field, the wizard would
     * re-render against a half-restored draft and its step gates would evaluate
     * against values that had not arrived yet - which, on a resume to step 7,
     * means a Continue gate failing on a field the order does in fact carry.
     */
    hydrateDraft(state, action: PayloadAction<{ wizardId: string; draft: WizardDraft }>) {
      state.drafts[action.payload.wizardId] = action.payload.draft;
    },
    clearDraft(state, action: PayloadAction<string>) {
      delete state.drafts[action.payload];
    },
  },
});

export const workflowReducer = slice.reducer;

// Callers keep the argument lists the store methods always had.
export const workflowActions = {
  setStep: (wizardId: string, step: number) => slice.actions.setStep({ wizardId, step }),
  setFieldValue: (wizardId: string, field: string, value: unknown) => slice.actions.setFieldValue({ wizardId, field, value }),
  /** Links the working copy to the Draft Order saved for it (page-level saving writes there on every Continue). */
  setDraftOrderId: (wizardId: string, draftOrderId: string) => slice.actions.setDraftOrderId({ wizardId, draftOrderId }),
  markDraftSaved: slice.actions.markDraftSaved,
  patchDraft: (wizardId: string, patch: { set?: Record<string, unknown>; unset?: readonly string[]; progressTo?: number }) => slice.actions.patchDraft({ wizardId, patch }),
  hydrateDraft: (wizardId: string, draft: WizardDraft) => slice.actions.hydrateDraft({ wizardId, draft }),
  clearDraft: slice.actions.clearDraft,
  /** Takes (and clears) the step a resumed draft goes to after ID verification. */
  consumeResumeTarget:
    (wizardId: string): AppThunk<string | undefined> =>
    (dispatch, getState) => {
      const key = getState().workflow.drafts[wizardId]?.resumeToStepKey;
      if (key) dispatch(slice.actions.resumeTargetConsumed(wizardId));
      return key;
    },
};

// sessionStorage per frontend-architecture.md §4 - cleared on tab close, matching
// journeys.md's evidenced "milestone/draft-order persistence for resume" behavior
// (resumable within a session, not permanently, absent a real backend).
export const workflowPersist: PersistConfig<WorkflowState> = { key: 'vfq-workflow-store', storage: 'session' };
