import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CreditLimitCard } from '../../src/components/patterns/CreditLimitCard';
import { accountTypeForJourney } from '../../src/engines/creditLimit';
import { docsParameters } from '../_shared/docs';
import { Row, Specimen } from '../_shared/layout';

type CardProps = Parameters<typeof CreditLimitCard>[0];

function Demo(props: CardProps) {
  const [selected, setSelected] = useState(props.selected);
  return (
    <div style={{ maxWidth: 480 }}>
      <CreditLimitCard
        {...props}
        selected={selected}
        onChange={(v) => {
          props.onChange(v);
          setSelected(v);
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Business Components/Credit Limit Card',
  component: CreditLimitCard,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'A NEW account\'s credit limit: the account type the journey opens, the customer\'s segment (Qatari / Expat) and category (HRN / Non-HRN) read from their nationality, and the credit limit. The limit is a dropdown that starts on the segment default and offers the values up to it - or plain text when the customer\'s limit cannot be changed.',
      source: 'src/components/patterns/CreditLimitCard.tsx',
      variants: [
        'Editable: Expat (default QAR 1,000, options up to it) and Qatari (QAR 4,000).',
        'Locked: HRN customer (QAR 50, no explanation needed); Safwa / Safwa+ / Royal segment (explained by a note); a Credit Control limit.',
        '`embedded`: only the rows, no heading or spacing - the caller lists them inside its own definition list (Billing Details).',
        '`accountType`: Consumer Mobile Postpaid (default), Consumer Fixed Line (GigaHome), Consumer Mobile Prepaid; Consumer is shown as "Consumer".',
      ],
      states: ['Default limit (nothing chosen); a chosen limit; locked (text, optional note).'],
      events: ['`onChange(limitQar | undefined)` - `undefined` means the default was chosen again.'],
      usage: ['Rules come from `engines/creditLimit.ts` (`creditLimitPolicy`, `creditLimitOptions`, `defaultCreditLimitFor`); the card adds none of its own.'],
      accessibility: ['A `section` labelled "Credit limit" with a `dl`; the dropdown is the app\'s searchable combobox with `aria-label="Credit Limit (QAR)"`. The lock note is a `dd` with a screen-reader `dt` ("Note").'],
    }),
  },
  argTypes: {
    nationality: { control: 'text', description: 'The nationality MOI returned: decides segment, category, default and options.' },
    selected: { control: 'number', description: 'The chosen limit; undefined means the default.' },
    accountType: { control: 'select', options: [accountTypeForJourney('postpaid'), accountTypeForJourney('fixed-line'), accountTypeForJourney('prepaid')], description: 'The account type the agent\'s journey opens.' },
    customerSegment: { control: 'select', options: [undefined, 'Consumer', 'Safwa', 'Safwa+', 'Royal'], description: 'A Safwa, Safwa+ or Royal customer\'s limit cannot be changed.' },
    embedded: { control: 'boolean', description: 'Only the rows, no heading or spacing.' },
    onChange: { control: false },
  },
  args: { nationality: 'Indian', selected: undefined, onChange: fn() },
} satisfies Meta<typeof CreditLimitCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Qatari: Story = { args: { nationality: 'Qatari' } };

export const HrnLocked: Story = { args: { nationality: 'Pakistani' } };

export const ProtectedSegmentLocked: Story = { args: { nationality: 'Qatari', customerSegment: 'Safwa' } };

export const FixedLineAccount: Story = { args: { accountType: accountTypeForJourney('fixed-line') } };

export const PrepaidAccount: Story = { args: { accountType: accountTypeForJourney('prepaid') } };

export const Embedded: Story = {
  args: { embedded: true },
  render: (args) => (
    <dl style={{ maxWidth: 480 }}>
      <CreditLimitCard {...args} />
    </dl>
  ),
};

export const AllCases: Story = {
  render: (args) => (
    <Row>
      <Specimen label="Expat (editable)">
        <Demo {...args} nationality="Indian" />
      </Specimen>
      <Specimen label="Qatari (editable)">
        <Demo {...args} nationality="Qatari" />
      </Specimen>
      <Specimen label="HRN (locked)">
        <Demo {...args} nationality="Pakistani" />
      </Specimen>
      <Specimen label="Safwa (locked, with note)">
        <Demo {...args} nationality="Qatari" customerSegment="Safwa" />
      </Specimen>
    </Row>
  ),
};

export const ChooseALowerLimit: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('combobox', { name: 'Credit Limit (QAR)' });
    await userEvent.click(field);
    const option = await canvas.findByRole('option', { name: /500/ });
    await userEvent.click(option);
    await expect(args.onChange).toHaveBeenCalledWith(500);
  },
};

export const LockedHasNoDropdown: Story = {
  args: { nationality: 'Pakistani' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('combobox')).toBeNull();
  },
};
