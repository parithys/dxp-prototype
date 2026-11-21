import { useState } from 'react';
import { Button, Modal, Select, WALLET } from 'dxp-ui';
import { useEntityOps } from '../../../services/entityHooks';
import { useSubmit } from '../../../hooks/useSubmit';
import { notificationActions } from '../../../stores/notificationSlice';
import { useAction } from '../../../stores/hooks';
import { formatQar } from '../../../lib/format';

/** How the amount is taken at the counter (the capture channel recorded on the payment). */
const SETTLEMENT_CHANNELS = ['WinCash', 'Cash at Counter', 'Card (POS)'] as const;

/**
 * "Pay Now" on Customer 360 Billing & Payments: settles what the customer owes - the issued, unpaid invoices in view - so a blacklisted customer
 * (collections) can clear the balance before going on. The invoices are marked paid and the payment is recorded as a 'Bill Settlement' (not 'Monthly
 * Bill': the engine nets 'Monthly Bill' payments against open invoices, and these invoices are closed here, so it must not be netted a second time).
 * With nothing owed the collections block no longer holds (the check blocks on a balance above zero), and Customer 360's balance and the eligibility
 * check both read the same bills, so they update together.
 */
export function PayOutstandingDialog({
  customerId,
  customerName,
  invoices,
  amountQar,
  onSettled,
  onClose,
}: {
  customerId: string;
  customerName?: string;
  /** The unpaid invoices being settled (billed / overdue), each with its bill id and amount. */
  invoices: { billId: string; totalAmount: number }[];
  amountQar: number;
  /** Called once the payment is recorded, with the invoices now paid and the payment, so the open Customer 360 shows the new balance at once. */
  onSettled?: (paidBillIds: string[], payment: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const ops = useEntityOps();
  const pushToast = useAction(notificationActions.pushToast);
  const [channel, setChannel] = useState<string>(SETTLEMENT_CHANNELS[0]);
  const { run, pending } = useSubmit(async () => {
    const now = new Date();
    const stamp = now.toISOString();
    const receipt = `RCPT-${String(now.getTime()).slice(-8)}`;
    for (const inv of invoices) await ops.updateRecord('bills', 'billId', inv.billId, { status: 'paid', paidAt: stamp });
    const payment = {
      paymentId: `PAY-${String(now.getTime()).slice(-8)}`,
      orderId: null,
      customerId,
      paymentMethod: 'Full Payment',
      captureChannel: channel,
      receiptNumber: receipt,
      chargeType: 'Bill Settlement',
      amountQar,
      status: 'Authorized',
      capturedAt: stamp,
    };
    await ops.createRecord('payments', payment);
    onSettled?.(invoices.map((i) => i.billId), payment);
    pushToast('success', `Payment of ${formatQar(amountQar)} received (${receipt}). The outstanding balance is settled.`);
    onClose();
  }, 'The payment could not be recorded. Please try again.');

  return (
    <Modal
      open
      onClose={onClose}
      title="Pay Outstanding Amount"
      subtitle={customerName}
      icon={WALLET}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => void run()} disabled={pending || invoices.length === 0 || amountQar <= 0}>
            {pending ? 'Recording…' : `Pay ${formatQar(amountQar)}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <dl className="summary-panel">
          <div className="split">
            <dt>Unpaid Bills</dt>
            <dd>{invoices.length}</dd>
          </div>
          <div className="split summary-total">
            <dt>Amount To Pay</dt>
            <dd>{formatQar(amountQar)}</dd>
          </div>
        </dl>
        <Select
          label="Payment Channel"
          options={SETTLEMENT_CHANNELS.map((c) => ({ value: c, label: c }))}
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        />
      </div>
    </Modal>
  );
}
