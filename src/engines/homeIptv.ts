/**
 * New Home Connection's IPTV add-on: the agent enables IPTV, picks a bundle plan, and - when the bundle carries a set-top box (STB) - chooses Premium, Lite or none (the box
 * may be free or chargeable depending on the bundle); either way the agent is asked about additional physical STBs, which are always chargeable. The terms are stated on the bundle's
 * add-ons/discounts record (`stb`, `extraStbPriceQAR`); nothing here is inferred from a name. STB charges are one-time, paid at activation; the bundle itself is monthly.
 */
export type StbChoice = 'premium' | 'lite' | 'none';
export const MAX_EXTRA_STBS = 5;

export interface IptvStbTerms {
  /** The bundle comes with an STB the agent may take. */
  included: boolean;
  litePriceQAR: number;
  premiumPriceQAR: number;
}
export interface IptvBundleTerms {
  stb?: IptvStbTerms;
  /** Price of each additional physical STB (always chargeable). */
  extraStbPriceQAR?: number;
}
export interface HomeIptvSelection {
  enabled: boolean;
  /** The plan itself includes IPTV (Triple Play): IPTV is on without the agent enabling it, and a bundle is optional. */
  planIncluded?: boolean;
  bundleId?: string;
  /** Whether the chosen bundle offers an STB, copied when it was chosen. */
  stbOffered?: boolean;
  stb?: StbChoice;
  /** Additional physical STBs: undefined until the agent answers, 0 for none. */
  extraStbs?: number;
}

export const stbLabel = (c: StbChoice) => (c === 'premium' ? 'Premium STB' : c === 'lite' ? 'Lite STB' : 'No STB');

/** What the STB that comes with the bundle costs for the choice made (free for a free box, nothing for no box). */
export function includedStbChargeQar(bundle: IptvBundleTerms | undefined, sel: HomeIptvSelection | undefined): number {
  if (!bundle?.stb?.included || !sel?.stb || sel.stb === 'none') return 0;
  return sel.stb === 'premium' ? bundle.stb.premiumPriceQAR : bundle.stb.litePriceQAR;
}
export const extraStbCount = (sel: HomeIptvSelection | undefined): number => Math.min(MAX_EXTRA_STBS, Math.max(0, Math.floor(sel?.extraStbs ?? 0)));
export const extraStbChargeQar = (bundle: IptvBundleTerms | undefined, sel: HomeIptvSelection | undefined): number => extraStbCount(sel) * (bundle?.extraStbPriceQAR ?? 0);

/** The one-time charges the IPTV choice adds to the order, each a line (a free STB adds none). */
export function iptvOneTimeLines(bundle: IptvBundleTerms | undefined, sel: HomeIptvSelection | undefined): { key: string; label: string; amountQAR: number }[] {
  if (!sel?.enabled || !bundle) return [];
  const lines: { key: string; label: string; amountQAR: number }[] = [];
  const included = includedStbChargeQar(bundle, sel);
  if (included > 0 && sel.stb && sel.stb !== 'none') lines.push({ key: 'iptv-stb', label: `IPTV ${stbLabel(sel.stb)}`, amountQAR: included });
  const extra = extraStbChargeQar(bundle, sel);
  if (extra > 0) lines.push({ key: 'iptv-extra-stb', label: `IPTV Additional STB x ${extraStbCount(sel)}`, amountQAR: extra });
  return lines;
}

/** Disabled needs nothing; enabled needs a bundle, the STB choice when the bundle offers one, and an answer on additional STBs. */
export function isIptvComplete(sel: HomeIptvSelection | undefined): boolean {
  if (!sel?.enabled) return true;
  if (!sel.bundleId) return sel.planIncluded === true;
  if (sel.stbOffered && !sel.stb) return false;
  return sel.extraStbs !== undefined;
}
