import { planFeatureRows, type OfferProduct } from '../../components/primitives/offerCardModel';
import { continuesHere } from './serviceJourneys';
import type { OfferJourneys, ServiceJourney } from './serviceJourneys';

export interface CrossSalesValue {
  decision?: 'accepted' | 'declined' | 'none';
  offerId?: string;
  offerName?: string;
  journey?: ServiceJourney;
  linkedProductIds?: string[];
}

export interface Offer {
  offerId: string;
  offerName: string;
  offerDescription: string;
  monthlyRental: number;
  campaignCode: string;
  status: string;
  contactId: string;
  serviceJourney?: ServiceJourney;
  linkedProductIds: string[];
  /** Campaign facts shown only in the details drawer. */
  offerType?: string;
  priorityCode?: string;
  treatmentCode?: string;
  channel?: string;
  promotionId?: string;
  price?: number;
  addOnMonthly?: number;
  /** The words on the card's tag, when the offer names its own (the Fiber Connection card); otherwise the tag follows the offer's kind. */
  cardTag?: string;
}

/** Up to four facts about the plan an offer opens, read from the linked product - never typed in here. */
export function offerFeatures(o: Offer, products: Record<string, OfferProduct>) {
  const plan = o.linkedProductIds.map((id) => products[id]).find((p) => p && (p.dataAllowanceGB || p.minutesAllowance || p.speedTierMbps));
  return planFeatureRows(plan);
}

/** The one line the drawer's banner leads with: the linked plan's first free benefit, else its headline allowance. */
export function offerHighlight(o: Offer, products: Record<string, OfferProduct>): { title: string; subtitle: string } | null {
  const plan = o.linkedProductIds.map((id) => products[id]).find((p) => p && (p.benefits?.length || p.dataAllowanceGB || p.speedTierMbps));
  if (!plan) return null;
  const title =
    plan.benefits?.[0] ??
    (plan.speedTierMbps ? `${plan.speedTierMbps} Mbps fibre${plan.iptvIncluded ? ' with IPTV' : ''}` : `${plan.dataAllowanceGB} GB data`);
  return { title, subtitle: `Included with ${plan.name}` };
}

/** Continue is open once the agent has decided (or nothing was offered), except
 * an accepted offer for a journey that continues elsewhere - that has its own button. */
export const isCrossSalesValid = (v: CrossSalesValue | undefined, here: OfferJourneys = 'new-postpaid') =>
  Boolean(v?.decision) && (v?.decision !== 'accepted' || continuesHere(v.journey, here));

// ---------------------------------------------------------------- Standard catalogue

/**
 * Records the decision on the offers in the draft values. Accepting an offer makes its journey and plan the basis
 * for what follows (the first linked plan that exists in `products`); anything else (declining, skipping) clears a
 * previous acceptance, and the discount and add-ons chosen under it.
 */
export function applyCrossSalesDecision(
  setValue: (field: string, value: unknown) => void,
  v: CrossSalesValue,
  products: { productId: string }[]
) {
  setValue('crossSales', v);
  setValue('serviceJourney', v.decision === 'accepted' ? v.journey : undefined);
  const basis = v.decision === 'accepted' ? v.linkedProductIds?.find((id) => products.some((p) => p.productId === id)) : undefined;
  setValue('productId', basis);
  setValue('discountId', undefined);
  setValue('addonIds', []);
}

/** The plan classes (`planClass` in products.json) New Postpaid always shows on Recommended Offers, one card each, in this order. */
export const NEW_POSTPAID_PLAN_CLASSES = ['Postpaid Voice Plans', 'Postpaid Broadband Plans', 'Postpaid Family Plans'] as const;

/**
 * The New Postpaid section: exactly one offer per class in NEW_POSTPAID_PLAN_CLASSES. The customer's own offer (`real`, already ordered best-first) takes its
 * class's place; a class they hold none of shows the standard offer for it. The class is the plan's own (`classOf`, read from the linked product), never
 * guessed from a name or price, so an offer whose plan has no such class has no place here, and a class with neither is left out rather than filled with another.
 */
export function oneOfEachPlanClass(real: readonly Offer[], standard: readonly Offer[], classOf: (o: Offer) => string | undefined): Offer[] {
  return NEW_POSTPAID_PLAN_CLASSES.flatMap((c) => {
    const pick = real.find((o) => classOf(o) === c) ?? standard.find((o) => classOf(o) === c);
    return pick ? [pick] : [];
  });
}

