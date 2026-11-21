/** A prepaid starter pack, as the products catalogue holds it. */
export interface PrepaidPlan {
  productId: string;
  name: string;
  type: string;
  starterPackChargeQAR: number;
  dataAllowanceGB: number | null;
  minutesAllowance: string;
  packValidityDays: number | null;
  popular?: boolean;
  /** When present, the pack is offered only to these customer segments (MPRA_001_QPC_02); absent = every segment. */
  eligibleSegments?: string[];
  /** One of the Sales App's offers: a pre-bundled pack listed on the Offers tab only, never among the Standard Plans. */
  salesAppOffer?: boolean;
}

/** The pack carries no bundle - no data and no validity: the SIM-only option (New Prepaid Standard SIM). */
export const isSimOnlyPack = (p: Pick<PrepaidPlan, 'dataAllowanceGB' | 'packValidityDays'>): boolean => p.dataAllowanceGB == null && p.packValidityDays == null;

/**
 * The packs a prepaid journey offers, in the order it lists them: the Prepaid Plan products the customer's segment may take (MPRA_001_QPC_02; a new customer with no
 * segment on record is a Consumer), without the line's current pack when a journey changes it, and - for a line that already has its SIM - only packs that carry a bundle.
 * The Sales App's offers are left out unless `withOffers` (they belong to the Offers tab, see prepaidOffers). The cheapest first, the Popular pack before the rest. One definition for the pack page and the Addons page, which must agree on what the chosen pack is.
 */
export function offeredPrepaidPacks<T extends PrepaidPlan>(products: readonly T[], { segment, hiddenProductId, packsOnly, withOffers }: { segment?: string; hiddenProductId?: string; packsOnly?: boolean; withOffers?: boolean } = {}): T[] {
  const customerSegment = segment ?? 'Consumer';
  return products
    .filter((p) => p.type === 'Prepaid Plan' && (withOffers || !p.salesAppOffer) && p.productId !== hiddenProductId && (!packsOnly || (p.dataAllowanceGB != null || p.packValidityDays != null)) && (!p.eligibleSegments || p.eligibleSegments.includes(customerSegment)))
    .sort((a, b) => a.starterPackChargeQAR - b.starterPackChargeQAR)
    .sort((a, b) => Number(Boolean(b.popular)) - Number(Boolean(a.popular)));
}

/** The Offers tab of New Prepaid: the Sales App's offers the customer's segment may take, cheapest first. */
export function prepaidOffers<T extends PrepaidPlan>(products: readonly T[], { segment }: { segment?: string } = {}): T[] {
  return offeredPrepaidPacks(products, { segment, withOffers: true })
    .filter((p) => p.salesAppOffer)
    .sort((a, b) => a.starterPackChargeQAR - b.starterPackChargeQAR);
}

/** The Standard Plans tab of New Prepaid: the packs as offeredPrepaidPacks lists them, with the SIM-only option first. */
export function standardPrepaidPlans<T extends PrepaidPlan>(products: readonly T[], opts: { segment?: string; hiddenProductId?: string } = {}): T[] {
  const packs = offeredPrepaidPacks(products, opts);
  return [...packs.filter(isSimOnlyPack), ...packs.filter((p) => !isSimOnlyPack(p))];
}
