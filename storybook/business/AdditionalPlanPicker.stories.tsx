import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { AdditionalPlanPicker } from '../../src/capabilities/PlanSelection/AdditionalPlanPicker';
import { docsParameters } from '../_shared/docs';
import { AHLI_MEMBER, ESSENTIAL, UNLIMITED } from './_fixtures';

type Props = Parameters<typeof AdditionalPlanPicker>[0];

function Host(args: Props) {
  const [selected, setSelected] = useState<string | undefined>(args.selectedProductId);
  return (
    <AdditionalPlanPicker
      {...args}
      selectedProductId={selected}
      onSelect={(id) => {
        setSelected(id);
        args.onSelect(id);
      }}
      onDeselect={() => {
        setSelected(undefined);
        args.onDeselect();
      }}
    />
  );
}

const meta = {
  title: 'Business Components/Additional Plan Picker',
  component: AdditionalPlanPicker,
  parameters: {
    ...docsParameters({
      purpose: 'The plans an additional Family connection can be on, as the same Postpaid Plan Cards the rest of Offers & Plans uses, with View details. The agent picks the plan; the line\'s type follows from it (the engine derives it - nothing here says Supplementary or Secondary).',
      source: 'src/capabilities/PlanSelection/AdditionalPlanPicker.tsx',
      states: ['Nothing selected', 'A plan selected', 'Details drawer open (View details)'],
      events: ['`onSelect(productId)` - card click, Enter or Space on an unselected card, or Select Plan in the details drawer.', '`onDeselect()` - the same gesture on the selected card.'],
      usage: ['Which plans are listed is the package\'s remaining entitlement (`engines/familyPackage.ts`, `eligibleAdditionalPlans`): the caller passes `plans`. A Kids or Data-only Secondary plan carries its own type tag (from `secondaryPlanType` on the plan record). The plans here are real catalogue records from `business/_fixtures.ts`.'],
      accessibility: ['Each card is a `role="button"` with `aria-pressed`; "View details for <plan>" opens the shared Drawer and does not select.'],
    }),
  },
  argTypes: { plans: { control: false }, selectedProductId: { control: 'select', options: [undefined, ESSENTIAL.productId, UNLIMITED.productId, AHLI_MEMBER.productId], description: 'The chosen plan\'s product id.' }, onSelect: { control: false }, onDeselect: { control: false } },
  args: { plans: [ESSENTIAL, UNLIMITED, AHLI_MEMBER], selectedProductId: undefined, onSelect: fn(), onDeselect: fn() },
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof AdditionalPlanPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const PlanSelected: Story = { args: { selectedProductId: UNLIMITED.productId } };
export const SinglePlanLeft: Story = { args: { plans: [ESSENTIAL] } };
export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } };

export const SelectAndDeselect: Story = {
  play: async ({ canvasElement, args }) => {
    const card = within(canvasElement).getByRole('button', { name: /Postpaid Essential/, pressed: false });
    await userEvent.click(card);
    await expect(args.onSelect).toHaveBeenCalledWith('PROD-107');
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(card);
    await expect(args.onDeselect).toHaveBeenCalled();
  },
};

export const ViewDetails: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'View details for Postpaid Essential' }));
    await expect(await screen.findByRole('dialog')).toBeVisible();
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};
