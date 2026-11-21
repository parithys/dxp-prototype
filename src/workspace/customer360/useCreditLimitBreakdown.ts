import { useEffect, useState } from 'react';
import { creditLimitBreakdown, defaultCreditLimitFor, depositIncreaseOf, type CreditLimitBreakdown, type CreditLimitRecord } from '../../engines/creditLimit';
import { listEntities } from '../../services/entityOps';

/**
 * The credit-limit figures for a customer known only by id (a page that does not load the whole Customer 360 data, such as the Billing Account page):
 * the same breakdown creditLimitView.creditBreakdownOf gives the screens that do. Undefined until loaded.
 */

/**
 * The credit-limit figures for a customer known only by id (a page that does not load the whole Customer 360 data, such as the Billing Account page):
 * the same breakdown creditLimitView.creditBreakdownOf gives the screens that do. Undefined until loaded.
 */
export function useCustomerCreditBreakdown(customerId: string | undefined): CreditLimitBreakdown | undefined {
  const [breakdown, setBreakdown] = useState<CreditLimitBreakdown | undefined>();
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    void Promise.all([
      listEntities<{ customerId: string; nationality?: string }>('customers'),
      listEntities<CreditLimitRecord & { customerId?: string; accountId?: string }>('credit-limits'),
      listEntities<{ accountId?: string; depositAmountQar?: number; status?: string }>('deposit-bundles'),
    ]).then(([customers, limits, bundles]) => {
      if (cancelled) return;
      const record = limits.find((l) => l.customerId === customerId);
      const nationality = customers.find((c) => c.customerId === customerId)?.nationality;
      setBreakdown(creditLimitBreakdown(record, defaultCreditLimitFor(nationality), depositIncreaseOf(record?.accountId, bundles)));
    });
    return () => {
      cancelled = true;
    };
  }, [customerId]);
  return breakdown;
}
