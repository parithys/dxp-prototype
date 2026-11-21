import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { PostpaidPlanCard } from '../../src/components/patterns/PostpaidPlanCard';
import { PlanDetailsDrawer } from '../../src/components/patterns/PlanDetailsDrawer';
import type { PostpaidPlan } from '../../src/components/patterns/postpaidPlanModel';
import { docsParameters } from '../_shared/docs';
import { Column, Specimen } from '../_shared/layout';
import { AHLI_MEMBER, ESSENTIAL, PLATINUM, PRE_BUNDLED, UNLIMITED } from './_fixtures';

type CardProps = Parameters<typeof PostpaidPlanCard>[0];

/** The card as a plan step holds it: the selection is local state, "View details" opens the real details drawer. */
function Demo(props: CardProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(props.selectedProductId);
  const [detail, setDetail] = useState<PostpaidPlan | null>(null);
  return (
    <div style={{ maxWidth: 380 }}>
      <PostpaidPlanCard
        {...props}
        selectedProductId={selectedId}
        onSelectProduct={(id) => {
          props.onSelectProduct(id);
          setSelectedId(id);
        }}
        onDeselectProduct={() => {
          props.onDeselectProduct?.();
          setSelectedId(undefined);
        }}
        setDetailPlan={(plan) => {
          props.setDetailPlan(plan);
          setDetail(plan);
        }}
      />
      <PlanDetailsDrawer detailPlan={detail} onClose={() => setDetail(null)} selectedProductId={selectedId} onSelectProduct={setSelectedId} showPlanDetails />
    </div>
  );
}

const meta = {
  title: 'Business Components/Postpaid Plan Card',
  component: PostpaidPlanCard,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'One postpaid plan on the Plan & Add-ons step: name, price block, the plan\'s facts as icon rows, the bill limit and a View details link. The whole card is the selection control - there is no Select button.',
      source: 'src/components/patterns/PostpaidPlanCard.tsx',
      variants: [
        'Full card (default): Popular flag, plan-type tag, price, up to all fact rows, "Included in This Offer" block when the plan has both `features` and `benefits`.',
        '`compact`: the short card of the Offers tab - name, price, one headline line, View details.',
        '`discountPct`: shows the discounted monthly price with the plan\'s own price struck through (a promotion price is struck through the same way).',
        '`displayName` / `tagType`: Special Offers rename the plan after the customer\'s Special Discount; a Secondary plan shows its own type tag.',
        'Pre-bundled plans carry a note that selecting skips add-ons and discount.',
      ],
      states: ['Unselected (`card-idle`) and Selected (`card-selected`, red border, corner tick). Hover changes the background only.', 'The bill limit row shows the plan\'s MRC until the card is selected, then `billLimit` when the agent has set one.'],
      events: ['`onSelectProduct(productId)` - card click, Enter or Space on an unselected card.', '`onDeselectProduct()` - the same gesture on the selected card (only when the prop is given; otherwise it re-selects).', '`setDetailPlan(plan)` - View details; stops propagation, so looking never selects.'],
      usage: ['Use inside `PlanGroupPanel`, which lays the cards out in the responsive grid. Selection state lives in the step, never in the card.'],
      accessibility: ['The card is `role="button"` with `tabIndex=0` and `aria-pressed` carrying the selection; Enter and Space toggle it (only when the card itself has focus, so the View details button keeps its own keys).', 'View details has an `aria-label` naming the plan. The Popular flag is `aria-hidden` when absent (an invisible spacer keeps the cards aligned).', 'The selected state is a border, a tick and a fill - not colour alone.'],
      devices: ['tablet.css adds no card sizing: it only sets `touch-action: manipulation` and removes the tap highlight on `[role=button]` and buttons. The card layout is the same on Web and Tablet; use the toolbar Device switch to confirm.'],
    }),
  },
  argTypes: {
    p: { control: 'object', description: 'The catalogue plan (PostpaidPlan).' },
    selectedProductId: { control: 'text', description: 'The productId currently selected in the step; the card is selected when it equals `p.productId`.' },
    billLimit: { control: 'number', description: 'The agent\'s own bill limit, shown on the selected card only.' },
    compact: { control: 'boolean', description: 'The short Offers-tab card.' },
    discountPct: { control: { type: 'number', min: 0, max: 1, step: 0.05 }, description: 'Discount as a fraction (0.25 = 25%).' },
    displayName: { control: 'text', description: 'Name to show when it differs from the plan\'s own.' },
    tagType: { control: 'select', options: [undefined, 'postpaid-kids', 'postpaid-data-only', 'postpaid-secondary', 'postpaid-family'], description: 'A plan-type tag shown in place of the plan class tag.' },
    onSelectProduct: { control: false },
    onDeselectProduct: { control: false },
    setDetailPlan: { control: false },
  },
  args: { p: ESSENTIAL, selectedProductId: undefined, billLimit: undefined, onSelectProduct: fn(), onDeselectProduct: fn(), setDetailPlan: fn() },
} satisfies Meta<typeof PostpaidPlanCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = { args: { selectedProductId: ESSENTIAL.productId, billLimit: 200 } };

export const Compact: Story = { args: { compact: true } };

export const Discounted: Story = { args: { p: PLATINUM, discountPct: 0.25, selectedProductId: PLATINUM.productId } };

export const UnlimitedData: Story = { args: { p: UNLIMITED } };

export const FamilyPlan: Story = { args: { p: AHLI_MEMBER } };

export const PreBundledOffer: Story = { args: { p: PRE_BUNDLED } };

export const SpecialOfferName: Story = { args: { p: UNLIMITED, compact: true, displayName: 'Special Offer - Postpaid Unlimited', discountPct: 0.25 } };

export const AllStates: Story = {
  render: (args) => (
    <Column>
      <Specimen label="Unselected, Popular, promotional price">
        <Demo {...args} p={ESSENTIAL} />
      </Specimen>
      <Specimen label="Selected with the agent's bill limit">
        <Demo {...args} p={ESSENTIAL} selectedProductId={ESSENTIAL.productId} billLimit={200} />
      </Specimen>
      <Specimen label="Compact (Offers tab)">
        <Demo {...args} p={ESSENTIAL} compact />
      </Specimen>
    </Column>
  ),
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(canvasElement.querySelector('[role="button"][aria-pressed]') as HTMLElement);
  },
};

export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  },
};

export const SelectAndDeselect: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const card = canvasElement.querySelector('[aria-pressed]') as HTMLElement;
    await expect(card).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(card);
    await expect(args.onSelectProduct).toHaveBeenCalledWith('PROD-107');
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByText(/Bill limit: QAR/)).toBeInTheDocument();
    await userEvent.click(card);
    await expect(args.onDeselectProduct).toHaveBeenCalled();
    await expect(card).toHaveAttribute('aria-pressed', 'false');
  },
};

export const KeyboardSelect: Story = {
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector('[aria-pressed]') as HTMLElement;
    await userEvent.tab();
    await expect(card).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard(' ');
    await expect(card).toHaveAttribute('aria-pressed', 'false');
  },
};

export const ViewDetailsDoesNotSelect: Story = {
  play: async ({ canvasElement, args }) => {
    const card = canvasElement.querySelector('[aria-pressed]') as HTMLElement;
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'View details for Postpaid Essential' }));
    await expect(args.setDetailPlan).toHaveBeenCalled();
    await expect(card).toHaveAttribute('aria-pressed', 'false');
    await expect(await screen.findByRole('dialog')).toBeInTheDocument();
  },
};

export const Tablet: Story = {
  parameters: { viewport: { defaultViewport: 'tablet' } },
};
