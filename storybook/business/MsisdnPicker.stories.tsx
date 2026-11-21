import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { MsisdnPicker } from '../../src/components/domain/MsisdnPicker';
import type { NumberPickerProfile } from '../../src/components/domain/msisdnPickerModel';
import { docsParameters } from '../_shared/docs';

type PickerProps = Parameters<typeof MsisdnPicker>[0];

/** The picker as a number step holds it: the chosen number is local state; selecting again clears it (the journeys pass `onDeselect`). */
function Demo(props: PickerProps) {
  const [selected, setSelected] = useState<string | undefined>(props.selected);
  return (
    <div style={{ maxWidth: 860 }}>
      <MsisdnPicker
        {...props}
        selected={selected}
        onSelect={(msisdn, price) => {
          props.onSelect(msisdn, price);
          setSelected(msisdn);
        }}
        onDeselect={() => {
          props.onDeselect?.();
          setSelected(undefined);
        }}
      />
    </div>
  );
}

/** What New Prepaid passes: no sorting, no Star lock-in, no pack entitlement (a prepaid pack carries none). */
const PREPAID_PROFILE: NumberPickerProfile = { sorting: false, lockIn: false, planEntitlement: false };
/** What New Prepaid passes for a role that may sell Free numbers only (Mass Market). */
const FREE_ONLY_PROFILE: NumberPickerProfile = { ...PREPAID_PROFILE, tabsFor: () => ['Free'] };

const meta = {
  title: 'Business Components/Number Picker',
  component: MsisdnPicker,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'Number Selection: the agent\'s inventory of mobile numbers as tabs (Star, Free, Reserved, Blocked), a "search by" dropdown with a search box (All, Price range, Starts With, Ends With, Contains, XXYY Pattern), a price sort and pages of selectable number cards. Reads the live number inventory (`numbers`) and Star tiers; the chosen number is the journey\'s.',
      source: 'src/components/domain/MsisdnPicker.tsx (+ msisdnPickerModel.ts, StarStat.tsx)',
      variants: [
        'Free tab: compact cards, number only (numbers priced under QAR 1,500 are free of charge). Star tab: cards with Price, Lock-In Period and - with a plan - Amount to Pay (only the part above the plan\'s Star entitlement, BR-115).',
        'Reserved tab: this customer\'s holds (matched by `customerIdNumber`, newest first, at most 2) with a Reserved timestamp; `portalMode` lists only numbers reserved in this session and adds Unreserve (`onUnreserve`).',
        'Blocked tab: nothing is listed until the agent searches; then only the numbers the agent\'s OWN group blocked appear (never another group\'s), with Blocked By and Blocked Reason, and they are selectable like any number.',
        '`profile` (NumberPickerProfile): New Prepaid hides sorting, lock-in and the plan entitlement; a role can be limited to Free numbers only (`tabsFor`).',
      ],
      states: ['Loading (no tabs until the inventory is read); Populated; Selected card (red border, tick, texture); Empty per tab (messages differ: no reserved numbers, no match for the search, "Search by number, tier or price to find the numbers your group has blocked."); Validation error under the search box; Searching...'],
      events: ['`onSelect(msisdn, priceQAR)` - priceQAR is what is charged (0 for any number under QAR 1,500).', '`onDeselect()` - selecting the chosen card again, when given. In portal mode switching tab clears the selection.', '`onUnreserve(msisdn)` - portal Reserved tab.', '`refreshKey` - reads the inventory again and shows a "Number list refreshed" toast.'],
      usage: ['The Number Selection capability wraps this (`capabilities/NumberSelection`); journeys pass the plan\'s MRC (`planMrcQar`) or its own entitlement limit (`starEntitlementQar`).'],
      validation: ['Starts With / Ends With / Contains accept digits only; XXYY needs repeating pairs (3344, 77224455); Min Price above Max Price is an alert. Search starts after 2 characters and is debounced 300 ms.'],
      accessibility: ['Tabs are the app\'s tab strip (arrow keys, Home / End). Each number card is a `role="button"` with `aria-pressed`; Blocked cards are named "Blocked number NNNNNNNN". The search box and "Search by", "Sort numbers" have labels; the hint under the search box is a live region (`role="status"`, `role="alert"` for an error). The price sort is one icon toggle whose label names the current order and the other one.'],
      devices: ['Columns are `auto-fill` from the width of the panel the picker sits in; tablet.css adds touch-action only.'],
      restrictions: ['The Blocked tab depends on the signed-in role\'s group: the Storybook preview signs in as Retail Sales, so the numbers blocked by "Retail Sales" are the ones that can be found.'],
    }),
  },
  argTypes: {
    selected: { control: 'text', description: 'The chosen number (E.164, e.g. +97477778888).' },
    refreshKey: { control: 'number', description: 'Change to re-read the inventory.' },
    waiverQar: { control: 'number', description: 'Additional discount applied to the SELECTED number\'s upfront charge.' },
    planMrcQar: { control: 'number', description: 'The selected plan\'s MRC: sets the Star entitlement (x25, rounded to 500) and the Amount to Pay.' },
    starEntitlementQar: { control: 'number', description: 'The plan\'s own Star entitlement limit; derived from `planMrcQar` when omitted.' },
    portalMode: { control: 'boolean', description: 'The Number Management Portal: Star, Free, Reserved tabs; Reserved lists numbers reserved in this session.' },
    reservedHere: { control: 'object', description: 'Portal only: the numbers reserved in this session.' },
    customerIdNumber: { control: 'text', description: 'The customer\'s ID number: the Reserved tab lists the holds placed for it.' },
    profile: { control: 'object', description: 'NumberPickerProfile: tabsFor, sorting, lockIn, planEntitlement.' },
    onSelect: { control: false },
    onDeselect: { control: false },
    onUnreserve: { control: false },
  },
  args: { onSelect: fn(), onDeselect: fn() },
} satisfies Meta<typeof MsisdnPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

