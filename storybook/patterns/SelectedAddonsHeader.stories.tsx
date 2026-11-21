import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { SelectedAddonsHeader } from '../../src/components/patterns/wizard/SelectedAddonsHeader';
import { docsParameters } from '../_shared/docs';

type Props = Parameters<typeof SelectedAddonsHeader>[0];

/** The tray as an Addons step holds it: the selection is the step's value. */
function Demo(props: Props) {
  const [ids, setIds] = useState(props.selectedIds);
  return (
    <div style={{ minHeight: 420, maxWidth: 360 }}>
      <SelectedAddonsHeader
        {...props}
        selectedIds={ids}
        onChange={(next) => {
          props.onChange(next);
          setIds(next);
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Patterns/Selected Add-Ons Header',
  component: SelectedAddonsHeader,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'The Selected Add-Ons tray of an Addons step: a button showing the count and the total, opening a panel that lists each selected add-on with its price and billing cadence, a remove control, and the total. Postpaid add-ons are monthly; a prepaid pack\'s are one-off. Mounted by the wizard for a step that sets `addonsTray`.',
      source: 'src/components/patterns/wizard/SelectedAddonsHeader.tsx',
      variants: ['`source="catalogue"` (postpaid, default): add-ons from the product catalogue, "Monthly Add-Ons" total, "Excludes the base plan."', '`source="prepaid"`: a pack\'s add-ons (`addons-discounts`), "One-Off Add-Ons" total, "Add-ons are charged once, with the order."; a mandatory add-on has no remove control.', '`variant="header"`: top-right of the step card, panel dropping down (desktop). `"floating"` (default): fixed to the bottom of a small screen, panel rising up.', '`appliedDiscounts`: each add-on is listed and totalled after its discount.'],
      states: ['No add-ons selected ("No add-ons selected.")', 'Selected', 'Panel closed / open'],
      events: ['`onChange(ids)` when an add-on is removed from the panel.'],
      accessibility: ['The toggle has `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls`; the panel is a `role="dialog"` named "Selected Add-Ons". Escape closes it and returns focus to the toggle; a mouse press outside closes it. Remove buttons are named "Remove {add-on}".'],
      devices: ['Desktop uses the `header` variant; small screens use `floating` (fixed to the viewport bottom, so it floats within the preview frame here).'],
      restrictions: ['Reads the add-on catalogue through the API layer, so the preview boots the app first; ids that are not in the catalogue (or are unavailable) are not listed.'],
    }),
  },
  argTypes: {
    selectedIds: { control: 'object', description: 'Ids of the selected add-ons (product ids, or pack add-on ids for prepaid).' },
    selectedBilling: { control: 'object', description: 'Billing frequency chosen per add-on id.' },
    variant: { control: 'select', options: ['floating', 'header'], description: 'Where the tray sits.' },
    source: { control: 'select', options: ['catalogue', 'prepaid'], description: 'Postpaid catalogue or a prepaid pack\'s add-ons.' },
    appliedDiscounts: { control: 'object', description: 'add-on product id -> discount id.' },
    onChange: { control: false },
  },
  args: { selectedIds: ['PROD-160', 'PROD-165'], selectedBilling: {}, variant: 'header', source: 'catalogue', onChange: fn() },
} satisfies Meta<typeof SelectedAddonsHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

const toggle = (root: HTMLElement) => within(root).getByRole('button', { name: /add-ons/ });

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(toggle(canvasElement)).toHaveTextContent('2 add-ons'));
    await userEvent.click(toggle(canvasElement));
    const panel = await within(canvasElement).findByRole('dialog', { name: 'Selected Add-Ons' });
    await expect(within(panel).getByText('Monthly Add-Ons')).toBeVisible();
  },
};

export const Floating: Story = { args: { variant: 'floating' }, parameters: { viewport: { defaultViewport: 'mobile' } } };

export const NothingSelected: Story = {
  args: { selectedIds: [] },
  play: async ({ canvasElement }) => {
    await userEvent.click(toggle(canvasElement));
    await expect(await within(canvasElement).findByText('No add-ons selected.')).toBeVisible();
  },
};

export const PrepaidPack: Story = {
  args: { source: 'prepaid', selectedIds: ['ADO-9301', 'ADO-9302'] },
  play: async ({ canvasElement }) => {
    // The count is 0 until the pack add-ons have loaded.
    await waitFor(() => expect(toggle(canvasElement)).toHaveTextContent('2 add-ons'));
    await userEvent.click(toggle(canvasElement));
    const panel = await within(canvasElement).findByRole('dialog', { name: 'Selected Add-Ons' });
    await expect(within(panel).getByText('One-Off Add-Ons')).toBeVisible();
    // The mandatory pack add-on cannot be removed; the optional one can.
    await expect(within(panel).getByRole('button', { name: /Remove Data Booster 5GB/ })).toBeVisible();
    await expect(within(panel).queryByRole('button', { name: /Remove Prepaid Welcome Voice Pack/ })).toBeNull();
  },
};

export const RemoveAnAddon: Story = {
  play: async ({ canvasElement, args }) => {
    await waitFor(() => expect(toggle(canvasElement)).toHaveTextContent('2 add-ons'));
    await userEvent.click(toggle(canvasElement));
    const panel = await within(canvasElement).findByRole('dialog', { name: 'Selected Add-Ons' });
    await userEvent.click(within(panel).getAllByRole('button', { name: /^Remove / })[0]);
    await expect(args.onChange).toHaveBeenCalledWith(['PROD-165']);
    await waitFor(() => expect(toggle(canvasElement)).toHaveTextContent('1 add-ons'));
  },
};

export const EscapeClosesAndReturnsFocus: Story = {
  play: async ({ canvasElement }) => {
    const button = toggle(canvasElement);
    await userEvent.click(button);
    await within(canvasElement).findByRole('dialog', { name: 'Selected Add-Ons' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(canvasElement).queryByRole('dialog')).toBeNull());
    await expect(button).toHaveFocus();
  },
};
