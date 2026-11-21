import type { ComponentProps } from 'react';
import { WinCashEWalletBalance, WinCashPaymentActions, WinCashPaymentStep } from '../../components/patterns/WinCashPaymentStep';
import { eWalletEligible } from '../../data/prepaidActivation';

import { eWalletActions } from '../../stores/eWalletSlice';
import { store } from '../../stores/store';
import { useAppSelector } from '../../stores/hooks';

/**
 * PAYMENT - the one application-wide capability for taking the amount due at the counter: hand off to WinCash,
 * confirm on return (or decline / session expiry), and record the outcome on the order.
 *
 * Journeys mount THIS component (usually through paymentStep in wizard/wizardSteps) and pass the amount due; none
 * of them mounts WinCashPaymentStep itself. The amount is always the figure Checkout already computed and read
 * back to the customer, never a second derivation.
 */
export type PaymentProps = Omit<ComponentProps<typeof WinCashPaymentStep>, 'eWallet' | 'actionsInFooter'> & {
  /**
   * Offer "Pay with eWallet" to the roles mapped to an eWallet (Mass Market): the capability reads the role, the (mock) balance and does the deduction, so a journey only says
   * that it offers it. Off (every other journey): WinCash only.
   */
  offerEWallet?: boolean;
  /**
   * PROTOTYPE DEMO: forces the eWallet outcome whatever the role's balance, so a demo shows both screens. 'insufficient' holds less than the amount due; 'sufficient' holds more, and
   * paying from it succeeds without touching the real balance. Omitted: the role's balance, as it is.
   */
  demoEWallet?: 'sufficient' | 'insufficient';
};

/** The role's eWallet for this payment (or none): the capability reads the role and the (mock) balance and does the deduction. */
function usePaymentEWallet({ offerEWallet, demoEWallet, amountDueQAR }: { offerEWallet: boolean; demoEWallet?: 'sufficient' | 'insufficient'; amountDueQAR: number }) {
  const roleId = useAppSelector((s) => s.persona.activePersonaId);
  const balance = useAppSelector((s) => s.eWallet.balances[roleId] ?? 0);
  const due = amountDueQAR;
  const shown = demoEWallet === 'sufficient' ? Math.max(balance, Math.ceil(due) + 500) : demoEWallet === 'insufficient' ? Math.min(balance, due / 2) : balance;
  return offerEWallet && eWalletEligible(roleId)
    ? { balanceQar: shown, onPay: (amountQar: number) => (demoEWallet === 'sufficient' ? true : store.dispatch(eWalletActions.deduct(roleId, amountQar))) }
    : undefined;
}

export function Payment({ offerEWallet = false, demoEWallet, ...props }: PaymentProps) {
  const eWallet = usePaymentEWallet({ offerEWallet, demoEWallet, amountDueQAR: props.amountDueQAR });
  return <WinCashPaymentStep {...props} eWallet={eWallet} actionsInFooter />;
}

/** The Payment actions for the journey's floating button bar (the step's `primaryAction`): the same eWallet and the same amount as the body above. */
export function PaymentActions({ offerEWallet = false, demoEWallet, ...props }: Pick<PaymentProps, 'offerEWallet' | 'demoEWallet' | 'amountDueQAR' | 'value' | 'onChange' | 'onProceedWithout'>) {
  const eWallet = usePaymentEWallet({ offerEWallet, demoEWallet, amountDueQAR: props.amountDueQAR });
  return <WinCashPaymentActions {...props} eWallet={eWallet} />;
}

/** The eWallet Balance for the step's `belowCard`: outside the Payment card, above the floating button bar. Nothing for a role with no eWallet. */
export function PaymentEWalletBalance({ offerEWallet = false, demoEWallet, amountDueQAR }: Pick<PaymentProps, 'offerEWallet' | 'demoEWallet' | 'amountDueQAR'>) {
  const eWallet = usePaymentEWallet({ offerEWallet, demoEWallet, amountDueQAR });
  return eWallet ? <WinCashEWalletBalance balanceQar={eWallet.balanceQar} /> : null;
}
