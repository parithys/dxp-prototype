import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { PrepaidPlanCard } from '../../src/components/patterns/PrepaidPlanCard';
import { PrepaidPackDetailsDrawer } from '../../src/components/patterns/PrepaidPackDetailsDrawer';
import type { PrepaidPlan } from '../../src/components/patterns/prepaidPlanModel';
import { docsParameters } from '../_shared/docs';
import { Row, Specimen } from '../_shared/layout';
import { PREPAID_PACKS, PREPAID_PREMIUM_150, PREPAID_RED_25, PREPAID_RED_50, PREPAID_STANDARD_SIM } from './_fixtures';

type CardProps = Parameters<typeof PrepaidPlanCard>[0];

function Demo(props: CardProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(props.selectedProductId);
  const [detail, setDetail] = useState<PrepaidPlan | null>(null);
  return (
    <div style={{ maxWidth: 340 }}>
      <PrepaidPlanCard
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
        setDetailPack={(pack) => {
          props.setDetailPack(pack);
          setDetail(pack);
        }}
      />
      <PrepaidPackDetailsDrawer pack={detail} onClose={() => setDetail(null)} selectedProductId={selectedId} onSelectProduct={setSelectedId} />
    </div>
  );
}

const meta = {
  title: 'Business Components/Prepaid Plan Card',
  component: PrepaidPlanCard,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'One prepaid starter pack on the Prepaid Plan step: the same card as a postpaid plan - Popular flag and Prepaid tag on top, name, starter-pack price, data / minutes / validity rows, View details. The whole card selects; clicking again unselects.',
      source: 'src/components/patterns/PrepaidPlanCard.tsx',
      variants: ['Popular pack (flag shown) and ordinary pack (an invisible spacer keeps cards aligned).', 'Pay-as-you-go SIM (no data bundle, no validity) - the zero-cost baseline pack.'],
      states: ['Unselected, Selected (red border, corner tick), Hover (background only), Focus-visible.'],
      events: ['`onSelectProduct(productId)`; `onDeselectProduct()` on the selected card (when given); `setDetailPack(pack)` from View details (never selects).'],
      usage: ['Packs are offered in this order: cheapest first, Popular first (`offeredPrepaidPacks`); a pack with `eligibleSegments` shows only to those segments.'],
      accessibility: ['`role="button"`, `tabIndex=0`, `aria-pressed`; Enter / Space on the focused card toggle it. View details has an `aria-label` naming the pack.'],
      devices: ['tablet.css adds no card sizing, only `touch-action: manipulation` and no tap highlight on `[role=button]` and buttons.'],
    }),
  },
  argTypes: {
    p: { control: 'object', description: 'The catalogue pack (PrepaidPlan).' },
    selectedProductId: { control: 'text', description: 'The selected pack\'s productId.' },
    onSelectProduct: { control: false },
    onDeselectProduct: { control: false },
    setDetailPack: { control: false },
  },
  args: { p: PREPAID_RED_50, selectedProductId: undefined, onSelectProduct: fn(), onDeselectProduct: fn(), setDetailPack: fn() },
} satisfies Meta<typeof PrepaidPlanCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = { args: { selectedProductId: PREPAID_RED_50.productId } };

export const NotPopular: Story = { args: { p: PREPAID_RED_25 } };

export const PayAsYouGoSim: Story = { args: { p: PREPAID_STANDARD_SIM } };

export const PremiumSegmentPack: Story = { args: { p: PREPAID_PREMIUM_150 } };

export const AllPacks: Story = {
  render: (args) => (
    <Row>
      {PREPAID_PACKS.map((p) => (
        <Specimen key={p.productId} label={p.productId}>
          <Demo {...args} p={p} selectedProductId={p.productId === PREPAID_RED_50.productId ? p.productId : undefined} />
        </Specimen>
      ))}
    </Row>
  ),
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(canvasElement.querySelector('[aria-pressed]') as HTMLElement);
  },
};

export const SelectAndDeselect: Story = {
  play: async ({ canvasElement, args }) => {
    const card = canvasElement.querySelector('[aria-pressed]') as HTMLElement;
    await userEvent.click(card);
    await expect(args.onSelectProduct).toHaveBeenCalledWith('PROD-302');
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(card);
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
  },
};

export const OpenDetailsThenSelectPack: Story = {
  play: async ({ canvasElement, args }) => {
    const card = canvasElement.querySelector('[aria-pressed]') as HTMLElement;
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'View details for Prepaid Red 50' }));
    await expect(args.setDetailPack).toHaveBeenCalled();
    await expect(card).toHaveAttribute('aria-pressed', 'false');
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Select pack' }));
    await expect(args.onSelectProduct).not.toHaveBeenCalledWith('PROD-301');
    await expect(card).toHaveAttribute('aria-pressed', 'true');
  },
};
