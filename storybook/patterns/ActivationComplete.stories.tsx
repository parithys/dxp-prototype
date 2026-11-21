import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ActivationComplete } from '../../src/capabilities';
import type { ActivationCompleteOrder } from '../../src/components/patterns/ActivationCompleteScreen';
import { OrderConfirmationScreen } from '../../src/components/patterns/OrderConfirmationScreen';
import { Complete } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const ORDER: ActivationCompleteOrder = { orderId: 'ORD-SAMPLE', activityId: 'ACT-SAMPLE', pendingApproval: false, customerName: 'Sample Customer', msisdn: '+974 55550100', planName: 'Postpaid Essential', simType: 'eSIM', dueTodayQar: 0, monthlyRecurringQar: 115 };

const meta = {
  title: 'Patterns/Activation Complete',
  component: ActivationComplete,
  parameters: {
    ...docsParameters({
      purpose: 'The confirmation page for a submitted activation (facts, status, follow-on actions, eSIM handover, email) and the confirmed-order shape journeys hand it. (Capability registry: "Activation Complete".) `OrderConfirmationScreen` is the generic layout underneath: heading, order and activity numbers, a summary receipt, an optional hand-over panel, actions and print actions.',
      source: 'src/capabilities/ActivationComplete/ActivationComplete.tsx, src/components/patterns/ActivationCompleteScreen.tsx, OrderConfirmationScreen.tsx',
      variants: ['`service="mobile"` (a SIM number and SIM type row) or `"fixed"` (Fixed Line Number, no SIM row).', '`pendingApproval`: heading "Order Submitted for Approval" with the approving team.', '`showActivityId={false}`: the customer-view pop-up (the order, never the internal activity id).', '`allowCustomerView`: the agent\'s window offers Customer view on this page.', 'Order extras: `heading`, `statusLabel`, `extraLines`, `trackAction` (port-in), `familyPackage`, `esimActivationCode` (QR hand-over), `terms` (Print T&C / Supplement).'],
      states: ['Complete', 'Pending approval', 'eSIM with QR hand-over', 'Without monthly or due-today charge (prepaid, port-in request)'],
      events: ['"Done & Exit" records the automatic activity and closes the Qnomy ticket; `onAddConnection(familyLine)` (Family Package) opens Add Another Connection.'],
      usage: ['The order is a `ConfirmedOrder` built by the journey (`orderTerms`, `confirmedOrder.ts`).'],
      restrictions: ['Done & Exit and View My Orders act on the app\'s store and routes: in Storybook the router is stubbed, so only the on-page effects are visible.'],
    }),
  },
  argTypes: { service: { control: 'select', options: ['mobile', 'fixed'], description: 'SIM number or fixed-line number.' }, showActivityId: { control: 'boolean' }, allowCustomerView: { control: 'boolean' }, order: { control: 'object' } },
  args: { order: ORDER, service: 'mobile', showActivityId: true, allowCustomerView: false },
} satisfies Meta<typeof ActivationComplete>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The app's own Capability Library preview. */
export const Default: Story = {
  render: () => <Complete />,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('heading', { name: /Order Submitted Successfully/ })).toBeInTheDocument();
  },
};

export const PendingApproval: Story = {
  args: { order: { ...ORDER, pendingApproval: true } },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('heading', { name: /Order Submitted for Approval/ })).toBeInTheDocument();
  },
};
export const FixedLine: Story = { args: { service: 'fixed', order: { ...ORDER, simType: undefined, msisdn: '+974 44001234', planName: 'Fibre 500' } } };
export const CustomerView: Story = { args: { showActivityId: false } };
export const WithCustomerViewButton: Story = { args: { allowCustomerView: true } };
export const PortInRequest: Story = { args: { order: { ...ORDER, heading: 'Port-in request submitted', statusLabel: 'Pending', dueTodayQar: undefined, monthlyRecurringQar: undefined, extraLines: [{ label: 'NPAS Reference', value: 'NPAS-0001' }] } } };
export const EsimHandover: Story = { args: { order: { ...ORDER, simType: 'eSIM', esimActivationCode: 'LPA:1$sample.vodafone.qa$SAMPLE-CODE', customerEmail: 'sample.customer@example.qa', customerEmailVerified: true } } };

/** The generic layout beneath the page: the receipt, the hand-over slot and the action rows. */
export const OrderConfirmation: StoryObj<typeof OrderConfirmationScreen> = {
  render: () => {
    const done = fn();
    return (
      <OrderConfirmationScreen
        heading="Order Submitted Successfully"
        orderId="ORD-SAMPLE"
        activityId="ACT-SAMPLE"
        summaryLines={[{ label: 'Customer', value: 'Sample Customer' }, { label: 'Plan', value: 'Postpaid Essential' }, { label: 'Status', value: 'Complete' }]}
        actions={[{ label: 'Done & Exit', variant: 'primary', onClick: done }, { label: 'View My Orders', onClick: () => {} }]}
        printActions={[{ label: 'Print T&C', onClick: () => {} }]}
        handoverPanel={<div className="card p-5">Hand-over panel (the eSIM QR in the activation journeys)</div>}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Order Submitted Successfully' })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Done & Exit' }));
    await expect(canvas.getByText('ORD-SAMPLE')).toBeInTheDocument();
  },
};
