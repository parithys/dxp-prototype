import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkoutSummaryStep, paymentStep } from '../../src/capabilities';
import type { SimTypeValue } from '../../src/components/domain/SimTypeStep';
import { StepFlow, exampleParameters } from './_harness';
import type { Values } from './_harness';
import { CLEAN_ELIGIBILITY, SLOW, contactOfCustomer, CUSTOMER, summaryText, useLoaded } from './_fixtures';

/** A Star number of numbers.json worth more than Postpaid Essential's entitlement, so something is due today. */
const STAR_MSISDN = '+97477000000';
const STAR_PRICE = 50000;
const ESIM: SimTypeValue = { simType: 'eSIM', esimIssued: true, esimActivationCode: 'LPA:1$demo.vodafone.qa$ACTIVATION', simIccid: '8974412009900140101' };

const meta: Meta = {
  title: 'Application Examples/Order Summary and Payment',
  parameters: exampleParameters({
    purpose: 'The read-back and the payment as one scenario: Checkout reads the order\'s facts (customer, plan, number, SIM, discounts, credit and bill limit) into the Order Summary, Upfront Charges and Approximate Bill Explainer tables and publishes what it computed; Payment then collects exactly that "Total Payable Today" - never a second calculation.',
    source: 'src/capabilities/CheckoutSummary (step.tsx) over src/components/patterns/CheckoutSummaryTables.tsx and checkoutDetailedTables.ts; src/capabilities/Payment (step.tsx, Payment.tsx)',
    variants: [
      'Default: a Star number above the plan\'s entitlement - the customer pays the difference (VAT inclusive) and the step then takes it through WinCash.',
      'With an Additional Discount: the Upfront Charges list the charge, the amount waived and the charge after the waiver, and Payment collects the reduced figure.',
      'Proceed Without WinCash: the agent took physical cash directly; the payment is recorded as Cash.',
    ],
    states: ['Order Summary (read-only, Edit returns to the plan)', 'Payment: amount due, first attempt (actions in the footer)', 'Paid (badge and reference / method)', 'Declined, error and session expiry appear on the hand-off panel (see Patterns / Payment)'],
    events: ['`onTotalsComputed(totals)` - stored under `checkoutTotals`; Payment reads `dueTodayQar` from it.', '`onChange(payment)` - `{ paid, method, reference ... }` stored under `payment`; the step is valid once `paid`.'],
    usage: ['The Agent-only rows (Credit Limit, Bill Limit) and the Approximate Bill Explainer are not shown in the customer\'s pop-up.'],
    restrictions: ['WinCash is simulated: Continue in WinCash records a successful payment after a short delay.'],
  }),
};
export default meta;
type Story = StoryObj<typeof meta>;

function OrderToPayment({ numberWaiver }: { numberWaiver?: number }) {
  const contact = useLoaded(() => contactOfCustomer(CUSTOMER.clean));
  const steps = useMemo(() => [checkoutSummaryStep(), paymentStep({ submitOnPaid: true, zeroValueReceipt: true })], []);
  if (!contact) return <p className="muted-body">Loading the customer from the mock data…</p>;
  const initial: Values = {
    contact,
    eligibility: CLEAN_ELIGIBILITY,
    productId: 'PROD-107',
    msisdn: STAR_MSISDN,
    numberPriceQAR: STAR_PRICE,
    simType: ESIM,
    ...(numberWaiver ? { numberWaiver } : {}),
  };
  return <StepFlow steps={steps} initial={initial} finishLabel="Save & Finish" />;
}

const digits = (text: string | null | undefined) => Number((text ?? '').replace(/[^\d.]/g, ''));
/** The value cell next to a row label of a table. */
const valueNextTo = (root: HTMLElement, label: string) => {
  const row = [...root.querySelectorAll('th')].find((th) => th.textContent?.trim() === label);
  return row?.nextElementSibling?.textContent;
};

export const Default: Story = {
  render: () => <OrderToPayment />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Upfront Charges', undefined, SLOW)).toBeVisible();
    await expect(canvas.getByText('Approximate Bill Explainer')).toBeVisible();
    // The plan is read from the catalogue after the first render, so its name and the charges that follow from it arrive a moment later.
    await waitFor(() => expect(valueNextTo(canvasElement, 'Plan Name')).toContain('Postpaid Essential'), SLOW);
    // What is due today is computed here, once.
    await waitFor(() => expect(digits(valueNextTo(canvasElement, 'Total Payable Today'))).toBeGreaterThan(0), SLOW);
    const due = digits(valueNextTo(canvasElement, 'Total Payable Today'));
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    // Payment collects exactly that figure.
    const amount = await canvas.findByText('Amount Due (WinCash)', undefined, SLOW);
    await expect(digits(amount.nextElementSibling?.textContent)).toBe(due);
    // The journey summary keeps only the Order Summary section (collapsed) and an Edit link back to it; the total row is not repeated there.
    await expect(summaryText(canvasElement)).toContain('Order Summary');
    await userEvent.click(canvas.getByRole('button', { name: 'Continue in WinCash' }));
    await expect(await canvas.findByText('Paid', undefined, SLOW)).toBeVisible();
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Save & Finish' })).toBeEnabled());
  },
};

export const WithAdditionalDiscount: Story = {
  render: () => <OrderToPayment numberWaiver={1000} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Number Charge After Waiver', undefined, SLOW)).toBeVisible();
    await expect(canvas.getByText('Number Amount to Pay')).toBeVisible();
    await expect(canvas.getByText('Additional Discount')).toBeVisible();
  },
};

export const ProceedWithoutWinCash: Story = {
  render: () => <OrderToPayment />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(digits(valueNextTo(canvasElement, 'Total Payable Today'))).toBeGreaterThan(0), SLOW);
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Proceed Without WinCash' }, SLOW));
    // Cash taken directly: the payment is recorded as paid by Cash and the step can finish.
    await expect(await canvas.findByText('Paid')).toBeVisible();
    await expect(canvas.getByText(/Paid by Cash/)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Save & Finish' })).toBeEnabled();
  },
};

export const Tablet: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  parameters: { viewport: { defaultViewport: 'tablet' } },
  render: () => <OrderToPayment />,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Upfront Charges', undefined, SLOW)).toBeVisible();
  },
};
