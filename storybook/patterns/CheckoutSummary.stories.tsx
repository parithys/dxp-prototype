import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { CheckoutSummary, PrepaidCheckout } from '../../src/capabilities';
import { Checkout } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Checkout Summary',
  component: CheckoutSummary,
  parameters: {
    ...docsParameters({
      purpose: 'The order read-back before signing and payment (plan, add-ons, discount, number, billing, monthly and one-off totals); publishes the totals and read-back rows the CAF and Payment reuse. Includes the prepaid cart and the prepaid checkout, which a prepaid port-in also uses with its own lines, details and fees. (Capability registry: "Checkout Summary".)',
      source: 'src/capabilities/CheckoutSummary/CheckoutSummary.tsx (CheckoutSummaryStep, PrepaidCheckoutStep)',
      variants: ['`layout="default"`: the original layout.', '`layout="detailed"`: the New Connection layout (Bill Explainer, one-off and recurring tables).', '`PrepaidCheckout`: the prepaid cart for a list of lines.'],
      states: ['Plan, number and eSIM with credit limit and the bill limit the agent set', 'No plan chosen yet', 'Prepaid with no lines'],
      events: ['`onTotalsComputed(totals)` - the figures the CAF and Payment reuse (never a second derivation).', '`onEdit(stepKey)` - the Edit links return to the step that owns the line.'],
      usage: ['Amounts are computed by the engines from the real catalogue (`productId` PROD-104, `numberPriceQar` in dirhams as the number catalogue stores them).'],
    }),
  },
  args: { onTotalsComputed: fn(), onEdit: fn() },
  argTypes: { layout: { control: 'select', options: ['default', 'detailed'], description: 'Original or New Connection layout.' }, billLimit: { control: 'number', description: 'Bill limit the agent set (QAR).' } },
} satisfies Meta<typeof CheckoutSummary>;
export default meta;
type Story = StoryObj<typeof CheckoutSummary>;

const ELIGIBILITY = {
  pass: true,
  hardStop: false,
  softStop: false,
  checks: [],
  blacklisted: false,
  lineCapExceeded: false,
  requiresHrnAdvance: false,
  defaultCreditLimitQar: 1000,
  customerId: 'CUST-1001',
  idNumber: '28456701234',
} as Parameters<typeof CheckoutSummary>[0]['eligibility'];

/** The app's own Capability Library preview, with its Postpaid / Prepaid switcher. */
export const Default: Story = { render: () => <Checkout /> };

export const PostpaidDetailed: Story = {
  args: { layout: 'detailed', customerName: 'Ahmed, Abdulla Hassan, Al-Sulaiti', altPhone: undefined, productId: 'PROD-104', discountId: undefined, addonIds: [], msisdn: '+97459990000', numberPriceQar: 20000, eligibility: ELIGIBILITY, billLimit: 1000, simType: { simType: 'eSIM', esimIssued: true } },
};
export const PostpaidDefaultLayout: Story = { args: { ...PostpaidDetailed.args, layout: 'default' } };
export const NoPlanYet: Story = { args: { ...PostpaidDetailed.args, productId: undefined, msisdn: undefined, numberPriceQar: undefined } };

export const PrepaidCart: Story = {
  render: (args) => <PrepaidCheckout customerName="Sample Customer" idType="QID" lines={[]} onTotalsComputed={() => {}} onEdit={args.onEdit} />,
};
