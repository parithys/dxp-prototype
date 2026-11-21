import { workflowActions } from '../../../stores/workflowSlice';

import { canStartProduct } from '../productAccess';
import { customerContextActions } from '../../../stores/customerContextSlice';
import { HOME_WIZARD_ID_BY_FLOW } from '../newConnectionModel';
import type { CrossSalesValue } from '../../../capabilities';
import { isRepresentativeOrder } from '../../../capabilities/CustomerQualification/representative';
import { PRODUCT_OWNED_KEYS, billingStepActive, connectionOf, eligibilityJourney } from '../products';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { ConnectionProduct, HomeProduct, MnpType } from '../products';
import type { ProductStepContext } from './ProductSelection';
import { store } from '../../../stores/store';

/** The step right after Customer Verification: the first page a customer handed over from New Connection lands on (New Home Connection: its Address). */
export const PRODUCT_STEP_INDEX = 1;

/**
 * Where Product Selection sits for the product values given. New Connection collects the Address and (for a product that has one) the
 * Billing Profile before Recommended Offers - contact, address, [billing], product - so the index depends on whether Billing is active (New Prepaid has neither: contact, product).
 * New Home Connection has its Address first and no Billing: contact, address, product.
 */
export function productStepIndex(journey: ProductStepContext['journey'], values: Record<string, unknown>): number {
  // A Customer Representative order has one more page before it: the Authorized Person, right after Contact.
  const representative = isRepresentativeOrder(values) ? 1 : 0;
  // New Prepaid has no Address (and no Billing): contact, product.
  return representative + (journey === 'home' ? 2 : values.product === 'prepaid' ? 1 : 2 + (billingStepActive(values) && values.product !== 'postpaid' ? 1 : 0));
}

/**
 * Chooses the product (and, for MNP and Fixed Line, which kind) in place. Changing product drops what the previous one chose
 * and pulls progress back to this step (see PRODUCT_OWNED_KEYS); an offer accepted for another product no longer applies.
 * With `advance`, the step moves on by itself once the chosen product's eligibility is clear (the footer buttons of the
 * mobile Product Selection page); without it, the agent presses Continue (the home product cards).
 * Returns false when nothing changed (the same choice again).
 */
export function selectProduct(
  ctx: ProductStepContext,
  values: Record<string, unknown>,
  setValue: (field: string, value: unknown) => void,
  next: ConnectionProduct,
  opts: { mnpType?: MnpType; homeProduct?: HomeProduct; advance?: boolean } = {}
): boolean {
  // A role is not carried into a product it holds no grant for.
  if (!canStartProduct(store.getState().persona.activePersonaId, next)) return false;
  const product = values.product as ConnectionProduct | undefined;
  const mnpType = next === 'mnp' ? opts.mnpType : undefined;
  const homeProduct = next === 'fixed-line' ? opts.homeProduct : undefined;
  if (next === product && mnpType === (values.mnpType as MnpType | undefined) && homeProduct === (values.homeProduct as HomeProduct | undefined)) return false;
  store.dispatch(workflowActions.patchDraft(ctx.wizardId, {
    set: { product: next, productPreselected: Boolean(opts.advance), mnpType, homeProduct },
    unset: PRODUCT_OWNED_KEYS,
    progressTo: productStepIndex(ctx.journey, { product: next, mnpType, customerRepresentative: values.customerRepresentative }),
  }));
  if ((values.crossSales as CrossSalesValue | undefined)?.decision === 'accepted') ctx.applyCrossSales(setValue, { decision: 'declined' });
  return true;
}

/** Whether eligibility has been judged for the product now chosen (and its kind, for Fixed Line), and nothing stops the order. */
export function productEligibilityClear(values: Record<string, unknown>, opts: { requireHomeKind?: boolean } = {}): boolean {
  const e = values.eligibility as EligibilityResult | undefined;
  // New Home Connection picks the connection type on this page (its product cards). In New Connection, Fixed Line's connection type and
  // MNP's plan type are asked on the step after, not on the Recommended Offers page.
  const needsKind = Boolean(opts.requireHomeKind) && values.product === 'fixed-line' && !values.homeProduct;
  // Judged for THIS product: the line type (Fixed/FWA vs mobile) and port-in, not only the journey, so a decision made for another product is not reused.
  const judgedFor = e && e.scope === 'product' && !e.lineLimitSkipped && e.journeyType === eligibilityJourney(values) && Boolean(e.portIn) === (values.product === 'mnp') &&
    (e.connectionType ?? (e.journeyType === 'prepaid' ? 'MOBILE_PREPAID' : 'MOBILE_POSTPAID')) === connectionOf(values);
  return !needsKind && Boolean(judgedFor) && !e!.hardStop && !e!.softStop;
}

