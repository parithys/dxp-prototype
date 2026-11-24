import { useEffect, useState } from 'react';
import { evaluateRule } from '../../engines/ruleEngine';
import { outstandingBalance, type BillLike, type PaymentLike } from '../../engines/billingBalance';
import { listEntities } from '../../services/entityOps';

type Values = Record<string, unknown>;

/**
 * The fibre credit check: what the identified customer owes (the one shared definition, billingBalance.ts; a customer who is new to the journey owes nothing) judged against the outstanding-balance
 * rule once a plan is chosen, left in `creditCheckPass`. Returns the balance (undefined until read). The plan page runs it, and so does Recommended Offers for a plan an accepted offer chose.
 */
export function useHomeCreditCheck(values: Values, setValue: (f: string, v: unknown) => void): number | undefined {
  const [outstandingQar, setOutstandingQar] = useState<number | undefined>();
  const selectedId = values.productId as string | undefined;
  const customerId = (values.eligibility as { customerId?: string } | undefined)?.customerId;
  useEffect(() => {
    if (!customerId) {
      setOutstandingQar(0);
      return;
    }
    void Promise.all([listEntities<BillLike & { customerId?: string }>('bills'), listEntities<PaymentLike & { customerId?: string }>('payments')]).then(([bills, payments]) =>
      setOutstandingQar(outstandingBalance(bills.filter((b) => b.customerId === customerId), payments.filter((p) => p.customerId === customerId)))
    );
  }, [customerId]);
  useEffect(() => {
    if (selectedId && outstandingQar !== undefined) {
      setValue('creditCheckPass', evaluateRule('BR-FIBRE-OUTSTANDING-THRESHOLD', { outstandingQar }).pass);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, outstandingQar]);
  return outstandingQar;
}