/**
 * The offers Recommended Offers shows (a demonstration set), without grouping: New Postpaid's three - one Voice, one Broadband and one Family plan - then one
 * New Fixed Line, one New MNP and one New Prepaid offer: six cards. `lists` holds each offer type's offers (a customer's own first, topped up with the standard ones),
 * by the type's key. A type with no offer contributes none, so fewer than six come back only when the catalogue lacks one.
 */
export function demoOfferSet<T extends { serviceJourney?: string }>(lists: Readonly<Record<string, readonly T[]>>, fillers: readonly T[] = []): T[] {
  const one = (key: string, fits: (o: T) => boolean = () => true) => (lists[key] ?? []).find(fits);
  const set = [
    ...(lists['new-postpaid'] ?? []),
    one('new-home', (o) => o.serviceJourney === 'new-fixed-line'),
    one('new-mnp'),
    one('new-prepaid'),
  ].filter((o): o is T => o !== undefined);
  // Always six cards: when fewer offers are available the standing cards (Fiber Connection) fill the rest, never repeating one already shown.
  return [...set, ...fillers.filter((f) => !set.includes(f))].slice(0, DEMO_OFFER_COUNT);
}

/** How many cards Recommended Offers always shows. */
export const DEMO_OFFER_COUNT = 6;

/**
 * How a Recommended Offers card is coloured: by the kind of connection it opens, so every offer of one kind looks alike (all the postpaid plans share one colour) and the
 * kinds read apart at a glance. The tones are the design system's tints (`offer-tone-*` in ui-components.css); an offer of a kind with none is left plain.
 */
// Four tones that stay apart at a glance: blue, amber, pink, green (teal sat too close to green, so a Fixed Line and a Prepaid card read alike).
export type OfferTone = 'blue' | 'amber' | 'pink' | 'green';
const OFFER_TONE_OF_TYPE: Partial<Record<string, OfferTone>> = { 'new-postpaid': 'blue', 'new-home': 'amber', 'new-mnp': 'pink', 'new-prepaid': 'green' };
export const offerToneOf = (typeKey: string | undefined): OfferTone | undefined => (typeKey ? OFFER_TONE_OF_TYPE[typeKey] : undefined);

/** The words a card names its kind with: the journey it starts (New Postpaid, New Fixed Line, New MNP, New Prepaid) - a home offer for FWA is named for what it is. */
export function offerKindLabel(typeKey: string | undefined, journey: string | undefined): string | undefined {
  switch (typeKey) {
    case 'new-postpaid': return 'New Postpaid';
    case 'new-home': return journey === 'new-fwa' ? 'New FWA' : 'New Fixed Line';
    case 'new-mnp': return 'New MNP';
    case 'new-prepaid': return 'New Prepaid';
    case 'pre-to-post-upgrade': return 'Prepaid to Postpaid';
    case 'post-to-post-upgrade': return 'Postpaid Upgrade';
    default: return undefined;
  }
}

/** The plan classes a postpaid offer's tag names (the plan's own `planClass`): "Postpaid Voice Plan", "Postpaid Broadband Plan", "Postpaid Family Plan". */
const POSTPAID_CLASS_TAG: Record<string, string> = {
  'Postpaid Voice Plans': 'Postpaid Voice Plan',
  'Postpaid Broadband Plans': 'Postpaid Broadband Plan',
  'Postpaid Family Plans': 'Postpaid Family Plan',
};

/**
 * The tag every Recommended Offers card carries, saying what kind of offer it is: a postpaid offer by the class of its plan (Postpaid Voice / Broadband / Family Plan), every other
 * offer by its journey (Fixed Line, New MNP, New Prepaid). A postpaid offer whose plan has no class is just Postpaid.
 */
export function offerTagLabel(typeKey: string | undefined, journey: string | undefined, planClass: string | undefined): string | undefined {
  if (typeKey === 'new-postpaid') return (planClass && POSTPAID_CLASS_TAG[planClass]) || 'Postpaid';
  if (typeKey === 'new-home') return journey === 'new-fwa' ? 'FWA' : 'New Home';
  return offerKindLabel(typeKey, journey);
}
