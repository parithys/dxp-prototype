import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PostpaidDiscountsPanel } from '../../src/components/patterns/PostpaidDiscountsPanel';
import { docsParameters } from '../_shared/docs';
import { DISCOUNTS } from './_fixtures';

type PanelProps = Parameters<typeof PostpaidDiscountsPanel>[0];

function Demo(props: PanelProps) {
  const [id, setId] = useState(props.discountId);
  return (
    <PostpaidDiscountsPanel
      {...props}
      discountId={id}
      onSelectDiscount={(next) => {
        props.onSelectDiscount(next);
        setId(next);
      }}
    />
  );
}

const meta = {
  title: 'Business Components/Postpaid Discounts Panel',
  component: PostpaidDiscountsPanel,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'The Eligible Discounts tab: a "No Discount" card plus one card per discount the customer is eligible for (smallest rate first), with exactly one selected. It also states why there is nothing to choose.',
      source: 'src/components/patterns/PostpaidDiscountsPanel.tsx',
      variants: ['Discount list; a Special Discount (MADA / B2B2C / Retired) is titled "Special Discount 25%" whatever its type.'],
      states: ['No plan selected; Loading; Error (warning alert with Retry - the agent can continue without one); Pre-bundled plan ("Discounts Unavailable for This Plan"); Empty ("No discounts available for this plan."); Ready with No Discount selected; Ready with a discount selected.'],
      events: ['`onSelectDiscount(id | undefined)` - `undefined` is No Discount. `onRetryDiscounts` from the error alert.'],
      usage: ['`discounts` are already filtered to what the customer may take (`discountsForCustomer`, `discountsForSpecialType`); the panel only presents them.'],
      accessibility: ['Cards are `role="button"` with `aria-pressed`. The error notice is `role="alert"`.'],
    }),
  },
  argTypes: {
    selectedProductId: { control: 'text', description: 'The chosen plan; none shows the "Select a plan" hint.' },
    preBundled: { control: 'boolean', description: 'The chosen plan already includes its offer.' },
    discountId: { control: 'text', description: 'The chosen discount\'s addonDiscountId; empty means No Discount.' },
    discounts: { control: 'object', description: 'The eligible discounts.' },
    discountsState: { control: 'select', options: ['loading', 'error', 'ready'], description: 'Where loading the plan\'s discounts is.' },
    onSelectDiscount: { control: false },
    onRetryDiscounts: { control: false },
  },
  args: { selectedProductId: 'PROD-110', preBundled: false, discountId: undefined, discounts: DISCOUNTS, discountsState: 'ready', onSelectDiscount: fn(), onRetryDiscounts: fn() },
} satisfies Meta<typeof PostpaidDiscountsPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DiscountSelected: Story = { args: { discountId: 'ADO-7400' } };

export const SpecialDiscount: Story = { args: { discounts: [DISCOUNTS[2]], discountId: 'ADO-7112' } };

export const NoPlanSelected: Story = { args: { selectedProductId: undefined } };

export const Loading: Story = { args: { discountsState: 'loading' } };

export const ErrorWithRetry: Story = {
  args: { discountsState: 'error' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }));
    await expect(args.onRetryDiscounts).toHaveBeenCalled();
  },
};

export const PreBundledPlan: Story = { args: { preBundled: true } };

export const Empty: Story = { args: { discounts: [] } };

export const ChooseAndClear: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const none = canvas.getByRole('button', { name: /No Discount/ });
    await expect(none).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(canvas.getByRole('button', { name: /10% Discount/ }));
    await expect(args.onSelectDiscount).toHaveBeenCalledWith('ADO-7400');
    await expect(none).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(none);
    await expect(args.onSelectDiscount).toHaveBeenLastCalledWith(undefined);
    await expect(none).toHaveAttribute('aria-pressed', 'true');
  },
};
