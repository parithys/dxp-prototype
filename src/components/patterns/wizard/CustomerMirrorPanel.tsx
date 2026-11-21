import type { WizardStep } from './guidedWizardTypes';
import { Card } from 'dxp-ui';

/**
 * The customer's pop-up: the current step drawn in the same container as the agent's step panel - same
 * surface, border, radius, padding and heading styles - so the customer sees the design the agent sees. Only
 * the agent's controls are left out: no Customer view button, no "Visible to customer" label, no sharing
 * outline, no rail or footer. Read-only unless `interactive` (the CAF & Signature step).
 */
export function CustomerMirrorPanel({
  step,
  orderSummaryStep,
  values,
  interactive,
  onSetValue,
}: {
  step: WizardStep | undefined;
  /** CAF & Signature only: the Checkout step, whose content (the Order Summary) is shown to the customer above the terms and the signing, read-only. */
  orderSummaryStep?: WizardStep;
  values: Record<string, unknown>;
  interactive: boolean;
  onSetValue: (field: string, value: unknown) => void;
}) {
  return (
    <Card
      className={`relative w-full p-6 ${interactive ? '' : 'inert-region'}`}
    >
      {orderSummaryStep && (
        <section aria-label="Order Summary" className="mb-8 pb-8 divider-bottom">
          <h2 className="title title-xl mb-4">Order Summary</h2>
          <div className="inert-region">
            {orderSummaryStep.render({
              values,
              setValue: () => {},
              goNext: () => {},
              goToStepKey: () => {},
              saveDraft: async () => {},
              saveAndExit: async () => {},
              requestAbandon: () => {},
            })}
          </div>
        </section>
      )}
      {/* The step's own section, with its own heading: the Order Summary comes first, then this. The step's corner control (the language choice) sits at this section's top right. */}
      <section className="mirror-section">
        {/* sm:pr-48: room at the right, and (CAF & Signature) the height, for the control the step puts in the title row - the language choice - so it never overlaps what follows. */}
        <div className={`mb-4 sm:pr-48 ${step?.key === 'caf' ? 'sm:min-h-14' : ''}`}>
          <h2 className="title title-xl">{step?.heading ?? step?.label}</h2>
          {step?.subheading && <p className="text-secondary mt-1">{step.subheading}</p>}
        </div>
        {step?.render({
          values,
          setValue: interactive ? onSetValue : () => {},
          goNext: () => {},
          goToStepKey: () => {},
          saveDraft: async () => {},
          saveAndExit: async () => {},
          requestAbandon: () => {},
        })}
      </section>
    </Card>
  );
}
