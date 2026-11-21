import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { DiscountCard } from '../../src/components/patterns/DiscountCard';
import { docsParameters } from '../_shared/docs';
import { Row, Specimen } from '../_shared/layout';

type CardProps = Parameters<typeof DiscountCard>[0];

function Demo(props: CardProps) {
  const [selected, setSelected] = useState(props.selected);
  return (
    <div style={{ maxWidth: 320 }}>
      <DiscountCard
        {...props}
        selected={selected}
        onToggle={() => {
          props.onToggle();
          setSelected((s) => !s);
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Business Components/Discount Card',
  component: DiscountCard,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'One choice in the Eligible Discounts tab of Offers & Plans, on the shared selectable-card standard: the discount\'s name on the left, its rate on the right (green), the catalogue\'s own description beneath. "No Discount" shows "-" in muted text.',
      source: 'src/components/patterns/DiscountCard.tsx',
      variants: ['A discount (value "10%", green) and "No Discount" (value "-", muted).', 'Description is optional.'],
      states: ['Unselected (`card-idle`), Selected (red border, corner tick and the faint concentric texture), Hover (background only), Focus-visible.'],
      events: ['`onToggle()` - card click, Enter or Space on the focused card. The card holds no state; the panel decides what a toggle means (choosing the selected card changes nothing there).'],
      accessibility: ['`role="button"` with `tabIndex=0` and `aria-pressed`; Enter and Space only when the card itself has focus.'],
      devices: ['tablet.css adds no card sizing, only `touch-action: manipulation` and no tap highlight on `[role=button]`.'],
    }),
  },
  argTypes: {
    title: { control: 'text', description: 'The discount\'s name.' },
    description: { control: 'text', description: 'The catalogue wording, then how long it runs.' },
    value: { control: 'text', description: 'The rate shown on the right ("-" for No Discount).' },
    selected: { control: 'boolean', description: 'Whether this is the chosen discount.' },
    onToggle: { control: false },
  },
  args: { title: '10% Discount', description: '10% off the monthly plan fee for 6 months', value: '10%', selected: false, onToggle: fn() },
} satisfies Meta<typeof DiscountCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = { args: { selected: true } };

export const NoDiscount: Story = { args: { title: 'No Discount', description: 'Continue without a discount', value: '-' } };

export const WithoutDescription: Story = { args: { description: undefined } };

export const SpecialDiscount: Story = { args: { title: 'Special Discount 25%', description: 'MADA cardholders receive a 25% discount on the plan rental every month.', value: '25%', selected: true } };

export const AllStates: Story = {
  render: (args) => (
    <Row>
      <Specimen label="Unselected">
        <Demo {...args} />
      </Specimen>
      <Specimen label="Selected">
        <Demo {...args} selected />
      </Specimen>
      <Specimen label="No Discount">
        <Demo {...args} title="No Discount" description="Continue without a discount" value="-" />
      </Specimen>
    </Row>
  ),
};

export const Hover: Story = { play: async ({ canvasElement }) => void (await userEvent.hover(canvasElement.querySelector('[aria-pressed]') as HTMLElement)) };

export const Toggle: Story = {
  play: async ({ canvasElement, args }) => {
    const card = canvasElement.querySelector('[aria-pressed]') as HTMLElement;
    await userEvent.click(card);
    await expect(args.onToggle).toHaveBeenCalledTimes(1);
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(card);
    await expect(card).toHaveAttribute('aria-pressed', 'false');
  },
};

export const KeyboardToggle: Story = {
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
