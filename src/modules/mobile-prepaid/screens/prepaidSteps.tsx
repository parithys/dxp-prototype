import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import { attachSummaries } from '../../../components/patterns/wizard/stepSummary';
import type { GuidedContactValue } from '../../../capabilities';
import {
  cafSignatureStep,
  committedLines,
  numberSelectionStep,
  paymentStep,
  planSelectionStep,
  prepaidAddonsStep,
  prepaidCheckoutStep,
  simTypeStep,
} from '../../../capabilities';
import type { NumberPickerProfile } from '../../../components/domain/msisdnPickerModel';
import { prepaidNumberTabsFor } from '../../../data/prepaidActivation';
import type { CrossSalesValue, PrepaidCheckoutTotals } from '../../../capabilities';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { DeviceType } from 'dxp-ui';
import * as sums from '../../../components/patterns/wizard/commonSummaries';

/**
 * What the New Prepaid number picker shows: the tabs a ROLE may see (Retail Sales every number, Mass Market Free only), no sorting, no Star lock-in, and no pack entitlement -
 * a prepaid pack carries none, so a Star number is judged by its price and the agent's additional discount alone.
 */
const PREPAID_NUMBER_PICKER: NumberPickerProfile = { tabsFor: prepaidNumberTabsFor, lockIn: false, planEntitlement: false };

const contactOf = (values: Record<string, unknown>) => values.contact as GuidedContactValue | undefined;
const nameOf = (values: Record<string, unknown>) => contactOf(values)?.moiResult?.name;

// An accepted prepaid cross-sales offer fixes the first subscription's pack, so the plan step is skipped for it. Later
// subscriptions (once the cart has one) choose their own pack.
const offerAccepted = (values: Record<string, unknown>) =>
  (values.crossSales as CrossSalesValue | undefined)?.decision === 'accepted' && committedLines(values).length === 0;

// The New Prepaid steps, after Customer Verification and Product Selection (the first two steps of New Connection, which
// this product shares with the others), in the order of the Mobile Prepaid process flow and in the shape of Postpaid's:
//
//   Offers & Plans -> Addons (incl. the recharge; only via Customize Addons) -> SIM (or a Pre-Paired SIM) -> Number (passed over for a Pre-Paired SIM)
//   -> Order Summary -> CAF -> Payment
// (no Address: the shell's Address step is skipped for Prepaid, see buildConnectionSteps)
//
// `device` only changes how the SIM step is operated - SIM serial scan-led on a tablet, type-led on the web - and the CAF
// type follows the device by itself (Touch Screen on a tablet, Digital on the web), both signed on screen.
//
// What differs from Postpaid, per the Mobile Prepaid BRSD: no billing account, credit limit or HRN advance; prepaid packs
// filtered by segment, with a prepaid discount; a Pre-Paired SIM, chosen on SIM Selection, that bypasses number selection; a single subscription per order; prepaid checkout with the SIM card charge; the prepaid CAF and its terms. The step-to-requirement map is in
// reference/outputs/VFQ_DXP_Mobile_Prepaid_Requirements_Coverage_Reference.md.
export function prepaidSteps({ device }: { device: DeviceType }): WizardStep[] {
  return attachSummaries(
    [
      {
        // New Prepaid: no Edit Discount on the pack page, and the pack's mandatory products are selected for the agent.
        ...planSelectionStep({ kind: 'prepaid', activation: true, segment: (values) => (values.eligibility as EligibilityResult | undefined)?.segment }),
        skip: offerAccepted,
      },
      {
        // The Addons page, reached through Customize Addons on a Standard Plan, also carries the recharge (there is no separate Recharge step).
        ...prepaidAddonsStep({ mandatoryProducts: true, recharge: { idType: (values) => contactOf(values)?.idType } }),
        skip: offerAccepted,
      },
      // SIM Selection comes before Number Selection (Mobile Prepaid BRSD sequence). The scanned serial decides whether the SIM is Pre-Paired: its number is already on it,
      // so Number Selection is passed over for it. The agent does not choose.
      simTypeStep({
        device,
        pairingFromScan: true,
        // The SIM's details (Paired / Unpaired). No Secondary Contact: the Primary Contact owns every service.
        prepaidActivation: { idType: (values) => contactOf(values)?.idType },
      }),
      // Refresh as in New Postpaid; Waive Off is the Star Number Additional Discount (V0.3): a fixed QAR amount off the number's price, with its
      // supporting document, which holds the order for approval. A prepaid number has no plan entitlement, so its whole price can be waived.
      numberSelectionStep({
        priceField: 'priceQAR',
        picker: PREPAID_NUMBER_PICKER,
        // The step opens with a number allocated from the Free pool, which the agent keeps or replaces.
        autoAllocate: true,
        // A Pre-Paired SIM brings its number: this step is passed over.
        carriedBySim: (values) => values.prePaired === true,
        refresh: true,
        waiveOff: true,
        waivableChargeQar: (values) => (typeof values.priceQAR === 'number' ? values.priceQAR : 0),
      }),
      prepaidCheckoutStep({
        editable: false,
        idType: (values) => contactOf(values)?.idType,
        customerName: nameOf,
        // Order Summary with the order's checks, Recharge (not Add-Ons) and the Charge Summary with VAT.
        activation: { idNumber: (values) => contactOf(values)?.idNumber, segment: (values) => (values.eligibility as EligibilityResult | undefined)?.segment },
      }),
      cafSignatureStep({
        variant: 'full',
        journey: 'prepaid',
        customerName: nameOf,
        // MPRA_001_CAF_02: the prepaid terms the customer sees before signing, from the business-maintained statements.
        keyInformationScenario: 'prepaid-',
        // iPAY Activation (default Yes) and the configurable prepaid Terms & Conditions, with the iPAY supplement only while it is Yes.
        ipay: true,
      }),
      // "On successful WinCash confirmation, return to DXP, submit the order": Payment is the last step, so Continue
      // here could only mean "submit" (PAY_01, ORD_01).
      paymentStep({ submitOnPaid: true, zeroValueReceipt: true, offerEWallet: true,
        // PROTOTYPE DEMO: a Paired (Physical) SIM shows the Insufficient eWallet Balance outcome, an eSIM the Sufficient one.
        demoEWallet: (values) => { const sim = values.simType as { prePaired?: boolean; simType?: string } | undefined; return sim?.prePaired === true ? 'insufficient' : sim?.simType === 'eSIM' ? 'sufficient' : undefined; },
        amountDue: (values) => (values.checkoutTotals as PrepaidCheckoutTotals | undefined)?.totalDueQar ?? 0 }),
    ],
    {
      plan: sums.planSummary(),
      // The same order as New Postpaid's Addons summary (Add-Ons, then Discount); a prepaid line has no bill limit, so there is no third row.
      // New Prepaid has no pack discount, so the Add-Ons row stands alone.
      planExtras: [
        { key: 'addons', label: 'Add-Ons', type: 'multi', optional: true, labelFrom: { kind: 'addons-discounts', idField: 'addonDiscountId', labelField: 'name' }, value: (v) => v.addonIds },
        // BRSD V0.3 Prepaid Recharge Selection, now a section of the Addons page. Whether a recharge is mandatory is a persona rule the BRSD leaves open, so it is optional here.
        { key: 'recharge', label: 'Recharge', type: 'select', optional: true, labelFrom: { kind: 'recharge-products', idField: 'rechargeId', labelField: 'name' }, value: (v) => v.rechargeId },
      ],
      payment: sums.paymentSummary,
    }
  );
}
