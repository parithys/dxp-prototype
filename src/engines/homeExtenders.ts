/**
 * New Home Connection's additional Wi-Fi Extenders (Mesh devices): the agent sets the quantity the customer asks for. The plan includes a number of them free (`freeExtenders` on the plan record);
 * the units up to that number are Free and any beyond it are chargeable, at the Extender add-on's own price, recurring or one-time. Nothing is added unasked, and there is no maximum.
 */
export type ExtenderBilling = 'monthly' | 'one-time';

/** What the chosen plan and the Extender add-on say, taken when the quantity is set (a plan change clears the selection). */
export interface ExtenderTerms {
  /** Extenders the plan includes free; a plan that states none includes none. */
  freeAllowance: number;
  /** The Extender add-on's price per unit, recurring (a month); and once, when the add-on offers it (otherwise the chargeable units are recurring only). */
  monthlyQAR: number;
  oneTimeQAR?: number;
}

export interface HomeExtendersSelection {
  /** How many Extenders the customer asks for (0: none). */
  quantity: number;
  /** How the chargeable units are billed; monthly unless the agent chose one-time. */
  billing?: ExtenderBilling;
  terms: ExtenderTerms;
}

const whole = (n: number | undefined) => Math.max(0, Math.floor(Number.isFinite(n) ? (n as number) : 0));

/** How many of the requested units are free and how many are chargeable: 5 of an allowance of 4 is 4 free and 1 chargeable. */
export function splitExtenders(quantity: number | undefined, freeAllowance: number | undefined): { free: number; chargeable: number } {
  const q = whole(quantity);
  const free = Math.min(q, whole(freeAllowance));
  return { free, chargeable: q - free };
}

/** What the chargeable units cost: per unit, in total, and how they are billed. */
export function extenderCharge(sel: HomeExtendersSelection | undefined): { free: number; chargeable: number; billing: ExtenderBilling; unitQAR: number; totalQAR: number } {
  const { free, chargeable } = splitExtenders(sel?.quantity, sel?.terms.freeAllowance);
  const billing: ExtenderBilling = sel?.billing === 'one-time' && sel.terms.oneTimeQAR !== undefined ? 'one-time' : 'monthly';
  const unitQAR = billing === 'one-time' ? (sel?.terms.oneTimeQAR ?? 0) : (sel?.terms.monthlyQAR ?? 0);
  return { free, chargeable, billing, unitQAR, totalQAR: chargeable * unitQAR };
}

/** The order lines the Extenders make at checkout: the free units (no charge) and the chargeable ones (monthly or one-time), named with their quantity. */
export function extenderCheckoutItems(sel: HomeExtendersSelection | undefined): { key: string; name: string; amountQAR: number; billingFrequency: ExtenderBilling }[] {
  const c = extenderCharge(sel);
  const items: { key: string; name: string; amountQAR: number; billingFrequency: ExtenderBilling }[] = [];
  if (c.free > 0) items.push({ key: 'extender-free', name: `Wi-Fi Extender x ${c.free} (Included)`, amountQAR: 0, billingFrequency: 'monthly' });
  if (c.chargeable > 0) items.push({ key: 'extender-charged', name: `Wi-Fi Extender x ${c.chargeable}`, amountQAR: c.totalQAR, billingFrequency: c.billing });
  return items;
}

/** "3 (3 free)" / "6 (4 free, 2 chargeable)" for the summaries. */
export function extendersSummaryText(sel: HomeExtendersSelection | undefined): string | undefined {
  const q = whole(sel?.quantity);
  if (q === 0) return undefined;
  const { free, chargeable } = splitExtenders(q, sel?.terms.freeAllowance);
  return chargeable > 0 ? `${q} (${free} free, ${chargeable} chargeable)` : `${q} (${free} free)`;
}
