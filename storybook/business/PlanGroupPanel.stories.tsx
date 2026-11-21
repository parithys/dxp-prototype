import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PlanGroupPanel } from '../../src/components/patterns/PlanGroupPanel';
import { planGroupOf } from '../../src/components/patterns/postpaidPlanModel';
import type { PlanGroupKey, PostpaidPlan } from '../../src/components/patterns/postpaidPlanModel';
import { docsParameters } from '../_shared/docs';
import { POSTPAID_PLANS } from './_fixtures';

type PanelProps = Parameters<typeof PlanGroupPanel>[0];

/** What the plan step passes: the plans of a group, the same grouping rule the step uses (planGroupOf). 'special' lists the plans carrying the Special Discount. */
const groupOf = (plans: PostpaidPlan[]) => (key: PlanGroupKey) => (key === 'special' ? plans.filter((p) => p.mrcQAR <= 150) : plans.filter((p) => planGroupOf(p) === key));

function Demo(props: PanelProps) {
  const [selected, setSelected] = useState<string | undefined>(props.selectedProductId);
  return (
    <PlanGroupPanel
      {...props}
      selectedProductId={selected}
      onSelectProduct={(id) => {
        props.onSelectProduct(id);
        setSelected(id);
      }}
      onDeselectProduct={() => setSelected(undefined)}
    />
  );
}

const meta = {
  title: 'Business Components/Plan Group Panel',
  component: PlanGroupPanel,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'The grid of postpaid plan cards under one tab of Offers & Plans (Offers, Standard Plans, Standard BAU Catalogue, Special Offers). It decides which card form each tab uses and when a discount shows.',
      source: 'src/components/patterns/PlanGroupPanel.tsx',
      variants: [
        '`activeTab="specials"` (Offers): compact cards.',
        '`activeTab="for-you"` / `"standard"`: full cards; a discount shows only on the chosen plan (`discountPct`).',
        '`activeTab="special"` (Special Offers): every card shows the 25% Special Discount price and is renamed through `specialDiscountType` (MADA, Consumer B2B2C, Retiree).',
      ],
      states: ['Populated grid; Empty ("No plans match that search or filter."); one card Selected.'],
      events: ['`onSelectProduct`, `onDeselectProduct`, `setDetailPlan` are passed straight to each `PostpaidPlanCard`.'],
      usage: ['`groupPlans(key)` is the step\'s own grouping (from `planGroupOf`) after search and plan-type filtering; the panel never filters.'],
      accessibility: ['Each card is a `role="button"` with `aria-pressed`; the grid is auto-fill, so keyboard order follows reading order. The empty message is plain text.'],
      devices: ['The grid is `auto-fill` with a 15rem minimum, three columns at desktop width; narrower viewports (Tablet, Mobile stories) drop to fewer columns.'],
    }),
  },
  argTypes: {
    activeTab: { control: 'select', options: ['specials', 'for-you', 'standard', 'special'], description: 'The tab whose group is shown.' },
    specialDiscountType: { control: 'select', options: [undefined, 'mada', 'b2b2c', 'retired', 'none'], description: 'The customer\'s validated Special Discount (names plans on the Special Offers tab).' },
    discountPct: { control: { type: 'number', min: 0, max: 1, step: 0.05 }, description: 'The chosen plan\'s applied discount (fraction).' },
    selectedProductId: { control: 'text', description: 'The selected plan\'s productId.' },
    billLimit: { control: 'number', description: 'The agent\'s own bill limit for the selected plan.' },
    groupPlans: { control: false },
    onSelectProduct: { control: false },
    onDeselectProduct: { control: false },
    setDetailPlan: { control: false },
  },
  args: { groupPlans: groupOf(POSTPAID_PLANS), activeTab: 'specials', selectedProductId: undefined, billLimit: undefined, onSelectProduct: fn(), onDeselectProduct: fn(), setDetailPlan: fn() },
} satisfies Meta<typeof PlanGroupPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const StandardPlans: Story = { args: { activeTab: 'for-you', selectedProductId: 'PROD-113', discountPct: 0.25 } };

export const SpecialOffers: Story = { args: { activeTab: 'special', specialDiscountType: 'retired' } };

export const Empty: Story = { args: { groupPlans: () => [] } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } };

export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } };

export const SelectOneOfMany: Story = {
  args: { activeTab: 'for-you' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const cards = canvas.getAllByRole('button', { pressed: false }).filter((el: HTMLElement) => el.id.startsWith('plan-card-'));
    await expect(cards.length).toBeGreaterThan(1);
    await userEvent.click(cards[0]);
    await expect(args.onSelectProduct).toHaveBeenCalled();
    await expect(cards[0]).toHaveAttribute('aria-pressed', 'true');
    await expect(canvasElement.querySelectorAll('[id^="plan-card-"][aria-pressed="true"]').length).toBe(1);
  },
};
