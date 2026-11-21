import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PrepaidCartBody } from '../../src/capabilities/CheckoutSummary/PrepaidCartBody';
import { docsParameters } from '../_shared/docs';

type Props = Parameters<typeof PrepaidCartBody>[0];

/** A finished subscription: a pack, a number and a validated SIM (what `currentLine` needs). */
const FINISHED: Record<string, unknown> = {
  productId: 'PROD-301',
  msisdn: '+97455550101',
  addonIds: [],
  simType: { simType: 'eSIM', esimIssued: true },
};

/** Holds the wizard's values the way the journey does, so Add Another really commits to `cart` and clears the line keys. */
function Host(props: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(props.values);
  return (
    <div className="stack gap-4">
      <PrepaidCartBody
        {...props}
        values={values}
        setValue={(field, value) => {
          setValues((prev) => ({ ...prev, [field]: value }));
          props.setValue(field, value);
        }}
      />
      <p className="caption-muted">Committed to the cart: {Array.isArray(values.cart) ? values.cart.length : 0}; current pack: {String(values.productId ?? 'none')}</p>
    </div>
  );
}

const meta = {
  title: 'Business Components/Prepaid Cart Body',
  component: PrepaidCartBody,
  parameters: {
    ...docsParameters({
      purpose: 'The step body of the prepaid "Add another subscription?" decision. Adding commits the finished subscription to the cart (`cart`), clears the per-line keys so the plan, number and SIM steps start fresh, and returns to the plan step one render later, after the wizard has recomputed its steps. It wraps the shared Prepaid Cart list.',
      source: 'src/capabilities/CheckoutSummary/PrepaidCartBody.tsx',
      states: ['Empty (no finished subscription yet: a status message, Add Another disabled)', 'One or more subscriptions listed', 'Duplicate number or SIM (alert, Add Another disabled)'],
      events: ['`setValue(field, value)` - writes `cart` and clears each per-line key.', '`goToStepKey("plan")` - once per Add Another, a render after the values change.'],
      usage: ['`values` is the wizard\'s value bag: the subscription being edited is `productId`, `msisdn` and a complete `simType` (a validated Physical SIM or an issued eSIM); committed ones are in `cart`.'],
      accessibility: ['The list is labelled "Subscriptions on this order"; the empty message is `role="status"`, a duplicate error `role="alert"`.'],
    }),
  },
  argTypes: { values: { control: 'object', description: 'The wizard\'s values.' }, setValue: { control: false }, goToStepKey: { control: false } },
  args: { values: FINISHED, setValue: fn(), goToStepKey: fn() },
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof PrepaidCartBody>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('list', { name: 'Subscriptions on this order' })).toBeVisible();
  },
};

export const Empty: Story = {
  args: { values: {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add Another Subscription' })).toBeDisabled();
  },
};

export const SeveralSubscriptions: Story = {
  args: {
    values: {
      ...FINISHED,
      cart: [
        { productId: 'PROD-302', addonIds: [], prePaired: false, msisdn: '+97455550102', numberPriceQAR: 0, simType: { simType: 'eSIM', esimIssued: true } },
        { productId: 'PROD-301', addonIds: [], prePaired: true, msisdn: '+97455550103', numberPriceQAR: 0, simType: { simType: 'Physical', simValid: true, simSerial: '8974412345678901234' } },
      ],
    },
  },
};

export const DuplicateNumber: Story = {
  args: { values: { ...FINISHED, cart: [{ productId: 'PROD-302', addonIds: [], prePaired: false, msisdn: '+97455550101', numberPriceQAR: 0, simType: { simType: 'eSIM', esimIssued: true } }] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('alert')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add Another Subscription' })).toBeDisabled();
  },
};

export const AddAnother: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Add Another Subscription' }));
    await expect(args.setValue).toHaveBeenCalledWith('cart', expect.any(Array));
    await expect(args.setValue).toHaveBeenCalledWith('productId', undefined);
    await expect(args.setValue).toHaveBeenCalledWith('addonIds', []);
    await expect(args.goToStepKey).toHaveBeenCalledWith('plan');
    await expect(canvas.getByText(/Committed to the cart: 1/)).toBeVisible();
  },
};
