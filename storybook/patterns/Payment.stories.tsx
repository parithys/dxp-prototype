import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Payment, PaymentActions } from '../../src/capabilities';
import type { WinCashPaymentValue } from '../../src/components/patterns/WinCashPaymentStep';
import { Pay } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Payment',
  component: Payment,
  parameters: {
    ...docsParameters({
      purpose: 'Take the amount due at the counter through WinCash and record the outcome. (Capability registry: "Payment".) The amount is always the figure Checkout already computed.',
      source: 'src/capabilities/Payment/Payment.tsx',
      variants: ['WinCash only (default).', '`offerEWallet` / `demoEWallet` - "Pay with eWallet" for roles mapped to an eWallet.', '`onProceedWithout` - adds "Proceed Without WinCash" (physical cash received directly).', '`zeroValueReceipt` - when nothing is due, a zero-value receipt instead of a WinCash hand-off.'],
      states: ['Idle (first attempt)', 'Hand-off to the WinCash terminal started', 'Paid (WinCash / Cash / Zero value / eWallet)', 'Declined', 'WinCash error', 'Session expired', 'Insufficient eWallet balance'],
      events: ['`onChange(value: WinCashPaymentValue)` - `{ paid, method, reference, declined, errored, handoffStarted, sessionExpired ... }`.', '`onProceedWithout()`.'],
      usage: ['The first-attempt buttons are the journey\'s floating action bar (`PaymentActions`, the step\'s `primaryAction`); the card body holds the hand-off and outcome panels. The stories render both, as a journey does.'],
      restrictions: ['The WinCash terminal is simulated: the 500 ms return, and the decline / error / session-expiry buttons, are the prototype\'s stand-ins for a real POS.'],
    }),
  },
  argTypes: { amountDueQAR: { control: 'number', description: 'Amount due in QAR.' }, offerEWallet: { control: 'boolean' }, demoEWallet: { control: 'select', options: [undefined, 'sufficient', 'insufficient'] }, value: { control: false }, onChange: { control: false }, onProceedWithout: { control: false } },
  args: { amountDueQAR: 11250 },
} satisfies Meta<typeof Payment>;
export default meta;
type Story = StoryObj<typeof Payment>;

function Flow({ amountDueQAR, initial = {}, offerEWallet, demoEWallet, zeroValueReceipt, proceedWithout = true }: { amountDueQAR: number; initial?: WinCashPaymentValue; offerEWallet?: boolean; demoEWallet?: 'sufficient' | 'insufficient'; zeroValueReceipt?: boolean; proceedWithout?: boolean }) {
  const [v, setV] = useState<WinCashPaymentValue>(initial);
  const cash = () => setV({ paid: true, method: 'Cash', handoffStarted: false, declined: false });
  const onProceedWithout = proceedWithout ? cash : undefined;
  return (
    <div className="stack gap-4">
      <Payment amountDueQAR={amountDueQAR} value={v} onChange={setV} onProceedWithout={onProceedWithout} offerEWallet={offerEWallet} demoEWallet={demoEWallet} zeroValueReceipt={zeroValueReceipt} />
      <div className="row justify-end">
        <PaymentActions amountDueQAR={amountDueQAR} value={v} onChange={setV} onProceedWithout={onProceedWithout} offerEWallet={offerEWallet} demoEWallet={demoEWallet} />
      </div>
    </div>
  );
}

/** The app's own Capability Library preview (the card only; the journey's footer actions are in the stories below). */
export const Default: Story = { render: () => <Pay /> };

export const WithFooterActions: Story = { render: (args) => <Flow amountDueQAR={args.amountDueQAR} /> };

export const ProceedWithoutWinCash: Story = {
  render: (args) => <Flow amountDueQAR={args.amountDueQAR} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Proceed Without WinCash' }));
    await expect(await canvas.findByText('Paid')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Proceed Without WinCash' })).toBeNull();
  },
};

export const HandOffStarted: Story = { render: (args) => <Flow amountDueQAR={args.amountDueQAR} initial={{ handoffStarted: true }} /> };
export const Declined: Story = { render: (args) => <Flow amountDueQAR={args.amountDueQAR} initial={{ declined: true, paid: false }} /> };
export const WinCashError: Story = { render: (args) => <Flow amountDueQAR={args.amountDueQAR} initial={{ errored: true, paid: false }} /> };
export const SessionExpired: Story = { render: (args) => <Flow amountDueQAR={args.amountDueQAR} initial={{ sessionExpired: true }} /> };
export const Paid: Story = { render: (args) => <Flow amountDueQAR={args.amountDueQAR} initial={{ paid: true, method: 'WinCash', reference: 'WC-00012345' }} /> };
export const ZeroValueReceipt: Story = { args: { amountDueQAR: 0 }, render: (args) => <Flow amountDueQAR={args.amountDueQAR} zeroValueReceipt proceedWithout={false} /> };
export const EWalletSufficient: Story = { render: (args) => <Flow amountDueQAR={args.amountDueQAR} offerEWallet demoEWallet="sufficient" /> };
export const EWalletInsufficient: Story = { render: (args) => <Flow amountDueQAR={args.amountDueQAR} offerEWallet demoEWallet="insufficient" /> };
