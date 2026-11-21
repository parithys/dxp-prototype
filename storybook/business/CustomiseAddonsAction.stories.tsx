import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { CustomiseAddonsAction } from '../../src/capabilities/PlanSelection/CustomiseAddonsAction';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Business Components/Customise Add-ons Action',
  component: CustomiseAddonsAction,
  parameters: {
    ...docsParameters({
      purpose: '"Customise Add-ons", beside Edit Discount once a plan is chosen. Continue from the plan page goes straight on to Number Selection (the add-ons page is passed over); this button is the way to the add-ons page. A pre-bundled plan already includes its extras and accepts none, so it has no button.',
      source: 'src/capabilities/PlanSelection/CustomiseAddonsAction.tsx',
      states: ['Button (a plan is chosen and can be customised)', 'No button: no plan, a pre-bundled plan, or `available={false}` (nothing to customise)'],
      events: ['`setCustomise()` - sets the `customiseAddons` flag, which makes the add-ons step stop Continue.', '`goNext()` - called one render after `setCustomise`, because the wizard reads the values of the render it belongs to.'],
      accessibility: ['A secondary Button with a visible text label; reached in the footer\'s tab order beside Continue.'],
    }),
  },
  argTypes: {
    productId: { control: 'text', description: 'The chosen plan or pack; no button without one.' },
    preBundled: { control: 'boolean', description: 'A pre-bundled plan accepts no add-ons: no button.' },
    available: { control: 'boolean', description: 'False when the plan or pack has nothing to customise: no button. Default true.' },
    setCustomise: { control: false },
    goNext: { control: false },
  },
  args: { productId: 'PROD-111', preBundled: false, available: true, setCustomise: fn(), goNext: fn() },
} satisfies Meta<typeof CustomiseAddonsAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** Renders nothing: the plan is pre-bundled. */
export const PreBundledNoButton: Story = { args: { preBundled: true } };
/** Renders nothing: nothing to customise. */
export const UnavailableNoButton: Story = { args: { available: false } };
/** Renders nothing: no plan chosen. */
export const NoPlanNoButton: Story = { args: { productId: undefined } };

export const SetsFlagThenGoesNext: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Customise Add-ons' }));
    await expect(args.setCustomise).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(args.goNext).toHaveBeenCalledTimes(1));
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole('button', { name: 'Customise Add-ons' })).toHaveFocus();
  },
};
