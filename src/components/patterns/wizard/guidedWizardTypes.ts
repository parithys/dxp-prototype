import type { JourneyMilestones } from '../../../engines/milestoneEngine';
import type { ReactNode } from 'react';
import type { WizardStep } from 'dxp-ui';

/** The draft-specific half of an order record - see orders.json's _note. */
export interface DraftOrderRecord {
  orderId: string;
  draftStepKey?: string;
  draftValues?: Record<string, unknown>;
}

export interface GuidedActivationWizardProps {
  wizardId: string;
  title: string;
  /** Shown at the right end of the title row (e.g. a status indicator). */
  titleAside?: ReactNode;
  /** Rendered under the step card, aligned with it (e.g. a demo-only panel). */
  belowPanel?: ReactNode;
  /** Shows the postpaid New Connection add-on selection tray while the planExtras step is active. */
  showSelectedAddonsTray?: boolean;
  /** Back/Continue float at the bottom of the viewport in every journey (the default); false leaves them under the step card, for a wizard shown inside a framed preview. */
  fixedFooter?: boolean;
  /** Offers a "Customer view" toggle: the screen shows only the step content (no step list, no agent buttons), for handing it to the customer. */
  allowCustomerView?: boolean;
  /** The action named in a saved draft's task, e.g. "Postpaid Activation" -> "<Customer> – Postpaid Activation". Falls back to `title`. */
  draftActionLabel?: string;
  steps: WizardStep[];
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  /**
   * Where to go once the order is thrown away. Providing this is what puts
   * "Abandon Order" on the header; wizards that omit it render no such action.
   *
   * Restored 2026-09-27. This existed until 2026-09-26, when it was removed on
   * direction ("a half-entered order is left where it is rather than needing an
   * explicit throw-away action") - reinstated on direction again, because a
   * journey that HARD-STOPS at Eligibility leaves the agent with a draft they
   * cannot advance and, without this, no way to be rid of it.
   */
  onAbandon?: () => void;
  /**
   * Step key from which "Abandon Order" stops appearing (2026-09-28: "Keep
   * Cancel available after CAF signing and until payment starts"). Abandon
   * still shows on every step before it - this only narrows the window it
   * had by default (every step) to end at Payment, where WinCash may already
   * have taken money outside this app's own reach.
   */
  hideAbandonFrom?: string;
  /**
   * Where to go after saving the journey as a resumable draft (2026-09-28
   * "Save as Draft"), distinct from onAbandon - that one deletes the draft
   * order row and the in-memory draft; this one writes/creates the Draft
   * order row (reusing `title` as orderType and the current route as
   * draftResumePath, so no per-wizard shape needs threading through), THEN
   * clears the in-memory session draft (so starting a fresh journey of this
   * same wizardId later does not resume this one by accident) before calling
   * back. Providing this is what puts "Save as Draft" on the header, mirroring
   * onAbandon's own optionality.
   */
  onSaveExit?: () => void;
  /**
   * Leaves out the wizard's own title band (the title, Abandon Order and Save as Draft), for a journey embedded in a page that supplies its
   * own header and its own way out. Off by default: every other journey keeps the band.
   */
  hideTitleBand?: boolean;
  /**
   * Whether leaving a journey that has progress asks first (default true). Off for a wizard shown on its own page-less surface, such
   * as the Capability Library's sample, which keeps nothing worth saving.
   */
  confirmLeave?: boolean;
  /** The journey's milestones: a toast and a progress indicator each time one is reached (see useJourneyMilestones). Absent: none. */
  milestones?: JourneyMilestones;
}
