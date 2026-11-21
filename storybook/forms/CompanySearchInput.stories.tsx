import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { CompanySearchInput } from '../../src/components/domain/CompanySearchInput';
import type { CompanySelection } from '../../src/components/domain/CompanySearchInput';
import { docsParameters } from '../_shared/docs';

type CompanyArgs = ComponentProps<typeof CompanySearchInput>;

function Controlled({ initial = {}, ...args }: Omit<CompanyArgs, 'value' | 'onChange'> & { initial?: CompanySelection; onChange?: CompanyArgs['onChange'] }) {
  const [value, setValue] = useState<CompanySelection>(initial);
  return (
    <div className="stack gap-2" style={{ maxWidth: 420, minHeight: 360 }}>
      <CompanySearchInput {...args} value={value} onChange={(next) => { setValue(next); args.onChange?.(next); }} />
      <p className="caption-muted" data-testid="committed">{value.companyName ? `Committed: ${value.companyName}${value.companyIsNew ? ' (new)' : ''}` : 'Nothing committed'}</p>
    </div>
  );
}

const meta = {
  title: 'Forms/Company Search Input',
  component: CompanySearchInput,
  parameters: {
    ...docsParameters({
      purpose: 'Company search for a B2B2C order: a searchable list of the registered `enterprise-accounts` (matching name or CR number) with an "Add New Company" row. It runs against the app\'s mock data (public/mock-data/enterprise-accounts.json) through the API layer.',
      source: 'src/components/domain/CompanySearchInput.tsx (uses primitives/SearchField and hooks/useSearchListNav)',
      states: ['Empty (the whole registry is on offer when the list opens)', 'Filtered', 'No registry match (Add New Company)', 'Committed registry account', 'Committed new company', 'Required'],
      events: ['onChange(selection) with { companyName, companyAccountId, companyIsNew }. A typed string is NOT a company: nothing is committed until a registry row or "Add New Company" is chosen; editing text after a commit clears the selection.'],
      usage: [
        '`allowAddNew` (default true) offers "Add New Company" whenever text is typed that no row matches exactly; when false an empty result shows "No matching company."',
        '`statusNote` renders beside the "linked" line once a registry company is picked.',
        'There is no error prop and no disabled state; no placeholder control (it always reads "Search by company name" - not shown, since role=combobox drops it).',
      ],
      accessibility: [
        'role="combobox" with aria-expanded, aria-controls, aria-autocomplete="list" and aria-activedescendant (via useSearchListNav); the list is role="listbox" of role="option". `required` adds aria-required and an aria-hidden asterisk.',
        'Keyboard: ArrowDown / ArrowUp move (wrapping), Enter picks the highlighted row (or "Add New Company"), Escape closes the list and keeps the text. The chevron button is tabIndex -1, labelled Open / Close company list.',
        'The list has no accessible name (no aria-label / aria-labelledby on the listbox) - noted in Restrictions.',
      ],
      restrictions: ['Defect noted for the owner: the listbox has no accessible name, and selecting an option relies on a click handler on the <li> (no focus on options; keyboard goes through aria-activedescendant).'],
    }),
  },
  argTypes: {
    label: { control: 'text', description: 'Visible label.' },
    required: { control: 'boolean', description: 'Asterisk and aria-required.' },
    allowAddNew: { control: 'boolean', description: 'Offer "Add New Company" for unmatched text.' },
    value: { control: false },
    statusNote: { control: false },
    onChange: { action: 'changed' },
  },
  args: { label: 'Employer company', value: {}, onChange: fn() },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof CompanySearchInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OpenWholeRegistry: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('combobox', { name: 'Employer company' }));
    await waitFor(() => expect(c.getAllByRole('option').length).toBeGreaterThan(3));
  },
};

export const FilterAndPick: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const field = c.getByRole('combobox', { name: 'Employer company' });
    await userEvent.type(field, 'Lulu Hypermarket');
    await waitFor(() => expect(c.getAllByRole('option').length).toBeGreaterThan(1));
    await userEvent.click(c.getAllByRole('option')[0]);
    await expect(c.getByTestId('committed')).toHaveTextContent('Committed: Lulu Hypermarket');
  },
};

export const KeyboardPick: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const field = c.getByRole('combobox', { name: 'Employer company' });
    await userEvent.type(field, 'Lulu');
    await waitFor(() => expect(c.getAllByRole('option').length).toBeGreaterThan(1));
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(c.getByTestId('committed')).toHaveTextContent('Committed: Lulu');
    await expect(field).toHaveAttribute('aria-expanded', 'false');
  },
};

export const AddNewCompany: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(c.getByRole('combobox', { name: 'Employer company' }), 'Zeta Logistics W.L.L.');
    await userEvent.click(await c.findByRole('option', { name: /Add New Company/ }));
    await expect(c.getByTestId('committed')).toHaveTextContent('Zeta Logistics W.L.L. (new)');
    await expect(c.getByText(/will be registered when the order is submitted/)).toBeVisible();
  },
};

export const NoAddNew: Story = {
  args: { allowAddNew: false },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(c.getByRole('combobox', { name: 'Employer company' }), 'zzzzzz');
    await expect(await c.findByText('No matching company.')).toBeVisible();
  },
};

export const EditingClearsSelection: Story = {
  parameters: { docs: { description: { story: 'Editing the text after choosing a company clears the commit, so a stale account link cannot survive a renamed company.' } } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const field = c.getByRole('combobox', { name: 'Employer company' });
    await userEvent.type(field, 'Aamal');
    await userEvent.click((await c.findAllByRole('option'))[0]);
    await expect(c.getByTestId('committed')).toHaveTextContent('Committed');
    await userEvent.type(field, 'x');
    await expect(c.getByTestId('committed')).toHaveTextContent('Nothing committed');
  },
};

export const Required: Story = {
  args: { required: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('combobox')).toHaveAttribute('aria-required', 'true');
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole('combobox')).toHaveFocus();
  },
};
