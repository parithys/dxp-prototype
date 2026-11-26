import { ChoiceCards, ICON_CARD, ICON_PHONE, type WizardStep } from 'dxp-ui';
import { ProductEligibility } from './ProductEligibility';
import { productEligibilityClear, selectMnpType } from './productChoice';
import type { ProductStepContext } from './ProductSelection';
import type { MnpType } from '../products';


const planTypeLabel = (t: unknown) => (t === 'prepaid' ? 'Prepaid Plan' : t === 'postpaid' ? 'Postpaid Plan' : undefined);

/**
 * "Port the number onto": the step that opens the New MNP flow, whichever way the agent started it - selecting a New MNP offer
 * (which already names its plan type, shown chosen) or the New MNP button (nothing chosen yet). Product Selection no longer asks:
 * it only records that the product is MNP. The plan type decides the eligibility rules, the steps and the billing, so it is judged
 * here, for the type chosen, before the journey goes on.
 */
export function mnpPlanTypeStep(ctx: ProductStepContext): WizardStep {
  return {
    key: 'mnpType',
    // The step is named for what it records (the MNP Form calls it "Plan type"); the question the agent answers is the cards' legend.
    label: 'Plan Type',
    heading: 'Plan Type',
    summary: [{ key: 'mnpType', label: 'Plan Type', type: 'text', value: (v: Record<string, unknown>) => planTypeLabel(v.mnpType) }],
    render: ({ values, setValue }) => {
      // From New MNP with no plan type named, `mnpType` is only a placeholder: nothing is judged, and no card shown chosen, until the agent picks one.
      const chosen = values.mnpTypeUnchosen !== true;
      return (
      <div className="space-y-6">
        {/* The eligibility results lead the step, directly under its title. */}
        {chosen && (
          <ProductEligibility
            values={values}
            setValue={setValue}
            flow={ctx.flow}
            existingCustomerId={ctx.existingCustomerId}
            deferredApprovals
            onSwitchToPrepaid={() => selectMnpType(ctx, values, setValue, 'prepaid')}
          />
        )}
        <ChoiceCards<MnpType>
          legend="Port the number onto"
          items={[
            { key: 'postpaid', label: 'Postpaid Plan', icon: ICON_PHONE },
            { key: 'prepaid', label: 'Prepaid Plan', icon: ICON_CARD },
          ]}
          value={chosen ? (values.mnpType as MnpType | undefined) : undefined}
          onChange={(t) => selectMnpType(ctx, values, setValue, t)}
        />
      </div>
      );
    },
    isValid: (values) => values.mnpTypeUnchosen !== true && Boolean(values.mnpType) && productEligibilityClear(values),
  };
}
