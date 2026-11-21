import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { CheckoutDefaultLayout } from '../../src/components/patterns/CheckoutDefaultLayout';
import { useCheckoutSummary } from '../../src/components/patterns/useCheckoutSummary';
import type { EligibilityResult } from '../../src/components/domain/eligibilityTypes';
import { docsParameters } from '../_shared/docs';

type DemoProps = {
  productId?: string;
  discountId?: string;
  addonIds: string[];
  msisdn?: string;
  numberPriceQar?: number;
  numberWaiver?: number;
  hrn: boolean;
  creditLimitQar?: number;
  billLimit?: number;
  billingMethod?: string;
  altPhone?: string;
  onEdit: () => void;
};

const eligibility = (hrn: boolean) => ({ pass: true, hardStop: false, softStop: false, checks: [], blacklisted: false, lineCapExceeded: false, requiresHrnAdvance: hrn, nationality: hrn ? 'Pakistani' : 'Omani', defaultCreditLimitQar: hrn ? 50 : 1000, customerId: 'CUST-1001', idNumber: '28456701234' }) as unknown as EligibilityResult;

/** The layout fed the way CheckoutSummaryStep feeds it: the real `useCheckoutSummary` derives every figure from the catalogue and the order's choices. */
function Demo({ hrn, productId, discountId, addonIds, msisdn, numberPriceQar, numberWaiver, creditLimitQar, billLimit, billingMethod, altPhone, onEdit }: DemoProps) {
  const derived = useCheckoutSummary({
    customerName: 'Tariq Mansoor Al-Hashimi',
    productId,
    discountId,
    addonIds,
    msisdn,
    numberPriceQar,
    numberWaiver,
    creditLimitQar,
    eligibility: eligibility(hrn),
    simType: { simType: 'eSIM', esimIssued: true },
    onTotalsComputed: () => {},
  });
  return (
    <div style={{ maxWidth: 720 }}>
      <CheckoutDefaultLayout {...derived} customerName="Tariq Mansoor Al-Hashimi" altPhone={altPhone} billingMethod={billingMethod} msisdn={msisdn} billLimit={billLimit} onEdit={onEdit} />
    </div>
  );
}

const meta = {
  title: 'Patterns/Checkout Default Layout',
  component: Demo,
  parameters: {
    ...docsParameters({
      purpose: 'The original (non-"detailed") Checkout read-back: the agent\'s `dl` (customer, work number, plan, discount, add-ons, number, credit and bill limit, billing, VAT, advance payment) plus the Due Today / first-bill / recurring panel. It is what `CheckoutSummary layout="default"` renders; this story feeds it the order\'s choices directly to show the cases that change what it prints.',
      source: 'src/components/patterns/CheckoutDefaultLayout.tsx (figures from useCheckoutSummary.ts)',
      variants: [
        'Plan and add-ons: plan line with its lock-in; "Add-Ons: None" is stated rather than omitted.',
        'Plan discount row (percentage, monthly amount, validity) when a discount applies.',
        'Star number (QAR 1,500 and above): value, plan entitlement (BR-115) and any overage, lock-in tier; an Additional Discount (waived amount) line in the Due Today panel.',
        'HRN customer: an Advance Payment row and an Upfront / HRN fee line.',
        'Credit Limit and Bill Limit rows appear only when a credit limit is known; they are `agent-only` (left out of the customer\'s pop-up, with the Edit prompt).',
      ],
      states: ['No plan chosen ("-")', 'Free number vs Star number', 'With / without waiver, HRN advance, discount'],
      events: ['`onEdit()` - Edit returns to Plans and Add-Ons.'],
      accessibility: ['The read-back is a description list (`dl`); the total is plain text. `agent-only` rows are hidden from the customer-view pop-up, not from the agent.'],
      restrictions: ['It is presentational over `CheckoutSummaryDerived`; the Full Second-Bill Breakdown is a reserved placeholder in production (not yet designed).', 'The catalogue is read through the API layer, so figures appear once it has loaded.'],
    }),
  },
  argTypes: {
    productId: { control: 'text', description: 'The plan\'s product id (e.g. PROD-107).' },
    discountId: { control: 'text', description: 'An applied plan discount id (e.g. ADO-7400).' },
    addonIds: { control: 'object', description: 'Selected add-on product ids.' },
    msisdn: { control: 'text', description: 'The chosen number.' },
    numberPriceQar: { control: 'number', description: 'The number\'s sticker price, as the number catalogue stores it.' },
    numberWaiver: { control: 'number', description: 'The Additional Discount (QAR) waived off the number\'s charge.' },
    hrn: { control: 'boolean', description: 'The customer is High-Risk Nationality: an advance payment applies.' },
    creditLimitQar: { control: 'number', description: 'The credit limit in force; shows Credit Limit and Bill Limit rows.' },
    billLimit: { control: 'number', description: 'The bill limit the agent set.' },
    billingMethod: { control: 'text', description: 'The billing method row, when one was collected.' },
    altPhone: { control: 'text', description: 'The Work Number.' },
    onEdit: { control: false },
  },
  args: { productId: 'PROD-107', addonIds: [], msisdn: '+97459990000', numberPriceQar: 0, hrn: false, onEdit: fn() },
} satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

