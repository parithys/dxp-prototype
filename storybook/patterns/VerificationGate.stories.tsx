import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { Button } from 'dxp-ui';
import { VerificationGate } from '../../src/components/patterns/VerificationGate';
import { docsParameters } from '../_shared/docs';

type Props = Parameters<typeof VerificationGate>[0];

/** Opens the gate from a button, the way a maintenance action does. */
function Host(props: Props) {
  const [open, setOpen] = useState(props.open);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Edit contact details
      </Button>
      <VerificationGate
        {...props}
        open={open}
        onClose={() => {
          setOpen(false);
          props.onClose();
        }}
      />
    </>
  );
}

const meta = {
  title: 'Patterns/Verification Gate',
  component: VerificationGate,
  parameters: {
    ...docsParameters({
      purpose: 'Re-confirms the identified customer\'s identity before any demographic, contact, address or billing maintenance (CUS-001-KYC-02/03, BR-01). A drawer that mounts the Customer Identification capability bound to THIS customer (scan or type the ID and expiry, verify, Fetch from MOI) and then the Eligibility checks on that customer. Verify & Continue is enabled only when MOI resolved the customer to the same id AND the eligibility result is not a hard stop.',
      source: 'src/components/patterns/VerificationGate.tsx',
      states: ['Closed', 'Open, not identified (Verify & Continue disabled)', 'Identified, eligibility running / passed (enabled)', 'Identified but a hard stop (blacklist, expired ID, under 18 ...): stays disabled', 'Identified as a different customer: stays disabled'],
      events: ['`onVerified()` - after Verify & Continue; it records the customer in the customer-verification store (a one-way set: once Verified a customer is never un-verified).', '`onClose()` - Cancel, Escape or the close control.'],
      usage: ['Opened from Customer 360 before a maintenance action. Pressing Enter inside the drawer submits when Verify & Continue is enabled. The eligibility step skips the line limit, since maintenance adds no line.'],
      validation: ['A scanned or typed ID that resolves to another customer leaves the gate disabled; the identification card shows the field errors.'],
      accessibility: ['The drawer is the shared Radix Dialog: focus trap, Escape closes, labelled by "Verify Customer Identity", focus returns to the opener. Verify & Continue uses the native `disabled` attribute until it can proceed.'],
      devices: ['Scan-led on a tablet, type-led on the web (Customer Identification detects the device): use the toolbar **Device** switch.'],
      restrictions: ['MOI and the scanner are simulated by the mock data layer. Verifying writes to the app\'s customer-verification store, so a verified customer stays verified for the Storybook session.'],
    }),
  },
  argTypes: { customerId: { control: 'text', description: 'The customer being re-verified; the scan must resolve to this id.' }, customerName: { control: 'text', description: 'Shown in the explanatory sentence.' }, open: { control: 'boolean', description: 'Whether the drawer is open.' }, onClose: { control: false }, onVerified: { control: false } },
  args: { customerId: 'CUST-1001', customerName: 'Sample Customer', open: true, onClose: fn(), onVerified: fn() },
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof VerificationGate>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async () => {
    const dialog = await screen.findByRole('dialog');
    await expect(within(dialog).getByText(/identity must be verified before any demographic/)).toBeVisible();
    await expect(within(dialog).getByRole('button', { name: /Verify & Continue/ })).toBeDisabled();
  },
};

export const Closed: Story = { args: { open: false } };

export const CancelClosesTheGate: Story = {
  play: async ({ args }) => {
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await expect(args.onClose).toHaveBeenCalled();
    await expect(args.onVerified).not.toHaveBeenCalled();
  },
};

export const OpenFromAction: Story = {
  args: { open: false },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Edit contact details' }));
    await expect(await screen.findByRole('dialog')).toBeVisible();
  },
};

export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } };
