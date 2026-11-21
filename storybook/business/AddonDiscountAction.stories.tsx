import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { ApplyAddonDiscountAction } from '../../src/capabilities/AddonsSelection/ApplyAddonDiscountAction';
import type { AppliedAddonDiscounts } from '../../src/engines/addonDiscounts';
import { docsParameters } from '../_shared/docs';

type Props = Parameters<typeof ApplyAddonDiscountAction>[0];

/** Keeps the applied choices the way the Add-ons step keeps `addonDiscounts`. */
function Host(args: Props) {
  const [applied, setApplied] = useState<AppliedAddonDiscounts>(args.applied);
  return (
    <div className="stack gap-4">
      <ApplyAddonDiscountAction
        {...args}
        applied={applied}
        onApply={(next) => {
          setApplied(next);
          args.onApply(next);
        }}
      />
      <p className="caption-muted">Applied: {Object.keys(applied).length === 0 ? 'none' : Object.entries(applied).map(([a, d]) => `${a} -> ${d}`).join(', ')}</p>
    </div>
  );
}

const meta = {
  title: 'Business Components/Add-on Discount Action',
  component: ApplyAddonDiscountAction,
  parameters: {
    ...docsParameters({
      purpose: '"Apply Discount", beside Continue on the postpaid Add-ons page: the add-on counterpart of the plan page\'s Edit Discount. It opens a modal listing, for each SELECTED add-on that has discounts it is eligible for, the choice of one discount or No Discount.',
      source: 'src/capabilities/AddonsSelection/ApplyAddonDiscountAction.tsx',
      states: ['No button (no selected add-on can be discounted - a free add-on has no discounts)', 'Button, modal closed', 'Modal open, No Discount selected / a discount selected', 'Applied'],
      events: ['`onApply(next)` - add-on product id to discount id, only on Apply, and only for add-ons still selected. Cancel or closing leaves the choices unchanged.'],
      usage: ['Eligibility is what the discount record states (`appliesToAddons`), read from `addon-discounts.json`; PROD-160 (Data Booster 20) takes ADD-DSC-001 and ADD-DSC-002. No supporting document is asked for.'],
      accessibility: ['The modal is the shared Dialog (focus trap, Escape closes, labelled by its title). Each add-on\'s options sit in a section labelled with the add-on; each option is a `role="button"` card with `aria-pressed`.'],
    }),
  },
  argTypes: { selectedIds: { control: 'object', description: 'Product ids of the add-ons selected on the page.' }, applied: { control: false }, onApply: { control: false } },
  args: { selectedIds: ['PROD-160'], applied: {}, onApply: fn() },
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof ApplyAddonDiscountAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('button', { name: 'Apply Discount' }, { timeout: 5000 })).toBeVisible();
  },
};

export const SeveralAddons: Story = { args: { selectedIds: ['PROD-160', 'PROD-161', 'PROD-167'] } };
export const AlreadyApplied: Story = { args: { applied: { 'PROD-160': 'ADD-DSC-001' } } };

/** Nothing selected: the component renders nothing (the canvas is empty). */
export const NoSelectedAddon: Story = { args: { selectedIds: [] } };

export const ChooseAndApply: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Apply Discount' }, { timeout: 5000 }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(await within(dialog).findByRole('button', { name: /Add-On Loyalty Discount/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(args.onApply).toHaveBeenCalledWith({ 'PROD-160': 'ADD-DSC-001' }));
  },
};

export const CancelLeavesChoicesUnchanged: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Apply Discount' }, { timeout: 5000 }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(await within(dialog).findByRole('button', { name: /Add-On Loyalty Discount/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await expect(args.onApply).not.toHaveBeenCalled();
  },
};