const firstCard = async (canvasElement: HTMLElement) => (await within(canvasElement).findAllByRole('button', { pressed: false }))[0];

export const Default: Story = {};

export const WithPlanEntitlement: Story = { args: { planMrcQar: 145 } };

export const PrepaidProfile: Story = { args: { profile: PREPAID_PROFILE } };

export const FreeNumbersOnly: Story = { args: { profile: FREE_ONLY_PROFILE } };

export const ReservedForCustomer: Story = { args: { customerIdNumber: '27801063400071' } };

export const PortalMode: Story = { args: { portalMode: true, reservedHere: ['+97459990000'], onUnreserve: fn() } };

export const SelectedNumber: Story = { args: { selected: '+97477778888', planMrcQar: 145, waiverQar: 500 } };

export const SelectAndDeselectANumber: Story = {
  play: async ({ canvasElement, args }) => {
    const card = await firstCard(canvasElement);
    await userEvent.click(card);
    await expect(args.onSelect).toHaveBeenCalled();
    await waitFor(() => expect(card).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(card);
    await expect(args.onDeselect).toHaveBeenCalled();
    await waitFor(() => expect(card).toHaveAttribute('aria-pressed', 'false'));
  },
};

export const SearchStarNumbers: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByRole('textbox', { name: 'Search numbers' }), '7777');
    await waitFor(() => expect(canvas.getAllByRole('button', { pressed: false }).some((b: HTMLElement) => /7777/.test(b.textContent ?? ''))).toBe(true), { timeout: 3000 });
  },
};

export const SearchWithNoMatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByRole('textbox', { name: 'Search numbers' }), 'zzzz');
    await expect(await canvas.findByText(/No available numbers match/, undefined, { timeout: 3000 })).toBeInTheDocument();
  },
};

export const ShortSearchHint: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByRole('textbox', { name: 'Search numbers' }), '7');
    await expect(await canvas.findByText('Enter at least 2 characters')).toBeInTheDocument();
  },
};

export const SortPriceToggle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('button', { name: /Price: High to Low. Switch to Price: Low to High/ });
    await userEvent.click(toggle);
    await expect(await canvas.findByRole('button', { name: /Price: Low to High. Switch to Price: High to Low/ })).toBeInTheDocument();
  },
};

export const FreeTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('tab', { name: 'Free Numbers' }));
    await expect(await canvas.findByRole('tab', { name: 'Free Numbers', selected: true })).toBeInTheDocument();
  },
};

export const FilterByPriceRange: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('tab', { name: 'Star Numbers' });
    await userEvent.click(canvas.getByRole('combobox', { name: 'Search by' }));
    await userEvent.click(await canvas.findByRole('option', { name: 'Price' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Min Price' }), '9000');
    await userEvent.type(canvas.getByRole('textbox', { name: 'Max Price' }), '2000');
    await expect(await canvas.findByText('Min Price is higher than Max Price.')).toBeInTheDocument();
  },
};

export const PatternSearchValidation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('tab', { name: 'Star Numbers' });
    await userEvent.click(canvas.getByRole('combobox', { name: 'Search by' }));
    await userEvent.click(await canvas.findByRole('option', { name: 'Pattern' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Search numbers' }), '1234');
    await expect(await canvas.findByText(/Enter repeating pairs of digits/)).toBeInTheDocument();
  },
};

export const BlockedNumbersOnlyWhenSearched: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('tab', { name: 'Blocked Numbers' }));
    await expect(await canvas.findByText(/Search by number, tier or price to find the numbers your group has blocked/)).toBeInTheDocument();
    await userEvent.type(canvas.getByRole('textbox', { name: 'Search numbers' }), '5555');
    const card = await canvas.findByRole('button', { name: 'Blocked number 55559999' }, { timeout: 3000 });
    await expect(card).toBeInTheDocument();
    await userEvent.click(card);
    await waitFor(() => expect(card).toHaveAttribute('aria-pressed', 'true'));
  },
};

export const AnotherGroupsBlockedNumberIsNeverListed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('tab', { name: 'Blocked Numbers' }));
    // +97433009998 is blocked by the "Premium" group; this agent is Retail Sales.
    await userEvent.type(canvas.getByRole('textbox', { name: 'Search numbers' }), '33009998');
    await expect(await canvas.findByText(/No blocked numbers match/, undefined, { timeout: 3000 })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Blocked number 33009998' })).toBeNull();
  },
};

export const KeyboardSelect: Story = {
  play: async ({ canvasElement }) => {
    const card = await firstCard(canvasElement);
    card.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(card).toHaveAttribute('aria-pressed', 'true'));
  },
};

export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } };
