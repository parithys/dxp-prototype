import type { EligibilityResult } from '../../components/domain/eligibilityTypes';
import { limitStatement } from './connectionLimitToast';

// The Existing Connections Summary on the Contact page: what an existing customer already holds, and the CONNECTION-LIMIT warnings only. Blacklist, security, outstanding
// balance and every other eligibility result belong to the eligibility panel on the page, never here. Informational: it never stops the journey.

const TYPE_LABEL = { postpaid: 'Mobile Postpaid', fixed: 'Home' } as const;

export interface ExistingConnectionsSummaryData {
  total: number;
  postpaid: number;
  prepaid: number;
  fixed: number;
  /** Empty when every check passes: no warning panel is shown. */
  warnings: string[];
  /** The same warnings split into the line type and what is said about it, so the label can be shown apart from the message. */
  warningParts: { label: string; message: string }[];
}

/** The summary for a result, or null when there is nothing to show: the customer is new, or holds no connections, or the limits were not judged. */
export function existingConnectionsSummary(result: EligibilityResult | undefined): ExistingConnectionsSummaryData | null {
  const report = result?.connectionLimits;
  if (!result || !report || report.total <= 0) return null;
  const parts: { label: string; message: string }[] = [];
  // The connection count is reported whatever the customer's blacklist status is.
  for (const limit of report.limits) {
    if (limit.level === 'approval') parts.push({ label: TYPE_LABEL[limit.type], message: 'Connection limit exceeded. Approval is required for activation.' });
    else if (limit.level === 'blocked') parts.push({ label: TYPE_LABEL[limit.type], message: limitStatement(limit) });
    else if (limit.freeUpTo > 0 && limit.count === limit.freeUpTo) parts.push({ label: TYPE_LABEL[limit.type], message: `limit of ${limit.freeUpTo} reached; a further connection needs approval` });
  }
  return { total: report.total, postpaid: report.postpaid, prepaid: report.prepaid, fixed: report.fixed, warnings: parts.map((p) => `${p.label}: ${p.message}`), warningParts: parts };
}
