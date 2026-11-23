/** The plans a home product sells: the 5G Home (FWA) plans for FWA and 5G Home, the fixed-line (fibre) plans for the rest. */
export const planTypeOfHomeProduct = (homeProduct: unknown) => (homeProduct === 'fwa' || homeProduct === '5g-home' ? 'FWA 5G Home Plan' : 'Fixed Line Plan');

/** Where a home plan was chosen from: an Offers-tab plan is pre-bundled (it takes no add-ons), a Standard Plan takes optional ones. */
export const homePlanSourceOf = (plan: { offer?: boolean } | undefined): 'OFFER' | 'PLAN' | undefined => (plan ? (plan.offer ? 'OFFER' : 'PLAN') : undefined);

/**
 * The bundle a fixed-line (fibre) home plan sells: Double Play (Internet + Fixed Voice) or Triple Play (Internet + Fixed Voice + IPTV, the plan carries IPTV). A 5G Home (FWA) plan is neither:
 * it has no fixed voice or IPTV, so it is undefined and is listed as it always was.
 */
export type HomePlay = 'double' | 'triple';
export const homePlayOf = (plan: { type?: string; iptvIncluded?: boolean } | undefined): HomePlay | undefined =>
  plan?.type === 'Fixed Line Plan' ? (plan.iptvIncluded ? 'triple' : 'double') : undefined;
export const HOME_PLAY_ROW: Record<HomePlay, string> = { double: 'Double Play: Internet + Fixed Voice', triple: 'Triple Play: Internet + Fixed Voice + IPTV' };
