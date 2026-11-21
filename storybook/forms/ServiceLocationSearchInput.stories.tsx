import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ServiceLocationSearchInput } from '../../src/components/domain/ServiceLocationSearchInput';
import { docsParameters } from '../_shared/docs';

type LocationArgs = ComponentProps<typeof ServiceLocationSearchInput>;

// Plain-props fixtures in the shape listServiceLocationOptions() returns (engines/serviceLocationLookup.ts); the component takes its options as a prop.
const OPTIONS: LocationArgs['options'] = [
  { value: 'K-100234', detail: 'Zone 63, Street 910, Building 12 - Al Waab' },
  { value: 'K-100235', detail: 'Zone 63, Street 910, Building 14 - Al Waab' },
  { value: 'K-208811', detail: 'Zone 45, Street 330, Building 7 - West Bay' },
  { value: 'K-309002', detail: 'Zone 55, Street 120, Building 3 - Al Sadd' },
];

function Controlled({ initial = '', ...args }: Omit<LocationArgs, 'value' | 'onTextChange' | 'onSelect'> & { initial?: string; onTextChange?: LocationArgs['onTextChange']; onSelect?: LocationArgs['onSelect'] }) {
  const [value, setValue] = useState(initial);
  const [address, setAddress] = useState('');
  return (
    <div className="stack gap-2" style={{ maxWidth: 420, minHeight: 340 }}>
      <ServiceLocationSearchInput {...args} value={value} onTextChange={(t) => { setValue(t); setAddress(''); args.onTextChange?.(t); }} onSelect={(o) => { setValue(o.value); setAddress(o.detail); args.onSelect?.(o); }} />
      <p className="caption-muted" data-testid="address">{address ? `Address filled: ${address}` : 'No address yet'}</p>
    </div>
  );
}

const meta = {
  title: 'Forms/Service Location Search Input',
  component: ServiceLocationSearchInput,
  parameters: {
    ...docsParameters({
      purpose: 'A searchable dropdown for a Kahramaa Meter ID or a Vodafone Premise ID: a list that narrows as the agent types (nothing typed offers every ID), choosing a row tells the owner to fill the address, and text that matches no ID is reported as "No location found".',
      source: 'src/components/domain/ServiceLocationSearchInput.tsx (options from engines/serviceLocationLookup.ts listServiceLocationOptions)',
      states: ['Empty', 'Open (all IDs)', 'Filtered', 'Picked', 'No location found (typed text that is not a known ID)'],
      events: ['onTextChange(text) - typing, committed as typed.', 'onSelect(option) - a row was chosen; the owner looks the ID up and fills the address.'],
      usage: [
        'It takes its `options` as a prop ({ value, detail }); this story uses small fixtures in that shape. In the app the options come from the mock-data service points, saved addresses and Vodafone IDs.',
        'Matching is case-insensitive on the ID or its address detail, limited to 20 rows. `label`, `id` and `placeholder` are required props; there is no required marker, error or disabled prop.',
        'The placeholder is dropped by the combobox role (SearchField).',
      ],
      accessibility: [
        'role="combobox" with aria-expanded, aria-controls, aria-autocomplete="list", aria-activedescendant (useSearchListNav); the list is role="listbox". The "No location found" message is role="status" once the list closes.',
        'Keyboard: ArrowDown / ArrowUp move, Enter picks, Escape closes. The chevron is tabIndex -1, labelled "Open / Close <label> list".',
      ],
      restrictions: ['Defect noted for the owner: the listbox has no accessible name and no aria-describedby ties the "No location found" message to the input; the not-found message is red text only.'],
    }),
  },
  argTypes: {
    label: { control: 'text', description: 'Visible label (also names the chevron button).' },
    id: { control: 'text', description: 'Input id; the listbox and options derive from it.' },
    placeholder: { control: 'text', description: 'Hint (dropped for role=combobox).' },
    options: { control: false, description: 'IDs on offer: { value, detail }[].' },
    value: { control: false },
    onTextChange: { action: 'text changed' },
    onSelect: { action: 'selected' },
  },
  args: { label: 'Kahramaa Meter ID', id: 'kid-input', placeholder: 'Meter ID', value: '', options: OPTIONS, onTextChange: fn(), onSelect: fn() },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof ServiceLocationSearchInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OpenAllIds: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('combobox', { name: 'Kahramaa Meter ID' }));
    await expect(c.getAllByRole('option')).toHaveLength(OPTIONS.length);
  },
};

export const FilterByIdOrAddress: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const field = c.getByRole('combobox', { name: 'Kahramaa Meter ID' });
    await userEvent.type(field, 'west bay');
    await expect(c.getAllByRole('option')).toHaveLength(1);
  },
};

export const PickAnId: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('combobox', { name: 'Kahramaa Meter ID' }));
    await userEvent.click(c.getByRole('option', { name: /K-208811/ }));
    await expect(args.onSelect).toHaveBeenCalled();
    await expect(c.getByTestId('address')).toHaveTextContent('West Bay');
  },
};

export const KeyboardPick: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const field = c.getByRole('combobox', { name: 'Kahramaa Meter ID' });
    await userEvent.click(field);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await expect(field).toHaveValue('K-100235');
    await expect(c.getByTestId('address')).toHaveTextContent('Building 14');
  },
};

export const NotFound: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const field = c.getByRole('combobox', { name: 'Kahramaa Meter ID' });
    await userEvent.type(field, 'K-000000');
    await expect(c.getByText('No location found')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(await c.findByRole('status')).toHaveTextContent('No location found');
  },
};

export const VodafonePremiseId: Story = {
  args: { label: 'Vodafone Premise ID', id: 'vfid-input', options: [{ value: 'VF-PR-5001', detail: 'Lusail, Marina District' }, { value: 'VF-PR-5002', detail: 'The Pearl, Porto Arabia' }] },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole('combobox')).toHaveFocus();
  },
};