const ready = (root: HTMLElement) => waitFor(() => expect(within(root).getByText(/Postpaid Essential/)).toBeVisible(), { timeout: 5000 });

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await ready(canvasElement);
    await expect(within(canvasElement).getByText('Add-Ons').nextElementSibling).toHaveTextContent('None');
    await expect(within(canvasElement).getByText('Due Today')).toBeVisible();
  },
};

export const NoPlanYet: Story = {
  args: { productId: undefined, msisdn: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Plan').nextElementSibling).toHaveTextContent('-');
  },
};

export const WithAddonsAndDiscount: Story = {
  args: { discountId: 'ADO-7400', addonIds: ['PROD-160', 'PROD-165'], altPhone: '+97444001234' },
  play: async ({ canvasElement }) => {
    await ready(canvasElement);
    await waitFor(() => expect(within(canvasElement).getByText('Discount')).toBeVisible());
  },
};

export const StarNumberWithinEntitlement: Story = {
  args: { numberPriceQar: 2000 },
  play: async ({ canvasElement }) => {
    await ready(canvasElement);
    await expect(await within(canvasElement).findByText(/no extra charge/)).toBeVisible();
  },
};

export const StarNumberWithOverage: Story = {
  args: { numberPriceQar: 5000 },
  play: async ({ canvasElement }) => {
    await ready(canvasElement);
    await expect(await within(canvasElement).findByText(/extra beyond the/)).toBeVisible();
  },
};

export const StarNumberWithAdditionalDiscount: Story = {
  args: { numberPriceQar: 5000, numberWaiver: 500 },
  play: async ({ canvasElement }) => {
    await ready(canvasElement);
    await expect(await within(canvasElement).findByText('Additional Discount')).toBeVisible();
  },
};

export const HighRiskNationalityAdvance: Story = {
  args: { hrn: true },
  play: async ({ canvasElement }) => {
    await ready(canvasElement);
    await expect(await within(canvasElement).findByText('Advance Payment')).toBeVisible();
    await expect(within(canvasElement).getByText('Upfront / HRN fee')).toBeVisible();
  },
};

export const WithCreditAndBillLimit: Story = {
  args: { creditLimitQar: 1000, billLimit: 800, billingMethod: 'Paper-free e-bill' },
  play: async ({ canvasElement }) => {
    await ready(canvasElement);
    await expect(within(canvasElement).getByText('Credit Limit')).toBeVisible();
    await expect(within(canvasElement).getByText('Bill Limit')).toBeVisible();
  },
};

export const EditReturnsToPlan: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Edit' }));
    await expect(args.onEdit).toHaveBeenCalledTimes(1);
  },
};
