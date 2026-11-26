import { PAYMENT_LABEL } from '../../data/stepLabels';
import { Payment, PaymentActions, PaymentEWalletBalance } from './Payment';
import type { CheckoutTotals } from '../../components/patterns/checkoutSummaryModel';
import type { WinCashPaymentValue } from '../../components/patterns/WinCashPaymentStep';
import { type WizardStep } from 'dxp-ui';

/**
 * The figure Checkout already computed and read back to the customer (values.checkoutTotals, published by its
 * onTotalsComputed), not a re-derivation from the number's sticker price - that second derivation used to skip
 * BR-115's entitlement/overage logic entirely.
 */
const dueFromCheckout = (values: Record<string, unknown>) => (values.checkoutTotals as CheckoutTotals | undefined)?.dueTodayQar ?? 0;

/**
 * Payment, stored under `payment`; the step continues once the payment is confirmed (`paid`). `amountDue` reads
 * the figure Checkout computed from the values. `submitOnPaid` moves on the moment the payment returns, without
 * a separate Continue - for journeys where Payment is the last step and Continue could only ever mean "submit".
 * `zeroValueReceipt` issues a zero-value receipt, rather than a WinCash handoff, when the amount due is QAR 0. `offerEWallet` adds "Pay with eWallet" for the roles mapped to one (New Prepaid). `demoEWallet` (prototype demo) forces the eWallet to hold too little or enough for the order.
 */
export function paymentStep(opts: { amountDue?: (values: Record<string, unknown>) => number; submitOnPaid?: boolean; zeroValueReceipt?: boolean; offerEWallet?: boolean; demoEWallet?: (values: Record<string, unknown>) => 'sufficient' | 'insufficient' | undefined } = {}): WizardStep {
  const paid = (values: Record<string, unknown>) => Boolean((values.payment as WinCashPaymentValue | undefined)?.paid);
  const cashReceived = (values: Record<string, unknown>) => {
    const p = values.payment as WinCashPaymentValue | undefined;
    return Boolean(p?.paid && p.method === 'Cash');
  };
  const amountDue = (values: Record<string, unknown>) => (opts.amountDue ?? dueFromCheckout)(values);
  const onProceedWithout = (setValue: (field: string, value: unknown) => void) => () => setValue('payment', { paid: true, method: 'Cash', handoffStarted: false, declined: false });
  return {
    key: 'payment',
    label: PAYMENT_LABEL,
    // The floating button bar carries the payment actions (Continue in WinCash, Pay with eWallet, Proceed Without WinCash) instead of Continue / Save & Finish. Once paid it falls back to
    // the default button; with nothing due (the zero-value receipt, issued in the page) or while the hand-off panel is open there is nothing to put there.
    primaryAction: ({ values, setValue, defaultButton }) => {
      if (paid(values)) return defaultButton;
      if (opts.zeroValueReceipt && amountDue(values) === 0) return <></>;
      return (
        <PaymentActions
          amountDueQAR={amountDue(values)}
          offerEWallet={opts.offerEWallet}
          demoEWallet={opts.demoEWallet?.(values)}
          value={(values.payment as WinCashPaymentValue) ?? {}}
          onChange={(v) => setValue('payment', v)}
          onProceedWithout={onProceedWithout(setValue)}
        />
      );
    },
    // The eWallet Balance is reference information, not part of taking the payment: it is plain text just under the card.
    belowCard: ({ values }) =>
      opts.offerEWallet && !paid(values) ? <PaymentEWalletBalance offerEWallet demoEWallet={opts.demoEWallet?.(values)} amountDueQAR={amountDue(values)} /> : null,
    render: ({ values, setValue }) => (
      <Payment
        amountDueQAR={amountDue(values)}
        zeroValueReceipt={opts.zeroValueReceipt}
        offerEWallet={opts.offerEWallet}
        demoEWallet={opts.demoEWallet?.(values)}
        value={(values.payment as WinCashPaymentValue) ?? {}}
        onChange={(v) => setValue('payment', v)}
        // "Proceed without WinCash": the agent took physical cash directly, so WinCash is not waited for. The payment is
        // recorded as cash received, which completes the step and moves the journey on to the order summary.
        onProceedWithout={onProceedWithout(setValue)}
      />
    ),
    isValid: paid,
    // WinCash confirmation (`submitOnPaid` journeys) or cash taken directly moves the journey on without a further click.
    autoAdvanceWhen: (values) => (opts.submitOnPaid ? paid(values) : cashReceived(values)),
 };
}
