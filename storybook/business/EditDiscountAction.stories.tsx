import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { AddDiscountAction } from '../../src/capabilities/PlanSelection/AddDiscountAction';
import { docsParameters } from '../_shared/docs';

type Props = Parameters<typeof AddDiscountAction>[0];

/** Keeps the chosen discount the way the plan step keeps `discountId`. */
function Host(args: Props) {
  const [id, setId] = useState<string | undefined>(args.discountId);
  return (
    <div className="stack gap-4">
      <AddDiscountAction
        {...args}
        discountId={id}
        onSelectDiscount={(next) => {
          setId(next);
          args.onSelectDiscount(next);
        }}
      />
      <p className="caption-muted">Chosen discount: {id ?? 'No Discount'}</p>
    </div>
  );
}

const meta = {
  title: 'Business Components/Edit Discount Action',
  component: AddDiscountAction,
  parameters: {
    ...docsParameters({
      purpose: '"Edit Discount", beside Continue once a plan is chosen on Standard Plans or Special Offers (and a prepaid pack, through Prepaid Pack Actions). It opens the discounts the customer can have on THAT plan, with "No Discount" selected until the agent chooses one. Cards show what each takes off `planAmount`, or its percentage when no amount is given.',
      source: 'src/capabilities/PlanSelection/AddDiscountAction.tsx',
      variants: ['Standard Plans (`tab="standard"`, or no tab): the plan\'s ordinary discounts only - a Special Discount belongs to Special Offers.', 'Special Offers (`tab="special"`): the Special Discount the customer holds is the point of the tab (`specialDiscountType`).', 'Offers tab (`tab="offers"`): the plan is pre-bundled, so no button.'],
      states: ['No button (no plan, an Offers plan, or nothing to offer)', 'Button, modal closed', 'Modal open (No Discount or a discount selected)'],
      events: ['`onSelectDiscount(id | undefined)` - only on Apply; Cancel or closing leaves the chosen discount as it was.'],
      usage: ['Reads the same `addons-discounts.json` catalogue and customer rules (`customerBenefits`, `customerBenefit`) as the Eligible Discounts panel and writes the same `discountId`. PROD-111 (Postpaid Unlimited, QAR 225) has Loyalty and Promotional discounts.'],
      accessibility: ['The modal is the shared Dialog (focus trap, Escape closes). Each option is a `role="button"` card with `aria-pressed`.'],
    }),
  },
  argTypes: {
    productId: { control: 'text', description: 'The chosen plan\'s product id; no button without one.' },
    tab: { control: 'select', options: [undefined, 'for-you', 'standard', 'special', 'offers'], description: 'The plan tab the plan was chosen from.' },
    discountId: { control: 'text', description: 'The chosen discount\'s id.' },
    specialDiscountType: { control: 'select', options: [undefined, 'none', 'mada', 'b2b2c', 'retired'], description: 'The customer\'s Special Discount type.' },
    customerBenefit: { control: 'text', description: 'The benefit the customer holds.' },
    planAmount: { control: 'number', description: 'The plan\'s monthly amount (QAR), so each card shows the amount off.' },
    customerBenefits: { control: false },
    onSelectDiscount: { control: false },
  },
  args: { productId: 'PROD-111', tab: 'standard', discountId: undefined, onSelectDiscount: fn(), customerBenefits: undefined, specialDiscountType: undefined, customerBenefit: undefined, planAmount: 225 },
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof AddDiscountAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('button', { name: 'Edit Discount' }, { timeout: 5000 })).toBeVisible();
  },
};

export const PercentageOnly: Story = { args: { planAmount: undefined } };
export const DiscountAlreadyChosen: Story = { args: { discountId: 'ADO-7118' } };
export const LoyaltyCustomer: Story = { args: { customerBenefits: ['loyalty'], planAmount: 225 } };
/** The plan was chosen from the Offers tab: pre-bundled, so the component renders nothing. */
export const OffersPlanNoButton: Story = { args: { tab: 'offers' } };
/** No plan chosen yet: the component renders nothing. */
export const NoPlanNoButton: Story = { args: { productId: undefined } };

export const OpenAndApply: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Edit Discount' }, { timeout: 5000 }));
    const dialog = await screen.findByRole('dialog');
    const cards = within(dialog).getAllByRole('button', { pressed: false });
    await userEvent.click(cards[0]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(args.onSelectDiscount).toHaveBeenCalledWith(expect.any(String)));
  },
};

export const CancelLeavesChoiceUnchanged: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Edit Discount' }, { timeout: 5000 }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await expect(args.onSelectDiscount).not.toHaveBeenCalled();
  },
};
