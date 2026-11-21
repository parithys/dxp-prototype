import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PlanSearchBox } from '../../src/components/patterns/PlanSearchBox';
import { searchPlans } from '../../src/components/patterns/postpaidPlanModel';
import { docsParameters } from '../_shared/docs';
import { POSTPAID_PLANS } from './_fixtures';

type BoxProps = Parameters<typeof PlanSearchBox>[0];

/** The box as the plan step holds it: the typed text, the open flag and the suggestions from the step's own searchPlans. */
function Demo(props: Partial<BoxProps>) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(props.planSearch ?? '');
  const [selected, setSelected] = useState<string | undefined>(props.selectedProductId);
  return (
    <div style={{ maxWidth: 480 }} className="stack gap-3">
      <PlanSearchBox
        searchRef={ref}
        searchOpen={open}
        setSearchOpen={setOpen}
        planSearch={text}
        setPlanSearch={setText}
        suggestions={searchPlans(text, POSTPAID_PLANS)}
        selectedProductId={selected}
        onSelectProduct={(id) => {
          props.onSelectProduct?.(id);
          setSelected(id);
        }}
        scopeLabel={props.scopeLabel}
      />
      <p className="caption-muted">Selected plan: {POSTPAID_PLANS.find((p) => p.productId === selected)?.name ?? 'none'}</p>
    </div>
  );
}

const meta = {
  title: 'Business Components/Plan Search Box',
  component: PlanSearchBox,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'The type-ahead search above the plan grid. Every word typed must appear somewhere in what a plan shows (name, price, allowances, benefits - `planMatchesSearch`); with no hit, the closest names by edit distance are suggested.',
      source: 'src/components/patterns/PlanSearchBox.tsx',
      states: ['Empty (no list); Typing (suggestion list open); No match ("No matching plans." - only reachable when the list is empty); Active option (arrow keys).'],
      events: ['`setPlanSearch(text)` on every keystroke; `setSearchOpen(true)` on focus/typing.', '`onSelectProduct(productId)` on choosing a suggestion (Enter or click); `onPickResult(plan)` replaces that default (the step then also scrolls to the card).', 'Escape clears the text and closes the list.'],
      usage: ['The component is controlled: the step owns the text, the open flag and the suggestions (`searchPlans(query, plans)`).'],
      accessibility: ['An ARIA combobox: `role="combobox"`, `aria-expanded`, `aria-controls` the listbox; options are `role="option"` with `aria-selected`; ArrowUp / ArrowDown move the active option, Enter chooses (`useSearchListNav`).', 'The input\'s `aria-label` and placeholder name the scope ("Search plans by name, price or benefits").'],
    }),
  },
  argTypes: {
    scopeLabel: { control: 'text', description: 'The tab the search is scoped to; shown in the label and placeholder.' },
    planSearch: { control: false },
    suggestions: { control: false },
    searchRef: { control: false },
    setSearchOpen: { control: false },
    setPlanSearch: { control: false },
    onSelectProduct: { control: false },
    onPickResult: { control: false },
  },
  args: { onSelectProduct: fn() },
} satisfies Meta<typeof PlanSearchBox>;
export default meta;
type Story = StoryObj<typeof PlanSearchBox>;

export const Default: Story = {};

export const ScopedToATab: Story = { args: { scopeLabel: 'Offers' } };

export const SearchByPriceAndPick: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('combobox');
    await userEvent.type(field, '115');
    const options = await canvas.findAllByRole('option');
    await expect(options.length).toBeGreaterThan(0);
    await userEvent.click(options[0]);
    await expect(args.onSelectProduct).toHaveBeenCalled();
    await expect(canvas.queryByRole('listbox')).toBeNull();
  },
};

export const ClosestNameForATypo: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox'), 'Postpaid Essentail');
    await expect((await canvas.findAllByRole('option')).length).toBeGreaterThan(0);
  },
};

export const KeyboardNavigation: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('combobox');
    await userEvent.type(field, 'postpaid');
    await expect(field).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(args.onSelectProduct).toHaveBeenCalled();
  },
};

export const EscapeClears: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('combobox');
    await userEvent.type(field, 'unlimited');
    await userEvent.keyboard('{Escape}');
    await expect(field).toHaveValue('');
    await expect(canvas.queryByRole('listbox')).toBeNull();
  },
};
