import { isIptvComplete, type HomeIptvSelection } from '../../engines/homeIptv';
import { HomeFreeAddonsApplier } from './HomeFreeAddonsApplier';
import { extenderSerialsComplete, type HomeExtendersSelection } from '../../engines/homeExtenders';
import type { WizardStep } from '../../components/patterns/wizard/guidedWizardTypes';
import type { SummaryField } from '../../components/patterns/wizard/stepSummary';
import type { EligibilityResult } from '../../components/domain/eligibilityTypes';
import type { GuidedContactValue } from '../../components/patterns/guidedContactModel';
import { DEFAULT_SERVICE_OPTIONS } from '../../components/patterns/serviceOptions';
import type { ServiceOptions } from '../../components/patterns/serviceOptions';
import { ADDONS_DISCOUNTS_LABEL } from '../../data/stepLabels';
import type { CustomerTypeValue } from '../CustomerType/customerTypeModel';
import type { AddonBillingFrequency } from '../../engines/addonCategories';
import { AddonsSelection } from './AddonsSelection';
import { RechargeSelectionStep } from '../../components/patterns/RechargeSelectionStep';
import { AddonsPicker } from './AddonsPicker';
import { MultiSimAddonSims } from './MultiSimAddonSims';
import type { SimTypeValue } from '../../components/domain/SimTypeStep';
import { SpendFlag } from './SpendFlag';
import { addonsSummary, homeAddonsSummary } from './summary';
import { ApplyAddonDiscountAction } from './ApplyAddonDiscountAction';
import type { AppliedAddonDiscounts } from '../../engines/addonDiscounts';

type Values = Record<string, unknown>;

/** What the postpaid Addons step needs from its journey. */
export interface PostpaidAddonsContext {
  /** Leave the Addons step out of the journey (an accepted offer already fixes the plan, and its extras). */
  skipWhen?: (values: Values) => boolean;
  /** The journey takes no add-ons (a Family Package's are managed from Customer 360): the step never stops Continue. */
  addonsHidden?: (values: Values) => boolean;
  /** The journey prices add-on discounts (`addonDiscounts`): the page offers Apply Discount beside Continue and shows each discounted charge. Off, there is no such action. */
  applyDiscounts?: boolean;
}

/** Who the customer is for the add-ons they are eligible for: the nationality from eligibility, the customer type the agent validated (a rejected one is Standard) and the ID type. */
const customerContextOf = (values: Values) => ({
  nationality: (values.eligibility as EligibilityResult | undefined)?.nationality,
  customerType: ((v) => (v && v.type && !v.rejected ? v.type : undefined))(values.customerType as CustomerTypeValue | undefined),
  idType: (values.contact as GuidedContactValue | undefined)?.idType,
});

/** Add Add-On reads the customer type as held (it has no validated/rejected distinction of its own), unlike the activation journey. */
const addOnContextOf = (values: Values) => ({ ...customerContextOf(values), customerType: (values.customerType as CustomerTypeValue | undefined)?.type });

/**
 * The postpaid Addons step, the step after Offers & Plans: the chosen plan's add-ons, the bill limit and the line's service options. Continue from the plan page passes over
 * it; "Customise Add-ons" on the plan page is the way here (it sets `customiseAddons`, spent on arrival, so coming Back and pressing Continue goes straight on again).
 * Bill limit is the only gate; add-ons never block.
 */
