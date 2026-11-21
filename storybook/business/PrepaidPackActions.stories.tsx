import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { PrepaidPackActions } from '../../src/capabilities/PlanSelection/PrepaidPackActions';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Business Components/Prepaid Pack Actions',
  component: PrepaidPackActions,
  parameters: {
    ...docsParameters({
      purpose: 'What sits beside Continue once a prepaid pack is chosen: "Customise Add-ons" (the way to the Addons page, only when the pack has add-ons) and "Edit Discount" (the pack\'s discount, "No Discount" until one is chosen). It composes Customise Add-ons Action and Edit Discount Action.',
      source: 'src/capabilities/PlanSelection/PrepaidPackActions.tsx',
      variants: ['`discountEditable` (default true): both actions. `discountEditable={false}` (New Prepaid activation): a pack there has no discount to edit, so only Customise Add-ons.'],
      states: ['Both buttons (PROD-301 has an add-on and a Welcome discount)', 'Only Edit Discount (a pack with no add-ons, PROD-300 has none and no discount either)', 'No buttons'],
      events: ['`onSelectDiscount(id | undefined)`, `setCustomise()`, `goNext()` - see the two actions.'],
      usage: ['Whether the pack has add-ons is read from the catalogue (`usePackHasAddons`): unknown stays unknown, so no button is shown on a guess.'],
      accessibility: ['Two secondary Buttons with text labels, in the footer\'s tab order.'],
    }),
  },
  argTypes: { productId: { control: 'select', options: [undefined, 'PROD-300', 'PROD-301', 'PROD-302'], description: 'The chosen prepaid pack.' }, discountEditable: { control: 'boolean', description: 'False for New Prepaid activation.' }, discountId: { control: 'text' }, onSelectDiscount: { control: false }, setCustomise: { control: false }, goNext: { control: false } },
  args: { productId: 'PROD-301', discountId: undefined, discountEditable: true, onSelectDiscount: fn(), setCustomise: fn(), goNext: fn() },
  render: (args) => (
    <div className="cluster">
      <PrepaidPackActions {...args} />
    </div>
  ),
} satisfies Meta<typeof PrepaidPackActions>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: 'Customise Add-ons' }, { timeout: 5000 })).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Edit Discount' })).toBeVisible();
  },
};

export const NewPrepaidActivation: Story = {
  args: { discountEditable: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: 'Customise Add-ons' }, { timeout: 5000 })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Edit Discount' })).toBeNull();
  },
};

/** The standard SIM (PROD-300) has neither add-ons nor a discount: nothing renders. */
export const PackWithNothing: Story = { args: { productId: 'PROD-300' } };
export const NoPack: Story = { args: { productId: undefined } };
