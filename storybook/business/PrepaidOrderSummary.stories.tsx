import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { PrepaidOrderSummary } from '../../src/components/patterns/PrepaidOrderSummary';
import type { PrepaidLine } from '../../src/components/patterns/prepaidCartModel';
import { docsParameters } from '../_shared/docs';

// Lines are what the New Prepaid cart holds: real catalogue ids (products.json PROD-302 / PROD-301, recharge-products.json RCH-CMBP-050), real numbers from numbers.json
// (+97433002011 is a Free number, +97477778888 a QAR 5,000 Star number) and SIMs from sims.json (8974412009900129000 Physical, 8974412009900140101 a printed eSIM).
const FREE_NUMBER_LINE: PrepaidLine = {
  productId: 'PROD-302',
  addonIds: [],
  rechargeId: 'RCH-CMBP-050',
  prePaired: false,
  msisdn: '+97433002011',
  numberPriceQAR: 0,
  simType: { simType: 'Physical', simSerial: '8974412009900129000', simValid: true, simIccid: '8974412009900129000', simStockStatus: 'Available', simKind: 'Physical' },
};
const STAR_NUMBER_LINE: PrepaidLine = {
  productId: 'PROD-301',
  addonIds: [],
  prePaired: false,
  msisdn: '+97477778888',
  numberPriceQAR: 5000,
  numberWaiver: 1000,
  simType: { simType: 'eSIM', esimIssued: true, esimActivationCode: 'LPA:1$smdp.vodafone.qa$ABCD2345EFGH6789', simIccid: '8974412009900140101' },
};

const meta = {
  title: 'Business Components/Prepaid Order Summary',
  component: PrepaidOrderSummary,
  parameters: {
    ...docsParameters({
      purpose: 'The New Prepaid order summary in the same two-table design as the postpaid read-back (`SummaryTables`): an ORDER SUMMARY (customer, each subscription\'s pack, recharge and amount, number and number type, SIM type, serial and pairing) beside UPFRONT CHARGES (every chargeable item with its VAT-exclusive value and VAT, the VAT figures and the Total Payable Today). The order\'s checks appear above as a danger notice.',
      source: 'src/components/patterns/PrepaidOrderSummary.tsx (pricing: prepaidCartModel.ts `cartTotals` / `priceLine`; checks: prepaidOrderValidation.ts)',
      variants: ['One subscription, or several (rows are prefixed "Subscription n" and a Subscriptions count appears).', 'A Star number adds Number Value, Number Discount Value (the agent\'s Waive Off) and Star Number Lock-In (the tier its value falls in, else "To be confirmed").', '`onEdit` adds the secondary button (`editLabel`, default "Edit subscriptions").'],
      states: ['Loading ("Preparing the order summary..." until products, add-ons, recharges and Star tiers are read); Ready; Invalid (the danger notice lists what must be resolved: missing customer name / ID, no subscription, a pack not offered to the segment, an invalid number or SIM, a repeated number or SIM).'],
      events: ['`onTotalsComputed(totals)`, `onValidated(errors)` and `onSummaryComputed(rows)` are reported once the catalogue is loaded and again when figures change - the journey gates Continue on `onValidated` and the CAF step reads `onSummaryComputed`. `onEdit()` from the button.'],
      validation: ['Messages come from `prepaidOrderErrors`: no name/ID, no subscription, "The selected pack is not compatible with this customer.", invalid mobile number, invalid SIM, duplicates. The notice is `role="alert"`.'],
      accessibility: ['The tables are real tables with row headers (see Checkout Summary Tables); the error notice is an alert with a list.'],
      restrictions: ['It reads the live catalogue (products, add-ons-discounts, recharge-products, Star tiers), so figures follow `public/mock-data`.'],
    }),
  },
  argTypes: {
    customerName: { control: 'text', description: 'The customer\'s name (required by the order checks).' },
    idType: { control: 'select', options: ['QID', 'Passport', 'GCC ID', 'Diplomatic ID'], description: 'The ID type (drives the SIM card charge rule).' },
    idNumber: { control: 'text', description: 'The ID number (required by the order checks).' },
    segment: { control: 'select', options: [undefined, 'Consumer', 'Premium'], description: 'The customer\'s segment: a pack with `eligibleSegments` is offered only to it.' },
    lines: { control: 'object', description: 'The subscriptions on the order (PrepaidLine[]).' },
    editLabel: { control: 'text', description: 'The edit button\'s label.' },
    onEdit: { control: false },
    onTotalsComputed: { control: false },
    onValidated: { control: false },
    onSummaryComputed: { control: false },
  },
  args: { customerName: 'Fatima Al-Kuwari', idType: 'QID', idNumber: '27801063400071', segment: 'Consumer', lines: [FREE_NUMBER_LINE], onTotalsComputed: fn(), onValidated: fn(), onSummaryComputed: fn() },
} satisfies Meta<typeof PrepaidOrderSummary>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    await expect(await within(canvasElement).findByText('Order Summary', undefined, { timeout: 5000 })).toBeInTheDocument();
    await waitFor(() => expect(args.onValidated).toHaveBeenCalledWith([]));
  },
};

export const StarNumberAndEsim: Story = { args: { lines: [STAR_NUMBER_LINE] } };

export const TwoSubscriptions: Story = { args: { lines: [FREE_NUMBER_LINE, STAR_NUMBER_LINE] } };

export const WithEditButton: Story = {
  args: { onEdit: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Edit subscriptions' }, { timeout: 5000 }));
    await expect(args.onEdit).toHaveBeenCalled();
  },
};

export const MissingCustomerDetails: Story = {
  args: { customerName: undefined, idNumber: undefined },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('alert', undefined, { timeout: 5000 })).toHaveTextContent('Customer account information is incomplete');
  },
};

export const PackNotOfferedToSegment: Story = {
  args: { lines: [{ ...FREE_NUMBER_LINE, productId: 'PROD-304', rechargeId: undefined }], segment: 'Consumer' },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('The selected pack is not compatible with this customer.', undefined, { timeout: 5000 })).toBeInTheDocument();
  },
};

export const RepeatedNumber: Story = {
  args: { lines: [FREE_NUMBER_LINE, { ...FREE_NUMBER_LINE, simType: { ...FREE_NUMBER_LINE.simType, simSerial: '8974412345678901234', simIccid: '8974412345678901234' } }] },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(/is on more than one subscription/, undefined, { timeout: 5000 })).toBeInTheDocument();
  },
};
