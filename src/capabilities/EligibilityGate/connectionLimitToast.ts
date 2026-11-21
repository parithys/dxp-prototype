import type { ConnectionLimit, ConnectionLimitReport } from '../../domain/eligibility';
import type { ToastRow } from '../../stores/notificationSlice';

// The informational toast shown on the Contact page when a customer already holds more connections than their limit allows without approval. It breaks the holdings
// down (total, Mobile Postpaid, Fixed, Prepaid where held) and says, for each type with a limit, whether the limit is exceeded and whether approval is required.

const TYPE_LABEL = { postpaid: 'Mobile Postpaid', fixed: 'Fixed' } as const;

/** One sentence on a limit: the allowance without approval, and where the customer stands against it. */
export function limitStatement(limit: ConnectionLimit): string {
  const { freeUpTo, approvalUpTo } = limit;
  if (limit.level === 'within') return `Within the limit of ${freeUpTo} without approval`;
  if (limit.level === 'blocked') return `Over the maximum of ${approvalUpTo}: no further connection can be added`;
  return `Limit of ${freeUpTo} without approval exceeded: approval is required${approvalUpTo !== null ? ` (up to ${approvalUpTo})` : ''}`;
}

export function connectionLimitToast(report: ConnectionLimitReport): { message: string; rows: ToastRow[] } {
  const rows: ToastRow[] = [{ label: 'Total Connections', value: String(report.total) }];
  for (const limit of report.limits) rows.push({ label: `${TYPE_LABEL[limit.type]} Connections`, value: String(limit.count), sub: limitStatement(limit) });
  if (report.prepaid > 0) rows.push({ label: 'Prepaid Connections', value: String(report.prepaid) });
  return { message: 'Connection Limit Exceeded', rows };
}
