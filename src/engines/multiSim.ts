// Multi-SIM: the additional SIMs that belong to the primary line. How many the order provisions comes only from the explicit `multiSimCount` on
// the selected plan and on each selected add-on in products.json - never from a product's name or description - summed and held to
// MULTI_SIM_MAX. Each Multi-SIM takes a Free-pool number automatically at submission; the agent is never shown it, and a Multi-SIM line is
// not counted in the Active Line Count or the Number Reservation Count (it carries no customer, and its number is not a reservation).

/** The most Multi-SIMs one line can have (the cardinality is 0 to 4). */
export const MULTI_SIM_MAX = 4;

export interface MultiSimSource {
  multiSimCount?: unknown;
}

/** What a plan or add-on provides: its stated `multiSimCount` when that is a whole number of at least 0, otherwise none (unknown stays 0). */
export const multiSimCountOf = (record: MultiSimSource | undefined): number => {
  const n = record?.multiSimCount;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0;
};

/** The line for a plan or add-on that provides Multi-SIMs (not shown on the plan cards: a Multi SIM is offered through Add-ons only; the plan's count still counts toward the order) ("2 Multi-SIMs included"), from its stated count only; undefined when it provides none. */
export const multiSimBenefitText = (record: MultiSimSource | undefined): string | undefined => {
  const n = Math.min(MULTI_SIM_MAX, multiSimCountOf(record));
  return n > 0 ? `${n} Multi-SIM${n === 1 ? '' : 's'} included` : undefined;
};

export interface MultiSimEntitlement {
  fromPlan: number;
  fromAddons: number;
  /** Plan plus add-ons before the maximum is applied. */
  requested: number;
  /** What the journey provisions: the sum, held between 0 and MULTI_SIM_MAX. */
  provisionable: number;
}

export function multiSimEntitlement(plan: MultiSimSource | undefined, selectedAddons: readonly MultiSimSource[]): MultiSimEntitlement {
  // Multi SIM is offered only through Add-ons (paid or free, as the plan or offer allows): a plan's own `multiSimCount` adds none.
  const fromPlan = 0;
  void plan;
  const fromAddons = selectedAddons.reduce((sum, a) => sum + multiSimCountOf(a), 0);
  const requested = fromPlan + fromAddons;
  return { fromPlan, fromAddons, requested, provisionable: Math.min(MULTI_SIM_MAX, Math.max(0, requested)) };
}

/** Selecting this add-on would take the plan's and the selected add-ons' Multi-SIMs above the maximum. An add-on that provides none never does. */
export function exceedsMultiSimMax(plan: MultiSimSource | undefined, selectedAddons: readonly MultiSimSource[], candidate: MultiSimSource): boolean {
  const adds = multiSimCountOf(candidate);
  return adds > 0 && multiSimEntitlement(plan, selectedAddons).requested + adds > MULTI_SIM_MAX;
}

export interface PoolNumber {
  msisdn: string;
  category?: string;
  status?: string;
}

/**
 * The Free-pool numbers handed to `count` Multi-SIMs: category Free and status AVAILABLE only (a Reserved or Blocked number is never taken),
 * never one in `taken` (the primary number, and numbers already given to a Multi-SIM), lowest number first. Throws when the pool cannot cover
 * them, so an order never submits with a Multi-SIM that has no number.
 */
export function assignMultiSimMsisdns(pool: readonly PoolNumber[], taken: ReadonlySet<string>, count: number): string[] {
  if (count <= 0) return [];
  const free = pool
    .filter((n) => n.category === 'Free' && n.status === 'AVAILABLE' && !taken.has(n.msisdn))
    .map((n) => n.msisdn)
    .sort();
  if (free.length < count) throw new Error('Not enough free numbers to provision the Multi-SIMs.');
  return free.slice(0, count);
}

/**
 * What each Multi-SIM of the order covers ("Local", "GCC"), in the order the SIMs are held: the selected add-ons in the order chosen, each giving its SIMs their coverage as the add-on's
 * record states it (`multiSimCoverage`, one entry per SIM). A SIM whose add-on states none has no coverage (undefined) - it is never guessed from a name.
 */
export function multiSimCoverages(addons: readonly { multiSimCount?: unknown; multiSimCoverage?: unknown }[]): (string | undefined)[] {
  return addons.flatMap((a) => {
    const n = multiSimCountOf(a);
    const cov = Array.isArray(a.multiSimCoverage) ? a.multiSimCoverage : [];
    return Array.from({ length: n }, (_, i) => (typeof cov[i] === 'string' ? (cov[i] as string) : undefined));
  });
}

/**
 * How many Multi-SIMs an add-on is asked for: it provides up to its `multiSimCount`, but the agent starts with one and adds the next if required (`wanted`, by add-on id).
 * Undefined or unstated counts give none (unknown stays unknown).
 */
export const multiSimRequestedOf = (addon: (MultiSimSource & { productId?: string }) | undefined, wanted: Readonly<Record<string, number>> = {}): number => {
  const full = multiSimCountOf(addon);
  return full === 0 ? 0 : Math.min(full, Math.max(1, wanted[addon?.productId ?? ''] ?? 1));
};

/** The Multi-SIMs the order is asked for in all - what the selected add-ons were asked for, held to the maximum of 4. */
export const multiSimsRequested = (addons: readonly (MultiSimSource & { productId?: string })[], wanted: Readonly<Record<string, number>> = {}): number =>
  Math.min(MULTI_SIM_MAX, addons.reduce((n, a) => n + multiSimRequestedOf(a, wanted), 0));
