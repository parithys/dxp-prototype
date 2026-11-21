import type { CountSnapshot, RuleConfig, Segment } from './types';

// What a customer already holds against the connection limits, for telling the agent (not for deciding an order: that is `evaluateEligibility`).
// Every threshold is read from the rule configuration; none is written here.

export type LimitedConnection = 'postpaid' | 'fixed';
/** within: no approval needed up to here; approval: over the free allowance, needs approval; blocked: over the most the segment may hold. */
export type LimitLevel = 'within' | 'approval' | 'blocked';

export interface ConnectionLimit {
  type: LimitedConnection;
  count: number;
  /** The most the customer may hold without approval. */
  freeUpTo: number;
  /** The most the customer may hold with approval; null when there is no upper limit. */
  approvalUpTo: number | null;
  level: LimitLevel;
}

export interface ConnectionLimitReport {
  segment: Segment;
  /** Every connection held: mobile (prepaid and postpaid) and fixed / FWA. */
  total: number;
  postpaid: number;
  prepaid: number;
  fixed: number;
  limits: ConnectionLimit[];
  /** Some type is over its no-approval allowance. */
  exceeded: boolean;
}

const levelOf = (count: number, freeUpTo: number, approvalUpTo: number | null): LimitLevel =>
  count <= freeUpTo ? 'within' : approvalUpTo !== null && count > approvalUpTo ? 'blocked' : 'approval';

export function connectionLimitReport(counts: CountSnapshot, segment: Segment, config: RuleConfig): ConnectionLimitReport {
  const seg = segment === 'QATARI' ? config.qatari : config.expatriate;
  const postpaidTop = 'creditControlUpTo' in seg.postpaid ? seg.postpaid.creditControlUpTo : seg.postpaid.max;
  const limits: ConnectionLimit[] = [
    { type: 'postpaid', count: counts.postpaid, freeUpTo: seg.postpaid.freeUpTo, approvalUpTo: postpaidTop, level: levelOf(counts.postpaid, seg.postpaid.freeUpTo, postpaidTop) },
    { type: 'fixed', count: counts.fixedFwa, freeUpTo: seg.fixedFwa.freeUpTo, approvalUpTo: seg.fixedFwa.max, level: levelOf(counts.fixedFwa, seg.fixedFwa.freeUpTo, seg.fixedFwa.max) },
  ];
  return {
    segment,
    total: counts.mobileTotal + counts.fixedFwa,
    postpaid: counts.postpaid,
    prepaid: counts.prepaid,
    fixed: counts.fixedFwa,
    limits,
    exceeded: limits.some((l) => l.level !== 'within'),
  };
}
