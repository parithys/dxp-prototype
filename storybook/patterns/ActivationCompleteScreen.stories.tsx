import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { ActivationCompleteScreen } from '../../src/components/patterns/ActivationCompleteScreen';
import type { ActivationCompleteOrder } from '../../src/components/patterns/ActivationCompleteScreen';
import { docsParameters } from '../_shared/docs';

// Each story uses its own order id: the screen remembers (per page load) which orders it has already emailed, so a shared id would make the
// second story read "sent" without sending.
const order = (id: string, over: Partial<ActivationCompleteOrder> = {}): ActivationCompleteOrder => ({
  orderId: `ORD-SB-${id}`,
  activityId: `ACT-SB-${id}`,
  pendingApproval: false,
  customerName: 'Tariq Mansoor Al-Hashimi',
  msisdn: '+974 5555 0100',
  planName: 'Postpaid Essential',
  simType: 'Physical SIM',
  dueTodayQar: 0,
  monthlyRecurringQar: 115,
  ...over,
});

const meta = {
  title: 'Patterns/Activation Complete Screen',
  component: ActivationCompleteScreen,
  parameters: {
    layout: 'fullscreen',
    ...docsParameters({
      purpose: 'The standard "Activation complete" page that every activation journey ends on, shown here directly (the Activation Complete story shows the capability that wraps it). One layout, one row order, one set of actions: the journey supplies only the facts about its order. This story covers what the wrapper stories do not: the email outcome, the row variants, Add Another Connection and the Additional Comments dialog.',
      source: 'src/components/patterns/ActivationCompleteScreen.tsx (layout: OrderConfirmationScreen.tsx)',
      variants: [
        '`numberLabel` and `hideSimType`: a journey without a SIM (Fixed Activation) names its number and drops the SIM row.',
        'Order rows: `authorisedRepresentative` (Customer Representative orders), `activeAddons`, `billingCycle`, `familyPackage`, `extraLines`; `heading`/`statusLabel` overrides.',
        '`onAddConnection`: with a `familyPackage` on an activated order for a known customer, the page offers Add Another Connection.',
        'Fibre offer: when the customer\'s location is Ready for Service a "Start New Fiber" panel follows (read from the customer or address; absent while reading or when none).',
      ],
      states: ['Complete', 'Held for approval (heading "Order Submitted for Approval", the approving team in brackets)', 'Email sent / not sent (no address on file, or one not verified against the ID record)', 'Additional Comments dialog (Add Comments disabled until a comment is entered)'],
      events: ['Done & Exit records the automatic activity, closes the held Qnomy ticket, releases the customer and navigates home; Create Lead records a lead; `onAddConnection()`.'],
      validation: ['Additional Comments requires a non-blank comment; the dialog\'s Add Comments is disabled until one is entered.'],
      accessibility: ['The heading is the page `h1`-level title of the confirmation; actions are buttons and the email outcome is plain text. The comments dialog is the app\'s Modal (focus trapped, Escape closes).'],
      restrictions: ['The screen acts on the app: a verified email address records a message in the mock `customer-communications` data (once per order per page load), and Done & Exit / Create Lead write mock records and navigate - these are not clicked in the stories.'],
    }),
  },
  argTypes: {
    order: { control: 'object', description: 'The facts of the submitted order.' },
    numberLabel: { control: 'text', description: 'What the number is called (default "MSISDN").' },
    hideSimType: { control: 'boolean', description: 'Leave out the SIM Type row.' },
    onAddConnection: { control: false },
  },
  args: { order: order('DEFAULT'), numberLabel: 'MSISDN', hideSimType: false },
} satisfies Meta<typeof ActivationCompleteScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { name: /Order Submitted Successfully/ })).toBeVisible();
    await expect(canvas.getByText('No email address is on file, so the order details were not sent.')).toBeVisible();
  },
};

export const EmailNotVerified: Story = {
  args: { order: order('UNVERIFIED', { customerEmail: 'tariq@example.qa', customerEmailVerified: false }) },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(/could not be verified against the customer's ID record/)).toBeVisible();
  },
};

export const EmailSent: Story = {
  args: { order: order('SENT', { customerEmail: 'tariq@example.qa', customerEmailVerified: true }) },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Your order details have been sent to your email.')).toBeVisible();
  },
};

export const FixedActivationWithoutSim: Story = {
  args: { numberLabel: 'Fixed Line Number', hideSimType: true, order: order('FIXED', { msisdn: '+974 4400 1234', planName: 'Fibre 500', simType: undefined, billingCycle: '1st of the month', activeAddons: [] }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Fixed Line Number')).toBeVisible();
    await expect(canvas.queryByText('SIM Type')).toBeNull();
    await expect(canvas.getByText('None')).toBeVisible();
  },
};

export const CustomerRepresentativeOrder: Story = {
  args: { order: order('REP', { authorisedRepresentative: 'Layla Samir Haddadin', activeAddons: ['Data Booster 20'], billingCycle: '15th of the month' }) },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Authorised Representative')).toBeVisible();
    await expect(within(canvasElement).getByText('Layla Samir Haddadin')).toBeVisible();
  },
};

export const HeldForApproval: Story = {
  args: { order: order('HELD', { pendingApproval: true, statusLabel: 'Submitted for Approval' }) },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('heading', { name: /Order Submitted for Approval/ })).toBeVisible();
  },
};

export const FamilyPackageAddAnotherConnection: Story = {
  args: {
    onAddConnection: fn(),
    order: order('FAMILY', { customerId: 'CUST-1001', planName: 'Postpaid Ahli Pro Family', familyPackage: { packageId: 'FPK-CUST-1001', lineLabel: 'Primary Line 1', planName: 'Postpaid Ahli Pro Family' } }),
  },
  play: async ({ canvasElement, args }) => {
    const add = await within(canvasElement).findByRole('button', { name: 'Add Another Connection' });
    await userEvent.click(add);
    await expect(args.onAddConnection).toHaveBeenCalledTimes(1);
  },
};

export const FamilyPackageAwaitingApproval: Story = {
  args: {
    onAddConnection: fn(),
    order: order('FAMILY-HELD', { pendingApproval: true, customerId: 'CUST-3084', familyPackage: { packageId: 'FPK-CUST-3084', lineLabel: 'Primary Line 1', planName: 'Postpaid Ahli Pro Family' } }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/awaiting approval; other connections open once it is approved/)).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Add Another Connection' })).toBeNull();
  },
};

export const PortInRequest: Story = {
  args: { order: order('PORT', { heading: 'Port-in request submitted', statusLabel: 'Pending', dueTodayQar: undefined, monthlyRecurringQar: undefined, extraLines: [{ label: 'NPAS Reference', value: 'NPAS-0001' }, { label: 'Response Deadline', value: '3 working days' }], trackAction: { label: 'Track Port-In', to: '/mnp-fnp-porting' } }) },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('NPAS-0001')).toBeVisible();
    await expect(within(canvasElement).getByRole('button', { name: 'Track Port-In' })).toBeVisible();
  },
};

function CommentsHost() {
  const [mounted] = useState(true);
  return mounted ? <ActivationCompleteScreen order={order('COMMENTS')} /> : null;
}

export const AdditionalComments: Story = {
  render: () => <CommentsHost />,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Additional Comments' }));
    const dialog = await screen.findByRole('dialog');
    const add = within(dialog).getByRole('button', { name: 'Add Comments' });
    await expect(add).toBeDisabled();
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Comments/ }), 'Customer asked for a call back.');
    await expect(add).toBeEnabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  },
};