export function postpaidAddonsStep(ctx: PostpaidAddonsContext = {}): WizardStep {
  return {
    key: 'planExtras',
    summary: addonsSummary,
    skip: ctx.skipWhen,
    label: ADDONS_DISCOUNTS_LABEL,
    subheading: 'Choose optional services and set the spending limit.',
    autoPass: (values) => !values.customiseAddons || Boolean(ctx.addonsHidden?.(values)),
    // Apply Discount sits just before Continue, as Edit Discount does on the plan page.
    primaryAction: ctx.applyDiscounts
      ? ({ values, setValue, defaultButton }) => (
          <div className="row">
            <ApplyAddonDiscountAction
              selectedIds={(values.addonIds as string[] | undefined) ?? []}
              applied={(values.addonDiscounts as AppliedAddonDiscounts | undefined) ?? {}}
              onApply={(next) => setValue('addonDiscounts', next)}
            />
            {defaultButton}
          </div>
        )
      : undefined,
    render: ({ values, setValue }) => (
      <>
        <SpendFlag active={Boolean(values.customiseAddons)} onSpend={() => setValue('customiseAddons', undefined)} />
        <AddonsSelection
          kind="postpaid"
          planId={values.productId as string | undefined}
          addonIds={(values.addonIds as string[] | undefined) ?? []}
          onAddonsChange={(ids) => setValue('addonIds', ids)}
          addonBilling={(values.addonBilling as Record<string, AddonBillingFrequency> | undefined) ?? {}}
          onAddonBillingChange={(billing) => setValue('addonBilling', billing)}
          customerContext={customerContextOf(values)}
          multiSimWanted={values.multiSimWanted as Record<string, number> | undefined}
          onOpenMultiSim={(id) => setValue('multiSimOpen', { id, n: Date.now() })}
          addonStatus={values.multiSimAddonStatus as Record<string, { label: string; complete: boolean; lines?: string[] }> | undefined}
          appliedDiscounts={ctx.applyDiscounts ? ((values.addonDiscounts as AppliedAddonDiscounts | undefined) ?? {}) : undefined}
          // A pre-bundled plan (the Offers tab) takes no add-ons and nothing is listed before a plan is chosen: this journey's rule.
          bundledPlansTakeNoAddons
          billLimit={{
            value: values.billLimit as number | undefined,
            max: (values.eligibility as EligibilityResult | undefined)?.defaultCreditLimitQar,
            onChange: (amount, pass) => {
              setValue('billLimit', amount);
              setValue('billLimitPass', pass);
            },
          }}
          serviceOptions={{ value: (values.serviceOptions as ServiceOptions | undefined) ?? DEFAULT_SERVICE_OPTIONS, onChange: (options) => setValue('serviceOptions', options) }}
        />
        {/* A Multi SIM add-on opens the SIM Selection in a drawer on this page; each SIM chosen is shown on the add-on's own card (click the card to change it). */}
        <div>
          <MultiSimAddonSims
            addonIds={(values.addonIds as string[] | undefined) ?? []}
            multiSims={(values.multiSims as SimTypeValue[] | undefined) ?? []}
            onChange={(sims) => setValue('multiSims', sims)}
            onPendingChange={(pending) => setValue('multiSimsPending', pending ? true : undefined)}
            statusValue={values.multiSimAddonStatus as Record<string, { label: string; complete: boolean; lines?: string[] }> | undefined}
            onStatusChange={(status) => setValue('multiSimAddonStatus', status)}
            openRequest={values.multiSimOpen as { id: string; n: number } | undefined}
            wanted={values.multiSimWanted as Record<string, number> | undefined}
            onWantedChange={(wanted) => setValue('multiSimWanted', wanted)}
            onRemoveAddon={(id) => setValue('addonIds', ((values.addonIds as string[] | undefined) ?? []).filter((x) => x !== id))}
            primarySerial={(values.simType as SimTypeValue | undefined)?.simSerial}
            primaryIccid={(values.simType as SimTypeValue | undefined)?.simIccid}
          />
        </div>
      </>
    ),
    isValid: (values) => {
      // A selected Multi SIM add-on needs its SIM before the page goes on.
      if (values.multiSimsPending === true) return false;
      const cap = (values.eligibility as EligibilityResult | undefined)?.defaultCreditLimitQar;
      const limit = values.billLimit as number | undefined;
      return values.billLimitPass !== false && !(cap !== undefined && limit !== undefined && limit > cap);
    },
  };
}

/**
 * The prepaid Addons step, the step after the pack - the prepaid counterpart of the postpaid one: the chosen pack's add-ons. Continue from the pack page passes over it;
 * "Customise Add-ons" on the pack page is the way here (it sets `customiseAddons`, spent on arrival). The add-ons are optional, so it is always valid; it is left out of the
 * journey with the pack step.
 */
export function prepaidAddonsStep(opts: {
  mandatoryProducts?: boolean;
  /**
   * New Prepaid: the page IS the recharge (stored under `rechargeId`, optional, one per subscription) - the pack's own add-on list is not shown - so the journey has no separate Recharge step.
   * `idType` is the customer's ID type, for the SIM card charge note.
   */
  recharge?: { idType: (values: Values) => string | undefined };
} = {}): WizardStep {
  return {
    key: 'planExtras',
    // No summary of its own: a prepaid add-on is an add-ons/discounts record (not a product), so each prepaid journey attaches its own Summary rows (attachSummaries).
    label: ADDONS_DISCOUNTS_LABEL,
    subheading: opts.recharge ? 'Choose the recharge for the pack.' : 'Choose optional services for the pack.',
    // The Selected Add-Ons tray, as on the postpaid page: every journey that uses this step gets it.
    addonsTray: opts.recharge ? 'recharge' : 'prepaid',
    autoPass: (values) => !values.customiseAddons,
    render: ({ values, setValue }) => (
      <>
        <SpendFlag active={Boolean(values.customiseAddons)} onSpend={() => setValue('customiseAddons', undefined)} />
        {/* New Prepaid: the Addons page IS the recharge (Combo+, Flex, Credit, Data, International, Roamers, Visitors); the pack's own add-on list is not shown. */}
        {opts.recharge ? (
          <RechargeSelectionStep value={values.rechargeId as string | undefined} onChange={(id) => setValue('rechargeId', id)} idType={opts.recharge.idType(values)} />
        ) : (
          <AddonsSelection
            kind="prepaid"
            selectedProductId={values.productId as string | undefined}
            addonIds={(values.addonIds as string[] | undefined) ?? []}
            onSelectAddons={(ids) => setValue('addonIds', ids)}
            mandatoryProducts={opts.mandatoryProducts}
          />
        )}
      </>
    ),
    // IPTV, once enabled, needs its bundle, the set-top box choice and an answer on additional boxes.
    isValid: (values) => isIptvComplete(values.iptv as HomeIptvSelection | undefined),
  };
}

/**
 * Add-ons on their own (Add Add-On), stored under `addonIds`: the add-ons the line's plan can take, complete once at least one is chosen (this journey's rule). `planId` is
 * the plan or pack the add-ons are for; `source` says whether it is a postpaid plan (the same Addons page the activation journey shows, so the category tabs and Paid / Free
 * columns are the same) or a prepaid pack (its own add-ons, a one-off charge). Eligibility also reads the customer's nationality, customer type and ID type. The line already
 * has its plan, so no bill limit or service options are set here and the billing frequency is not recorded.
 */
export function addonsSelectionStep(opts: {
  planId: (values: Values) => string | undefined;
  source?: (values: Values) => 'catalogue' | 'prepaid';
  emptyMessage?: string;
}): WizardStep {
  const source = (values: Values) => opts.source?.(values) ?? 'catalogue';
  const summary: SummaryField[] = [
    { key: 'addons', label: 'Add-Ons', type: 'multi', labelFrom: { kind: 'products', idField: 'productId', labelField: 'name' }, value: (v) => v.addonIds, when: (v) => source(v) === 'catalogue' },
    { key: 'addons-prepaid', label: 'Add-Ons', type: 'multi', labelFrom: { kind: 'addons-discounts', idField: 'addonDiscountId', labelField: 'name' }, value: (v) => v.addonIds, when: (v) => source(v) === 'prepaid' },
  ];
  const emptyMessage = opts.emptyMessage ?? 'No add-ons are available for this plan.';
  return {
    key: 'addons',
    label: 'Add-Ons',
    subheading: 'Choose the add-ons to add to the line.',
    summary,
    render: ({ values, setValue }) =>
      source(values) === 'catalogue' ? (
        <AddonsSelection
          kind="postpaid"
          planId={opts.planId(values)}
          addonIds={(values.addonIds as string[] | undefined) ?? []}
          onAddonsChange={(ids) => setValue('addonIds', ids)}
          customerContext={addOnContextOf(values)}
          emptyMessage={emptyMessage}
        />
      ) : (
        <AddonsPicker
          layout="rows"
          categorized
          hideHeader
          source="prepaid"
          selectedIds={(values.addonIds as string[] | undefined) ?? []}
          onChange={(ids) => setValue('addonIds', ids)}
          eligibilityContext={{ planId: opts.planId(values), ...addOnContextOf(values) }}
          emptyMessage={emptyMessage}
        />
      ),
    isValid: (values) => ((values.addonIds as string[] | undefined) ?? []).length > 0,
  };
}

/**
 * The Add-ons step of a home journey (fixed line, fibre, FWA, 5G Home), the step after Offers & Plans: the chosen plan's add-ons, as on the postpaid page. Continue from the plan page passes over
 * it; "Customise Add-ons" there is the way here (it sets `customiseAddons`, spent on arrival). An Offers-tab plan is pre-bundled and takes none. Add-ons never block.
 */
export function homeAddonsStep(opts: { deviceSerials?: (values: Record<string, unknown>) => boolean } = {}): WizardStep {
  return {
    key: 'planExtras',
    summary: homeAddonsSummary,
    label: ADDONS_DISCOUNTS_LABEL,
    subheading: 'Choose optional services for the plan.',
    autoPass: (values) => !values.customiseAddons,
    // The plan's free add-ons are on the order even when this page is passed over.
    headless: ({ values, setValue }) => <HomeFreeAddonsApplier values={values} setValue={setValue} />,
    render: ({ values, setValue }) => (
      <>
        <SpendFlag active={Boolean(values.customiseAddons)} onSpend={() => setValue('customiseAddons', undefined)} />
        <AddonsSelection kind="home" planId={values.productId as string | undefined} addonIds={(values.addonIds as string[] | undefined) ?? []} onAddonsChange={(ids) => setValue('addonIds', ids)} addonBilling={values.addonBilling as Record<string, import('../../engines/addonCategories').AddonBillingFrequency> | undefined} onBillingChange={(next) => setValue('addonBilling', next)} addonTerms={values.addonTerms as Record<string, number> | undefined} onTermsChange={(next) => setValue('addonTerms', next)} iptv={values.iptv as HomeIptvSelection | undefined} onIptvChange={(next) => setValue('iptv', next)} extenders={values.extenders as import('../../engines/homeExtenders').HomeExtendersSelection | undefined} onExtendersChange={(next) => setValue('extenders', next)} deviceSerials={opts.deviceSerials?.(values) ?? true} freeByDefault={{ doneFor: values.freeAddonsFor as string | undefined, onDone: (planId) => setValue('freeAddonsFor', planId) }} />
      </>
    ),
    // IPTV, once enabled, needs its bundle, the set-top box choice (and its serial number, unless the field engineer scans it) and an answer on additional boxes.
    isValid: (values) => {
      const serials = opts.deviceSerials?.(values) ?? true;
      return isIptvComplete(values.iptv as HomeIptvSelection | undefined, serials) && extenderSerialsComplete(values.extenders as HomeExtendersSelection | undefined, serials);
    },
  };
}
