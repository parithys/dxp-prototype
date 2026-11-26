import { workflowActions } from '../../../stores/workflowSlice';

import { canStartProduct } from '../productAccess';
import type { CrossSalesValue } from '../../../capabilities';
import { isRepresentativeOrder } from '../../../capabilities/CustomerQualification/representative';
import { PRODUCT_OWNED_KEYS, billingStepActive, connectionOf, eligibilityJourney } from '../products';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { ConnectionProduct, HomeProduct, MnpType } from '../products';
import type { ProductStepContext } from './ProductSelection';
import { store } from '../../../stores/store';
import { releaseWhenLeft } from '../../../components/patterns/wizard/releaseWhenLeft';
import { homeConnectionRoute } from './homeConnectionRoute';
import type { Offer } from '../../../capabilities';
import type { HomeStart } from '../rfsStart';

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

/** Whether eligibility has been judged for THIS product: the line type (Fixed/FWA vs mobile) and port-in, not only the journey, so a decision made for another product is not reused. */
export function eligibilityJudgedForProduct(values: Record<string, unknown>): boolean {
  const e = values.eligibility as EligibilityResult | undefined;
  return Boolean(e && e.scope === 'product' && !e.lineLimitSkipped && e.journeyType === eligibilityJourney(values) && Boolean(e.portIn) === (values.product === 'mnp') &&
    (e.connectionType ?? (e.journeyType === 'prepaid' ? 'MOBILE_PREPAID' : 'MOBILE_POSTPAID')) === connectionOf(values));
}

/** Whether eligibility has been judged for the product now chosen (and its kind, for Fixed Line), and nothing stops the order. */
export function productEligibilityClear(values: Record<string, unknown>, opts: { requireHomeKind?: boolean } = {}): boolean {
  const e = values.eligibility as EligibilityResult | undefined;
  // New Home Connection picks the connection type on this page (its product cards). In New Connection, Fixed Line's connection type and
  // MNP's plan type are asked on the step after, not on the Recommended Offers page.
  const needsKind = Boolean(opts.requireHomeKind) && values.product === 'fixed-line' && !values.homeProduct;
  return !needsKind && eligibilityJudgedForProduct(values) && !e!.hardStop && !e!.softStop;
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
 * Another journey takes over for the customer identified here (an upgrade offer's journey): it opens for that customer (router state `launch`, which its
 * scan and eligibility read), and this journey's draft and customer hold are released so leaving does not ask what to do with a draft.
 */
export function handOverToJourney(ctx: ProductStepContext, route: string, customer?: { customerId: string }, back?: { path: string; label: string }): void {
  // The draft and the customer hold are released once the other journey's page has replaced this one (releaseWhenLeft), not before: clearing first would redraw this journey's first page meanwhile.
  const release = releaseWhenLeft(ctx.wizardId);
  // `back` names the page to return to (the screen it opens shows a Back bar for it), with the customer so that page opens for them again.
  ctx.navigate(route, customer || back ? { state: { ...(customer ? { launch: customer } : {}), ...(back ? { returnTo: { ...back, launch: customer } } : {}) } } : undefined);
  release();
}

/** Fixed Line's connection type (Fibre / Fixed-Line / FWA / 5G Home), chosen on its own step after Product Selection. Changing it drops what the other type chose. */
export function selectHomeKind(ctx: ProductStepContext, values: Record<string, unknown>, kind: HomeProduct): void {
  if (values.homeProduct === kind) return;
  store.dispatch(workflowActions.patchDraft(ctx.wizardId, { set: { homeProduct: kind }, unset: PRODUCT_OWNED_KEYS.filter((k) => k !== 'homeProduct') }));
}

/** Where a New Home offer leads first: Check RFS, which answers whether fibre or 5G Home can be sold at the address. */
export const HOME_OFFER_ROUTE = '/fibre-home/check-rfs';

/**
 * New Home from New Connection - a New Home offer's Select Offer, or the Start Another Journey card - sends the agent to Check RFS to run the RFS check in place of the Address page. What this journey knows - the customer identified, the offer chosen (if one was) - goes along in
 * the router state (`homeStart`); Start New Home Connection there opens the journey with it and the result (a fresh start, which clears the old draft first, then takes these values and the step to open at),
 * so the customer is not identified again and neither Address nor Recommended Offers (seen once already) is asked. Back on Check RFS returns to this page. This journey's draft and customer hold are released.
 */
export function handOverHomeToRfs(ctx: ProductStepContext, values: Record<string, unknown>, offer?: Offer): void {
  const customerId = (values.eligibility as EligibilityResult | undefined)?.customerId;
  const crossSales: CrossSalesValue | undefined = offer && { decision: 'accepted', offerId: offer.offerId, offerName: offer.offerName, journey: offer.serviceJourney, linkedProductIds: offer.linkedProductIds };
  const release = releaseWhenLeft(ctx.wizardId);
  // Check RFS already ran before the customer was identified (Check RFS -> the common Contact page -> Recommended Offers): its result goes straight into the home journey, with no second check.
  const pendingHome = values.pendingHome as Record<string, unknown> | undefined;
  if (pendingHome) {
    ctx.navigate(homeConnectionRoute(ctx), {
      state: {
        startFresh: true,
        navJourney: 'fib-new-home',
        startValues: {
          contact: values.contact, eligibility: values.eligibility, customerType: values.customerType,
          offerCarried: true,
          productPreselected: true,
          ...(offer && crossSales ? { crossSales, serviceJourney: offer.serviceJourney } : {}),
          ...pendingHome,
        },
        startProgressTo: (isRepresentativeOrder(values) ? 1 : 0) + 2,
      },
    });
    release();
    return;
  }
  ctx.navigate(HOME_OFFER_ROUTE, {
    state: {
      returnTo: { path: window.location.pathname, label: 'Contact', launch: customerId ? { customerId } : undefined },
      // Where Start New Home Connection leads: this customer's own home route when they are an existing one.
      startRoute: homeConnectionRoute(ctx),
      homeStart: {
        values: {
          contact: values.contact, eligibility: values.eligibility, customerType: values.customerType,
          // Recommended Offers was shown once already, in New Connection: it is not shown again, only the product's eligibility is judged (the page moves on by itself when it is clear).
          // An offer the agent chose there is kept on the order.
          offerCarried: true,
          productPreselected: true,
          ...(offer && crossSales ? { crossSales, serviceJourney: offer.serviceJourney } : {}),
        },
        // Contact (and the Customer Representative's pages) are done: the journey opens at the offers page.
        progressTo: (isRepresentativeOrder(values) ? 1 : 0) + 2,
      } satisfies HomeStart,
    },
  });
  release();
}

/**
 * New Home Connection opened with an offer already chosen (Select Offer in New Connection, or Start Another Journey): its Recommended Offers page lists nothing and only judges the product's
 * eligibility, then moves on by itself. While that is still ahead - the judgement is pending, or it is clear and quiet - the page is a pass-through that must not be drawn: it would show for a moment
 * and be gone. A stop or an approval routing is the agent's to read, so the page is drawn then.
 */
export function homeOffersPassingThrough(values: Record<string, unknown>): boolean {
  if (values.productPreselected !== true || values.offerCarried !== true || !values.product) return false;
  return !eligibilityJudgedForProduct(values) || clearAndQuiet(values, { requireHomeKind: true });
}
