import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ContactPhoneInput } from '../../src/components/domain/ContactPhoneInput';
import { docsParameters } from '../_shared/docs';
import { Row, Specimen } from '../_shared/layout';

type ContactArgs = ComponentProps<typeof ContactPhoneInput>;

function Controlled({ initial = '', ...args }: Omit<ContactArgs, 'value' | 'onChange'> & { initial?: string; onChange?: ContactArgs['onChange'] }) {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ maxWidth: 380, minHeight: 280 }}>
      <ContactPhoneInput {...args} value={value} onChange={(v) => { setValue(v); args.onChange?.(v); }} />
    </div>
  );
}

const meta = {
  title: 'Forms/Contact Phone Input',
  component: ContactPhoneInput,
  parameters: {
    ...docsParameters({
      purpose: 'A Qatar mobile-number field (fixed +974 prefix) with a picker of the customer\'s saved contacts. With a `customerId` it reads that customer\'s `customer-contacts` records from the app\'s mock data through the API layer and lists those that have a cell number.',
      source: 'src/components/domain/ContactPhoneInput.tsx (data: public/mock-data/customer-contacts.json via services/entityOps)',
      variants: ['Without `customerId`: a plain +974 field with no chevron or panel', 'With `customerId`: a chevron opens the saved-contacts list (initials avatar, formatted number, full name)'],
      states: ['Empty', 'Populated (shown as "+974 NNNNNNNN" until focused)', 'List open', 'Disabled', 'Error'],
      events: ['onChange(value: string) - the text, not an event; picking a contact passes its cell number as stored (e.g. "+97455512001").'],
      usage: [
        'The stored value is whatever is typed or picked: the field does not strip non-digits or enforce 8 digits (the owner validates).',
        'No `required` prop (no asterisk or aria-required), no read-only. Seeded customers with contacts: CUST-1001 (2 contacts), CUST-1002, CUST-1003.',
      ],
      validation: ['`error` text replaces the helper (role="alert"); the input gets aria-invalid and aria-describedby.'],
      accessibility: [
        'With a customerId the input is role="combobox" (aria-expanded, aria-controls, aria-activedescendant) and the list is a role="listbox" named "Saved contacts"; the chevron button is "Choose a saved contact".',
        'Keyboard: ArrowDown opens the list (when there are contacts), Arrow keys move, Enter picks, Escape closes.',
        'The flag is aria-hidden; the +974 prefix is plain text beside the input, not part of its label.',
      ],
    }),
  },
  argTypes: {
    label: { control: 'text', description: 'Visible label.' },
    helperText: { control: 'text', description: 'Muted text under the field.' },
    error: { control: 'text', description: 'Error message.' },
    disabled: { control: 'boolean', description: 'Unavailable.' },
    customerId: { control: 'select', options: [undefined, 'CUST-1001', 'CUST-1002', 'CUST-1003'], description: 'Enables the saved-contacts picker for this customer.' },
    value: { control: false },
    onChange: { action: 'changed' },
  },
  args: { label: 'Contact number', value: '', onChange: fn() },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof ContactPhoneInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Typing: Story = {
  play: async ({ canvasElement }) => {
    const field = within(canvasElement).getByLabelText('Contact number');
    await userEvent.type(field, '55512345');
    await expect(field).toHaveValue('55512345');
  },
};

export const Populated: Story = {
  render: (args) => <Controlled {...args} initial="+97455512345" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText('Contact number')).toHaveValue('+974 55512345');
  },
};

export const SavedContacts: Story = {
  args: { customerId: 'CUST-1001' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Choose a saved contact' }));
    const list = await c.findByRole('listbox', { name: 'Saved contacts' });
    await expect(list).toBeVisible();
    await waitFor(() => expect(within(list).getAllByRole('option').length).toBeGreaterThan(0));
    await userEvent.click(within(list).getAllByRole('option')[0]);
    await expect(c.getByLabelText('Contact number')).toHaveValue('+974 55512001');
  },
};

export const SavedContactsKeyboard: Story = {
  args: { customerId: 'CUST-1001' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const field = c.getByLabelText('Contact number');
    await waitFor(() => userEvent.click(field));
    await userEvent.keyboard('{ArrowDown}');
    await c.findByRole('listbox', { name: 'Saved contacts' });
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(c.queryByRole('listbox')).toBeNull());
    await expect(field).not.toHaveValue('');
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByLabelText('Contact number')).toHaveFocus();
  },
};

export const Disabled: Story = {
  args: { disabled: true, customerId: 'CUST-1001' },
  render: (args) => <Controlled {...args} initial="+97455512345" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText('Contact number')).toBeDisabled();
  },
};

export const ValidationError: Story = {
  args: { error: 'Enter 8 digits after +974.' },
  render: (args) => <Controlled {...args} initial="555" />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByLabelText('Contact number')).toHaveAttribute('aria-invalid', 'true');
    await expect(c.getByRole('alert')).toBeVisible();
  },
};

export const AllStates: Story = {
  render: () => (
    <Row>
      <Specimen label="Empty"><Controlled label="Contact number" /></Specimen>
      <Specimen label="Populated"><Controlled label="Contact number" initial="+97455512345" /></Specimen>
      <Specimen label="With saved contacts"><Controlled label="Contact number" customerId="CUST-1001" /></Specimen>
      <Specimen label="Disabled"><Controlled label="Contact number" disabled initial="+97455512345" /></Specimen>
      <Specimen label="Error"><Controlled label="Contact number" error="Invalid number." initial="555" /></Specimen>
    </Row>
  ),
};
