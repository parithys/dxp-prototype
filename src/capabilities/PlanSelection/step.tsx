import { PLAN_SELECTION_LABEL } from '../../data/stepLabels';
import { PlanSelection } from './PlanSelection';
import { PrepaidPackActions } from './PrepaidPackActions';
import { AddDiscountAction } from './AddDiscountAction';
import { CustomiseAddonsAction } from './CustomiseAddonsAction';
import { specialTypeOf } from './specialDiscount';
import { loadMandatoryAddonIds } from '../AddonsSelection/usePackHasAddons';
import { planSummary } from './summary';
import { type WizardStep } from 'dxp-ui';

/**
 * The prepaid pack step (prepaid activation and prepaid port-in): the packs, stored under `productId`. A different pack
 * drops the previous pack's discount and add-ons. Postpaid has its own builder (postpaidPlanStep, which reads the offer,
 * eligibility and customer type); fixed-line has fixedPlanSelectionStep. The step after the plan or pack - its add-ons - is the Add-Ons capability's.
 */
export function planSelectionStep(opts: {
  kind: 'prepaid';
  segment?: (values: Record<string, unknown>) => string | undefined;
  /** A pack not offered (the line's current pack, when the journey changes it). */
  hiddenProductId?: (values: Record<string, unknown>) => string | undefined;
  /** Offer only packs that carry a bundle, not the SIM-only option (changing the pack of a line that already has its SIM). */
  packsOnly?: boolean;
  /** The step's own name where "Offers & Plans" does not fit the journey (port-in onto prepaid: "Prepaid Packs"). */
  label?: string;
  /**
   * New Prepaid activation: a pack carries no discount of its own (no Edit Discount beside Continue, so nothing to clear or carry), and the pack's mandatory
   * products are selected for the agent the moment it is chosen. Off (port-in onto prepaid, a pack change): the pack page keeps Edit Discount and every add-on is optional.
   */
  activation?: boolean;
}): WizardStep {
  return {
    key: 'plan',
    label: opts.label ?? PLAN_SELECTION_LABEL,
    render: ({ values, setValue }) => (
      <PlanSelection
        kind="prepaid"
        selectedProductId={values.productId as string | undefined}
        // A different pack carries its own discounts and add-ons, so the previous pack's are dropped.
        onSelectProduct={(id) => {
          if (id !== values.productId) {
            setValue('discountId', undefined);
            setValue('addonIds', []);
            if (opts.activation) setValue('rechargeId', undefined);
            // The pack's mandatory products are on the order from the moment it is chosen - the agent need not open the Addons page.
            if (opts.activation) void loadMandatoryAddonIds(id).then((ids) => ids.length > 0 && setValue('addonIds', ids));
          }
          setValue('productId', id);
        }}
        // Clicking the selected pack again clears it, and its discounts and add-ons with it.
        onDeselectProduct={() => {
          setValue('productId', undefined);
          setValue('discountId', undefined);
          setValue('addonIds', []);
          if (opts.activation) setValue('rechargeId', undefined);
        }}
        tabs={opts.activation}
        onPlanTabChange={(tab) => setValue('planTab', tab)}
        segment={opts.segment?.(values)}
        hiddenProductId={opts.hiddenProductId?.(values)}
        packsOnly={opts.packsOnly}
      />
    ),
    isValid: (values) => Boolean(values.productId),
    // Once a pack is chosen, Customise Add-ons and Edit Discount sit just before Continue - as on the postpaid plan page.
    // New Prepaid: Customize Addons is for a pack chosen on Standard Plans (an offer is pre-bundled) and always leads to the Addons page, which also carries the recharge.
    primaryAction: ({ values, setValue, goNext, defaultButton }) => (
      <div className="row">
        <PrepaidPackActions
          productId={opts.activation && values.planTab !== 'for-you' ? undefined : (values.productId as string | undefined)}
          customisable={opts.activation ? true : undefined}
          discountId={values.discountId as string | undefined}
          onSelectDiscount={(id) => setValue('discountId', id)}
          discountEditable={!opts.activation}
          setCustomise={() => setValue('customiseAddons', true)}
          goNext={goNext}
        />
        {defaultButton}
      </div>
    ),
  };
}

/** The fixed-line / fibre / FWA / 5G Home plan step: the fixed plan cards and the credit check; valid once a plan is chosen and the credit check passed or was acknowledged. */
export function fixedPlanSelectionStep(): WizardStep {
  return {
    key: 'plan',
    label: PLAN_SELECTION_LABEL,
    summary: planSummary,
    // The add-ons were chosen for the plan they were chosen on: a different plan (or none) starts the Add-ons page clean.
    render: ({ values, setValue }) => (
      <PlanSelection
        kind="fixed"
        values={values}
        specialDiscountType={specialTypeOf(values)}
        setValue={(field, value) => {
          setValue(field, value);
          if (field === 'productId') {
            setValue('addonIds', []);
            // The add-ons are cleared with the plan, so the free ones are put on the order again for the new plan (their once-per-plan marker goes too).
            setValue('freeAddonsFor', undefined);
            setValue('iptv', undefined);
            setValue('extenders', undefined);
          }
        }}
      />
    ),
    isValid: (values) => Boolean(values.productId) && (values.creditCheckPass === true || values.creditCheckAcknowledged === true),
    // As on the postpaid plan page: once a Standard Plan is chosen, Customise Add-ons sits just before Continue (an Offers-tab plan is pre-bundled and has none).
    primaryAction: ({ values, setValue, goNext, defaultButton }) => (
      <div className="row">
        <CustomiseAddonsAction productId={values.productId as string | undefined} preBundled={values.selectionSource === 'OFFER'} setCustomise={() => setValue('customiseAddons', true)} goNext={goNext} />
        {/* Edit Discount, as on the postpaid plan page: the plan's own discounts (Loyalty, Promotional ...), and the Special Discount on Special Offers. An Offers plan is pre-bundled. */}
        <AddDiscountAction
          productId={values.productId as string | undefined}
          tab={values.planTab as string | undefined}
          discountId={values.discountId as string | undefined}
          onSelectDiscount={(id) => setValue('discountId', id)}
          customerBenefits={undefined}
          specialDiscountType={specialTypeOf(values)}
          customerBenefit={undefined}
        />
        {defaultButton}
      </div>
    ),
  };
}
