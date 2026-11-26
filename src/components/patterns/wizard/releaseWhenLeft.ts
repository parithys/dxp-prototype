import { workflowActions } from '../../../stores/workflowSlice';
import { customerContextActions } from '../../../stores/customerContextSlice';
import { store } from '../../../stores/store';

/**
 * Lets a journey go without its page flickering. Clearing the draft at once resets the wizard to its first page for as long as the next route takes to load; so call this BEFORE navigating
 * (the draft is marked saved, so leaving asks nothing), navigate, then call the function it returns: the draft and the customer hold are released only when the URL has changed. A draft
 * the destination has already replaced (the same wizard, started fresh) is left alone, and after 10 seconds without leaving the journey is released anyway.
 */
export function releaseWhenLeft(wizardId: string): () => void {
  const draft = store.getState().workflow.drafts[wizardId];
  const from = window.location.pathname;
  store.dispatch(workflowActions.markDraftSaved(wizardId));
  return () => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.location.pathname === from && Date.now() - started < 10_000) return;
      window.clearInterval(timer);
      store.dispatch(customerContextActions.endJourney(wizardId));
      const now = store.getState().workflow.drafts[wizardId];
      // markDraftSaved changed the draft once; anything beyond that is the destination's own.
      if (now && draft && now.values === draft.values && now.currentStep === draft.currentStep) store.dispatch(workflowActions.clearDraft(wizardId));
    }, 50);
  };
}