/** The plan type of a New MNP journey (Postpaid / Prepaid). Changing it drops what the other type chose, as changing product does, and returns progress to the plan-type step. */
export function selectMnpType(
  ctx: ProductStepContext,
  values: Record<string, unknown>,
  setValue: (field: string, value: unknown) => void,
  type: MnpType
): boolean {
  void setValue;
  if (values.mnpType === type && values.mnpTypeUnchosen !== true) return false;
  store.dispatch(workflowActions.patchDraft(ctx.wizardId, { set: { mnpType: type, mnpTypeUnchosen: false }, unset: PRODUCT_OWNED_KEYS, progressTo: productStepIndex(ctx.journey, { product: 'mnp', mnpType: type, customerRepresentative: values.customerRepresentative }) + 1 }));
  return true;
}

/** Eligibility is clear AND nothing routes the order for approval: the cases that need no look from the agent before moving on. */
export const clearAndQuiet = (values: Record<string, unknown>, opts: { requireHomeKind?: boolean } = {}) =>
  productEligibilityClear(values, opts) && !(values.eligibility as EligibilityResult).checks.some((c) => c.outcome === 'approval-routing');

/**
 * Moves the customer from New Connection to New Home Connection without asking them to be identified again, and without the
 * "Leave this journey?" prompt: nothing is abandoned or left half-done, the journey simply continues as the home one. The
 * identity, the eligibility and the customer type already gathered are carried into the home draft, which opens at Product
 * Selection; the customer hold passes to it; and this journey's draft is cleared (its progress was only identification).
 */
export function handOverToHomeConnection(ctx: ProductStepContext, values: Record<string, unknown>, route: string): void {
  // The journey continues in its own flow: an existing customer stays an existing customer (their record, hold and account), not a new one.
  // The existing flow's draft is keyed by the customer, as useNewConnectionJourney keys it.
  const home = ctx.flow === 'existing' && ctx.existingCustomerId ? `${HOME_WIZARD_ID_BY_FLOW.existing}-${ctx.existingCustomerId}` : HOME_WIZARD_ID_BY_FLOW[ctx.flow];
  store.dispatch(workflowActions.clearDraft(home));
  store.dispatch(workflowActions.patchDraft(home, {
    set: { contact: values.contact, eligibility: values.eligibility, customerType: values.customerType },
    progressTo: PRODUCT_STEP_INDEX,
  }));
  store.dispatch(customerContextActions.endJourney(ctx.wizardId));
  // Cleared last: the leave-journey guard asks only while the draft has progress, and it has none now.
  store.dispatch(workflowActions.clearDraft(ctx.wizardId));
  ctx.navigate(route);
}

/**
 * Another journey takes over for the customer identified here (an upgrade offer's journey): it opens for that customer (router state `launch`, which its
 * scan and eligibility read), and this journey's draft and customer hold are released so leaving does not ask what to do with a draft.
 */
export function handOverToJourney(ctx: ProductStepContext, route: string, customer?: { customerId: string }): void {
  store.dispatch(customerContextActions.endJourney(ctx.wizardId));
  store.dispatch(workflowActions.clearDraft(ctx.wizardId));
  ctx.navigate(route, customer ? { state: { launch: customer } } : undefined);
}

/** Fixed Line's connection type (Fibre / Fixed-Line / FWA / 5G Home), chosen on its own step after Product Selection. Changing it drops what the other type chose. */
export function selectHomeKind(ctx: ProductStepContext, values: Record<string, unknown>, kind: HomeProduct): void {
  if (values.homeProduct === kind) return;
  store.dispatch(workflowActions.patchDraft(ctx.wizardId, { set: { homeProduct: kind }, unset: PRODUCT_OWNED_KEYS.filter((k) => k !== 'homeProduct') }));
}
