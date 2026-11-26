import { NUMBER_SELECTION_LABEL } from '../../data/stepLabels';
import { NumberSelection } from './NumberSelection';
import { numberSummary } from './summary';
import { WaiveOff } from './WaiveOff';
import { FREE_NUMBER_PRICE_CEILING_QAR, starNumberOverageQar } from '../../engines/postpaidPricing';
import { isNumberWaiver } from '../../engines/numberWaiver';
import { requirementForCondition } from '../../engines/journeyDocuments';
import type { AdditionalDocument } from '../DocumentUpload';
import { RefreshNumbersButton } from './RefreshNumbersButton';
import type { NumberPickerProfile } from '../../components/domain/msisdnPickerModel';
import { toLocalMsisdn } from '../../components/domain/msisdnPickerModel';
import { AutoAllocatedNumber } from './AutoAllocatedNumber';
import type { MsisdnSource } from './prepaidNumberAllocation';
import { type WizardStep } from 'dxp-ui';

/**
 * Number selection: the chosen number is stored under `msisdn` (and its price under `priceField`, when given).
 * `plan` reads the journey's selected plan from the values, for the Star entitlement note. `refresh` adds the
 * Refresh action to the step's title row. Journeys that need more (a summary, say) spread this and add it.
 */
export function numberSelectionStep(
  opts: {
    priceField?: string;
    plan?: (values: Record<string, unknown>) => { mrcQar?: number; starEntitlementQar?: number } | undefined;
    refresh?: boolean;
    /** Offer "Waive Off" beside Continue: Partial or Full waiver of the Star number's upfront charge (postpaid journeys that price the number). */
    waiveOff?: boolean;
    /** The upfront charge a Waive Off may take from, when the journey prices the number on its own (Mobile Prepaid: the number's price, with no plan entitlement). */
    waivableChargeQar?: (values: Record<string, unknown>) => number;
    /** The picker's content by role and plan (Mobile Prepaid: the tabs a role may see; no sorting, Star lock-in or plan entitlement). */
    picker?: NumberPickerProfile;
    /**
     * Mobile Prepaid: the order is given a number from the Free pool as the step opens, which the agent may keep or replace with another from the picker. Off: a number is
     * chosen here.
     */
    autoAllocate?: boolean;
    /**
     * Says the number is already on the SIM (a Pre-Paired SIM chosen on the SIM step, which comes first): Continue and Back pass over this step, and opening it shows the number
     * read-only and needs nothing. Passed over rather than skipped so every step keeps its place in the journey (the furthest step reached is an index).
     */
    carriedBySim?: (values: Record<string, unknown>) => boolean;
 } = {}
): WizardStep {
  return {
    key: 'number',
    label: NUMBER_SELECTION_LABEL,
    summary: numberSummary(opts.priceField),
    ...(opts.refresh
      ? {
          headerAction: ({ values, setValue }) => (
            <RefreshNumbersButton onClick={() => setValue('numberRefresh', ((values.numberRefresh as number | undefined) ?? 0) + 1)} />
          ),
 }
      : {}),
    ...(opts.carriedBySim ? { autoPass: opts.carriedBySim } : {}),
    render: ({ values, setValue }) =>
      opts.carriedBySim?.(values) ? (
        <p role="status" className="notice-neutral pad-panel caption-secondary">
          No number to choose: the number is already on the Pre-Paired SIM{typeof values.msisdn === 'string' ? <> - <strong className="value-text">{toLocalMsisdn(values.msisdn)}</strong></> : null}.
        </p>
      ) : (
      <>
      {opts.autoAllocate && (
        <AutoAllocatedNumber
          msisdn={values.msisdn as string | undefined}
          source={values.msisdnSource as MsisdnSource | undefined}
          onAllocate={(msisdn) => {
            // The Free pool carries no price.
            setValue('msisdn', msisdn);
            setValue('msisdnSource', 'auto');
            if (opts.priceField) setValue(opts.priceField, 0);
          }}
        />
      )}
      <NumberSelection
        value={values.msisdn as string | undefined}
        refreshKey={opts.refresh ? (values.numberRefresh as number | undefined) : undefined}
        plan={opts.plan?.(values)}
        profile={opts.picker}
        waiverQar={isNumberWaiver(values.numberWaiver) ? values.numberWaiver : undefined}
        customerIdNumber={(values.contact as { idNumber?: string } | undefined)?.idNumber}
        onChange={(msisdn, price) => {
          // A different number has a different charge: a waiver chosen for the old one does not carry over.
          if (msisdn !== values.msisdn) setValue('numberWaiver', undefined);
          // ... and neither does its supporting document.
          const req = requirementForCondition('number-waiver');
          const caf = values.caf as { additionalDocuments?: AdditionalDocument[] } | undefined;
          if (msisdn !== values.msisdn && req && caf?.additionalDocuments?.some((d) => d.requirementId === req.id)) setValue('caf', { ...caf, additionalDocuments: caf.additionalDocuments.filter((d) => d.requirementId !== req.id) });
          setValue('msisdn', msisdn);
          // A number the agent picked is theirs to keep: it is not the one allocated from the Free pool.
          if (opts.autoAllocate) setValue('msisdnSource', msisdn ? 'selected' : undefined);
          if (opts.priceField) setValue(opts.priceField, price);
 }}
      />
      </>
      ),
    // Waive Off sits before Continue.
    ...(opts.waiveOff
      ? {
          primaryAction: ({ values, setValue, defaultButton }) => {
            if (opts.carriedBySim?.(values)) return defaultButton;
            const plan = opts.plan?.(values);
            const price = values[opts.priceField ?? 'numberPriceQAR'] as number | undefined;
            const charge = opts.waivableChargeQar
              ? opts.waivableChargeQar(values)
              : plan && price !== undefined && price >= FREE_NUMBER_PRICE_CEILING_QAR
                ? starNumberOverageQar(plan.mrcQar ?? 0, price, plan.starEntitlementQar)
                : 0;
            const requirement = requirementForCondition('number-waiver');
            const caf = (values.caf as { additionalDocuments?: AdditionalDocument[] } | undefined) ?? {};
            const attachedDocs = caf.additionalDocuments ?? [];
            return (
              <div className="row">
                <WaiveOff
                  chargeQar={values.msisdn ? charge : 0}
                  numberChosen={Boolean(values.msisdn)}
                  waiver={isNumberWaiver(values.numberWaiver) ? values.numberWaiver : undefined}
                  onChange={(w) => setValue('numberWaiver', w)}
                  // The supporting document is kept with the CAF's additional documents, under the requirement it satisfies: Additional Documents then
                  // shows it as already attached rather than asking again.
                  {...(requirement
                    ? {
                        documentRequirement: requirement,
                        document: attachedDocs.find((d) => d.requirementId === requirement.id),
                        onDocumentChange: (d: AdditionalDocument | undefined) => setValue('caf', { ...caf, additionalDocuments: [...attachedDocs.filter((x) => x.requirementId !== requirement.id), ...(d ? [d] : [])] }),
                      }
                    : {})}
                />
                {defaultButton}
              </div>
            );
          },
        }
      : {}),
    isValid: (values) => opts.carriedBySim?.(values) === true || Boolean(values.msisdn),
 };
}
