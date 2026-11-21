/**
 * Why a customer is blacklisted. A customer can be blacklisted for MORE THAN ONE reason at once (unpaid bills AND a security restriction), so the record
 * holds a list, one entry per reason: its kind (which the eligibility matrix acts on) and the reason text. `blacklisted` stays the flag; a blacklisted
 * customer with an empty list is the unclassified case, which the eligibility engine treats as a hard stop. Every screen that names the reasons reads
 * them through here, so none shows only the first.
 */
export type BlacklistCategory = 'collections' | 'security';

export interface BlacklistReason {
  category: BlacklistCategory;
  reason: string;
}

export const BLACKLIST_CATEGORY_LABELS: Record<BlacklistCategory, string> = { collections: 'Collections', security: 'Security' };

type HasReasons = { blacklistReasons?: BlacklistReason[] } | undefined;

/** Every reason on the record, in the order recorded. */
export function blacklistReasonsOf(c: HasReasons): BlacklistReason[] {
  return Array.isArray(c?.blacklistReasons) ? c.blacklistReasons : [];
}

/** The kinds of block the customer is under. */
export function blacklistCategoriesOf(c: HasReasons): Set<BlacklistCategory> {
  return new Set(blacklistReasonsOf(c).map((r) => r.category));
}

/** All the reason texts on one line ("A; B"), or undefined when none is recorded. */
export function blacklistReasonText(c: HasReasons): string | undefined {
  const texts = blacklistReasonsOf(c).map((r) => r.reason);
  return texts.length > 0 ? texts.join('; ') : undefined;
}

/** "Collections: Outstanding dues > threshold" - the kind and its reason, for a list or a badge. */
export function blacklistReasonLabel(r: BlacklistReason): string {
  return `${BLACKLIST_CATEGORY_LABELS[r.category]}: ${r.reason}`;
}
