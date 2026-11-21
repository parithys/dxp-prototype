import type { ReactNode } from 'react';
import { Badge } from 'dxp-ui';
import { computeBillingSummary, type Customer360Data } from '../../../engines/customer360Engine';
import { formatAmountAny } from '../../../lib/format';
import { blacklistReasonLabel, blacklistReasonsOf } from '../../../engines/blacklistReasons';

type Resolver = (data: Customer360Data) => ReactNode | undefined;

/** customer360-fields.json's Blacklist View topic - no dedicated blacklist
 * dataset exists in this corpus, so this reads the real fields already on
 * the customer/account/billing records rather than a purpose-built one. */
export const blacklistResolvers: Record<string, Resolver> = {
  'Blacklisted ID Status': (data) =>
    data.customer.blacklisted ? (
      // Every reason, one badge each: a customer can be blacklisted for more than one.
      blacklistReasonsOf(data.customer).length > 0 ? (
        <div className="stack gap-1">
          {blacklistReasonsOf(data.customer).map((r) => (
            <Badge key={`${r.category}-${r.reason}`} variant="danger">{`Blacklisted - ${blacklistReasonLabel(r)}`}</Badge>
          ))}
        </div>
      ) : (
        <Badge variant="danger">Blacklisted</Badge>
      )
    ) : (
      <Badge variant="success">Not Blacklisted</Badge>
    ),
  'Account Number': (data) => (data.accounts.length > 0 ? data.accounts.map((a) => a.accountId).join(', ') : undefined),
  'Total amount': (data) => `${formatAmountAny(computeBillingSummary(data).outstanding)} QAR`,
  'Bill Period': (data) => {
    const { latestBill } = computeBillingSummary(data);
    return latestBill ? String(latestBill.billPeriod) : undefined;
  },
  'Bill Number': (data) => {
    const { latestBill } = computeBillingSummary(data);
    return latestBill ? String(latestBill.billId) : undefined;
  },
  MSISDNs: (data) => {
    const msisdns = Array.from(
      new Set([data.customer.phone, ...data.contacts.map((c) => c.cellNumber as string | undefined)].filter(Boolean))
    ) as string[];
    return msisdns.length > 0 ? msisdns.join(', ') : undefined;
  },
};
