import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ActivationComplete, EligibilityGateStep } from '../../src/capabilities';
import type { ActivationCompleteOrder } from '../../src/components/patterns/ActivationCompleteScreen';
import { TechnicalFailure } from '../../src/components/patterns/ValidationStatus';
import { Button, Card } from 'dxp-ui';
import { listEntities } from '../../src/services/entityOps';
import { exampleParameters } from './_harness';
import { SLOW, useLoaded } from './_fixtures';

/** Real orders of public/mock-data/orders.json: one Complete, and one held for Credit Control approval (the customer holds 5 postpaid lines: see Eligibility Checks). */
const COMPLETE_ORDER = 'ORD-92018';
const HELD_ORDER = 'ORD-92003';

interface OrderRow {
  orderId: string;
  status: string;
  customerId: string;
  customerName?: string;
  msisdn?: string;
  productIds?: string[];
  totalQAR?: number;
  mrcTotalQAR?: number;
}
interface ProductRow {
  productId: string;
  name: string;
}

const meta: Meta = {
  title: 'Application Examples/Confirmation and Completion',
  parameters: exampleParameters({
    purpose: 'Activation Complete as one scenario: the page that follows a submitted order - the heading and tick, the order and activity numbers, the receipt, what happens to the confirmation email, the eSIM hand-over, the follow-on actions (Done & Exit, View My Orders, Create Lead, Additional Comments) and the print actions (Print Order, Print CAF, Print Supplementary Form) - and the states where the order is held or the journey is blocked. Built from the production Activation Complete capability over real orders of public/mock-data.',
    source: 'src/capabilities/ActivationComplete (ActivationComplete.tsx) over src/components/patterns/ActivationCompleteScreen.tsx and OrderConfirmationScreen.tsx',
    variants: [
      'Default: a complete order with the signed CAF - Print Order and Print CAF.',
      'With a Secondary Contact: adds Print Supplementary Form (only for a line with an actual user other than the customer).',
      'eSIM: the QR hand-over panel beside the receipt; the QR is sent only to a verified email.',
      'Submitted for approval: the heading, status and email say the order is held, and name the team it waits on (read from the order).',
      'Email blocked: the address could not be verified against the ID record (or none is on file), so the details were not sent - said on the page, never assumed sent.',
      'Journey blocked: the eligibility service failed after the allowed retries (a technical failure, never read as eligible or ineligible) and a hard stop - no order is submitted, so there is no confirmation.',
    ],
    states: ['Complete', 'Submitted for Approval', 'Email sent / not sent', 'Order not submitted (blocked)'],
    events: ['Done & Exit records the automatic activity, releases the customer and returns to the dashboard; View My Orders opens the orders list; Additional Comments opens a dialog to record a manual activity. (Navigation is logged to the Actions panel in Storybook.)'],
    usage: ['Print Order uses the browser\'s print; Print CAF / Print Supplementary Form print the terms the customer signed (`order.terms`).', 'Nothing in this page re-derives the order: it prints what the journey submitted.'],
    devices: ['The page is the same on both devices; the receipt and actions reflow (the actions wrap, the two columns stack below `lg`).'],
    restrictions: ['The stories do not press the actions (Done & Exit records an activity and releases the journey in the in-memory mock data; Print opens the browser\'s print dialog).'],
  }),
};
export default meta;
type Story = StoryObj<typeof meta>;

/** What the journey hands to the page for a real order: its customer, number, plan and totals are read from the order's own record. */
function useOrder(orderId: string, extra: Partial<ActivationCompleteOrder> = {}): ActivationCompleteOrder | undefined {
  return useLoaded(async () => {
    const [orders, products] = await Promise.all([listEntities<OrderRow>('orders'), listEntities<ProductRow>('products')]);
    const o = orders.find((x) => x.orderId === orderId);
    if (!o) throw new Error(`${orderId} is not in public/mock-data/orders.json`);
    return {
      orderId: o.orderId,
      activityId: `ACT-${o.orderId.slice(4)}`,
      pendingApproval: o.status === 'Submitted for Approval',
      customerName: o.customerName ?? o.customerId,
      customerId: o.customerId,
      msisdn: o.msisdn ?? '-',
      planName: products.find((p) => o.productIds?.includes(p.productId))?.name ?? '-',
      simType: 'Physical',
      dueTodayQar: o.totalQAR ?? 0,
      monthlyRecurringQar: o.mrcTotalQAR,
      terms: { journey: 'postpaid' },
      customerEmailVerified: true,
      ...extra,
    } satisfies ActivationCompleteOrder;
  }, [orderId]);
}

function Completed({ orderId, extra, showActivityId }: { orderId: string; extra?: Partial<ActivationCompleteOrder>; showActivityId?: boolean }) {
  const order = useOrder(orderId, extra);
  if (!order) return <p className="muted-body">Loading the order from the mock data…</p>;
  return <ActivationComplete order={order} showActivityId={showActivityId} />;
}

const ESIM = { simType: 'eSIM', esimActivationCode: 'LPA:1$demo.vodafone.qa$ACTIVATION', customerEmail: 'customer@example.qa', customerEmailVerified: true } as const;

export const Default: Story = {
  render: () => <Completed orderId={COMPLETE_ORDER} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { name: 'Order Submitted Successfully' }, SLOW)).toBeVisible();
    await expect(canvas.getByText(COMPLETE_ORDER)).toBeVisible();
    // The follow-on actions, with Done & Exit as the primary one, and the print actions of a signed CAF.
    for (const name of ['Done & Exit', 'View My Orders', 'Additional Comments', 'Print Order', 'Print CAF']) await expect(canvas.getByRole('button', { name })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Print Supplementary Form' })).toBeNull();
  },
};

export const WithSecondaryContact: Story = {
  name: 'With a Secondary Contact',
  render: () => (
    <Completed
      orderId={COMPLETE_ORDER}
      extra={{ terms: { journey: 'postpaid', supplementary: { rows: [{ label: 'Actual User', value: 'Faisal Mansoor Khalid Abdullah Al-Marri' }], actualUserName: 'Faisal Mansoor Khalid Abdullah Al-Marri' } } }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: 'Print Supplementary Form' }, SLOW)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Print CAF' })).toBeVisible();
  },
};

export const ESimHandover: Story = {
  name: 'eSIM hand-over',
  render: () => <Completed orderId={COMPLETE_ORDER} extra={ESIM} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/eSIM QR code will be sent only to your verified email address/, undefined, SLOW)).toBeVisible();
    await expect(canvas.getAllByText('eSIM', { exact: true }).length).toBeGreaterThan(0);
  },
};

export const SubmittedForApproval: Story = {
  name: 'Submitted for approval',
  render: () => <Completed orderId={HELD_ORDER} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { name: /Order Submitted for Approval/ }, SLOW)).toBeVisible();
    // The team the order waits on is read from the order itself.
    await expect(await canvas.findByText(/Credit Control/, undefined, SLOW)).toBeVisible();
  },
};

export const EmailNotSent: Story = {
  name: 'Blocked: email not sent',
  render: () => <Completed orderId={COMPLETE_ORDER} extra={{ customerEmail: 'not-the-address-on-record@example.qa', customerEmailVerified: false }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/could not be verified against the customer's ID record, so the order details were not sent/, undefined, SLOW)).toBeVisible();
  },
};

export const CustomerViewWithoutActivityId: Story = {
  name: 'Customer pop-up (no activity id)',
  render: () => <Completed orderId={COMPLETE_ORDER} showActivityId={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { name: 'Order Submitted Successfully' }, SLOW)).toBeVisible();
    await expect(canvas.queryByText(/Activity:/)).toBeNull();
  },
};

/** The journey cannot reach a confirmation: a service failure after its retries, and a hard stop, each as the app shows them. */
function NotSubmitted() {
  return (
    <div className="stack gap-6">
      <Card className="p-6 stack gap-4" aria-label="Eligibility service failure">
        <h2 className="title title-lg">Order not submitted: the check could not be completed</h2>
        <TechnicalFailure service="eligibility" kind="unavailable" attempts={3} exhaustedHint="Eligibility has not been checked, so this order cannot continue. Use Save as Draft to resume later." />
        <div className="row justify-end">
          <Button variant="secondary">Save as Draft</Button>
        </div>
      </Card>
      <Card className="p-6 stack gap-4" aria-label="Hard stop">
        <h2 className="title title-lg">Order not submitted: the customer is blocked</h2>
        <EligibilityGateStep idNumber="DIP-QA-004521" onResult={() => undefined} announcePass={false} scope="product" journeyType="postpaid" />
        <p className="caption-secondary">No order exists, so there is no confirmation page, no activity and no email; Abandon Order in the journey header is the only way out.</p>
      </Card>
    </div>
  );
}

export const JourneyBlocked: Story = {
  name: 'Blocked: no order submitted',
  render: () => <NotSubmitted />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The failure is reported, with its reference to quote, and is never read as eligible or ineligible.
    await expect(await canvas.findByText('System issue - needs follow-up')).toBeVisible();
    await expect(canvas.getByText(/Reference:/)).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /Retry/ })).toBeNull();
    // The hard stop lists why, and offers no way on.
    await expect(await canvas.findByText('Security Check', undefined, SLOW)).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Done & Exit' })).toBeNull();
  },
};
