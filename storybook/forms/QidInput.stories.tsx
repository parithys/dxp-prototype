import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { QidNumberField, QidTypeSelector } from '../../src/components/domain/QidInput';
import type { QidType } from '../../src/components/domain/QidInput';
import { ID_TYPES, idTypeDef } from '../../src/data/idTypes';
import { OptionToggle } from 'dxp-ui';
import { docsParameters } from '../_shared/docs';

type NumberArgs = ComponentProps<typeof QidNumberField>;

function NumberDemo({ initial = '', ...args }: Omit<NumberArgs, 'value' | 'onChange'> & { initial?: string; onChange?: NumberArgs['onChange'] }) {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ maxWidth: 520 }}>
      <QidNumberField {...args} value={value} onChange={(v) => { setValue(v); args.onChange?.(v); }} />
    </div>
  );
}

const meta = {
  title: 'Forms/QID Input',
  component: QidNumberField,
  parameters: {
    ...docsParameters({
      purpose: 'The identity-document lookup control, in two parts: QidTypeSelector (the ID type cards) and QidNumberField (the number box with a barcode button and a Fetch action). The label, placeholder and keypad follow the selected ID type. PROTECTED.',
      source: 'src/components/domain/QidInput.tsx, src/data/idTypes.ts (the one definition of the ID types)',
      variants: ['QID, Passport, GCC ID, Diplomatic ID (and Other ID, unsupported) via `idType`', 'Editable number with Fetch, or read-only (a scanned number: Fetch hidden unless `showFetch`)', '`inlineField`: a second labelled field (e.g. expiry date) in the same row, between the number and Fetch', '`hideFetch`, `status` / `statusDetail` slots on the label line'],
      states: ['Empty (Fetch disabled)', 'Populated', 'Fetching', 'Read-only', 'Error', 'Hint'],
      events: ['onChange(value: string) - the text, not an event.', 'onFetch() - Fetch pressed (disabled while the number is empty, fetching, or fetchDisabled).', 'onBarcodeScan() - the barcode button (DEMO ONLY: without a handler it pushes the demo number for the ID type).', 'QidTypeSelector: onIdTypeChange(type).'],
      usage: [
        'The component does NOT validate the number: it only sets the label, placeholder and `inputMode` ("numeric" for QID, GCC ID and Diplomatic ID per `numericNumber` in idTypes.ts; "text" for a passport). It does not strip letters; the owner validates and passes `error`.',
        'The selector offers `allowedTypes`, and shows `unavailableTypes` greyed with `unavailableHint` ("Required pre-approval: ...") - visible but not selectable. A switch of type does not clear the number: the owner does that and refocuses via `inputRef`.',
        'The number field has a fixed id ("qid-number-input"), so only one is rendered at a time on a page.',
      ],
      validation: ['`error` is a red paragraph under the field and red border; it is not role="alert" and the input has no aria-invalid / aria-describedby (see Restrictions).'],
      accessibility: [
        'Selector cards are buttons with aria-pressed; unavailable ones are disabled with aria-disabled. The number is a labelled input (label htmlFor="qid-number-input"); the barcode button is named "Simulate scanning the ... barcode"; the read-only number is tabIndex -1 and not focusable by click.',
      ],
      restrictions: ['Defect noted for the owner: the error message is not tied to the input (no aria-invalid, no aria-describedby, no role="alert"), unlike Input.'],
    }),
  },
  argTypes: {
    idType: { control: 'select', options: ID_TYPES.map((t) => t.type), description: 'Selected ID type: sets label, placeholder and keypad.' },
    error: { control: 'text', description: 'Error text under the field.' },
    hint: { control: 'text', description: 'Hint under the field (shown when there is no error).' },
    readOnly: { control: 'boolean', description: 'A scanned number: shown, not editable, Fetch hidden.' },
    fetching: { control: 'boolean', description: 'Fetch shows "Fetching..." and is disabled.' },
    fetchDisabled: { control: 'boolean', description: 'Extra reason Fetch cannot be pressed.' },
    hideFetch: { control: 'boolean', description: 'No Fetch button.' },
    showFetch: { control: 'boolean', description: 'Show Fetch even when read-only.' },
    value: { control: false },
    onChange: { action: 'changed' },
    onFetch: { action: 'fetch' },
    inlineField: { control: false },
    status: { control: false },
    statusDetail: { control: false },
    inputRef: { control: false },
  },
  args: { idType: 'QID', value: '', onChange: fn(), onFetch: fn() },
  render: (args) => <NumberDemo {...args} />,
} satisfies Meta<typeof QidNumberField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('button', { name: /Fetch/ })).toBeDisabled();
    await userEvent.type(c.getByLabelText('Qatar ID (QID) Number'), '28456701234');
    await expect(c.getByRole('button', { name: /Fetch/ })).toBeEnabled();
  },
};

export const Populated: Story = { render: (args) => <NumberDemo {...args} initial="28456701234" /> };

export const FetchPressed: Story = {
  render: (args) => <NumberDemo {...args} initial="28456701234" />,
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Fetch/ }));
    await expect(args.onFetch).toHaveBeenCalled();
  },
};

export const Fetching: Story = { args: { fetching: true }, render: (args) => <NumberDemo {...args} initial="28456701234" /> };

export const BarcodeScan: Story = {
  parameters: { docs: { description: { story: 'DEMO ONLY: the barcode button fills a fixed specimen number for the ID type, as a real reader would push one.' } } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: /Simulate scanning/ }));
    await waitFor(() => expect(c.getByLabelText('Qatar ID (QID) Number')).toHaveValue('28456701234'));
  },
};

export const ReadOnlyScanned: Story = {
  args: { readOnly: true },
  render: (args) => <NumberDemo {...args} initial="28456701234" />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.queryByRole('button', { name: /Fetch/ })).toBeNull();
    await expect(c.getByLabelText('Qatar ID (QID) Number')).toHaveAttribute('readonly');
  },
};

export const ReadOnlyWithFetch: Story = { args: { readOnly: true, showFetch: true }, render: (args) => <NumberDemo {...args} initial="28456701234" /> };

export const WithHint: Story = { args: { hint: 'Enter the 11-digit number on the front of the card.' } };

export const ValidationError: Story = {
  args: { error: 'The Qatar ID must be digits only.' },
  render: (args) => <NumberDemo {...args} initial="2845AB01234" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('The Qatar ID must be digits only.')).toBeVisible();
  },
};

export const FocusAndHover: Story = {
  play: async ({ canvasElement }) => {
    const field = within(canvasElement).getByLabelText('Qatar ID (QID) Number');
    await userEvent.hover(field);
    await userEvent.click(field);
    await expect(field).toHaveFocus();
  },
};

/** The number field for every ID type: label, placeholder and keypad follow the type. */
export const EachIdType: Story = {
  render: () => {
    const [type, setType] = useState<QidType>('QID');
    const def = idTypeDef(type);
    return (
      <div className="stack gap-3" style={{ maxWidth: 520 }}>
        <OptionToggle label="ID type" active={type} onChange={setType} items={ID_TYPES.map((t) => ({ key: t.type, label: t.type }))} />
        <p className="caption-muted">{`inputMode ${def?.numericNumber ? 'numeric' : 'text'}, placeholder "${def?.placeholder ?? ''}"`}</p>
        <QidNumberField idType={type} value="" onChange={fn()} onFetch={fn()} hideFetch />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('textbox')).toHaveAttribute('inputmode', 'numeric');
    await userEvent.click(c.getByRole('radio', { name: 'Passport' }));
    await expect(c.getByLabelText('Passport Number')).toHaveAttribute('inputmode', 'text');
  },
};

export const InlineExpiryField: Story = {
  render: (args) => (
    <div style={{ maxWidth: 640 }}>
      <QidNumberField {...args} value="28456701234" onChange={fn()} onFetch={fn()}
        inlineField={<div className="stack gap-1"><label htmlFor="qid-exp" className="text-[length:var(--fs-label)] text-fg">Expiry date</label><input id="qid-exp" className="form-control form-control-default" defaultValue="30/11/2029" /></div>} />
    </div>
  ),
};

/** Selector + number field: the way a journey wires them. The owner clears the number when the type changes. */
export const SelectorAndNumber: Story = {
  parameters: { docs: { description: { story: 'QidTypeSelector with QidNumberField, as the ID lookup step wires them. Switching the type clears the number (owner behaviour), changes the label and keypad. The digits-only error is raised by this demo for numeric ID types using `numericNumber` from idTypes.ts.' } } },
  render: () => {
    const [type, setType] = useState<QidType | undefined>('QID');
    const [number, setNumber] = useState('');
    const def = idTypeDef(type ?? 'QID');
    const error = def?.numericNumber && /\D/.test(number) ? 'Digits only for this ID type.' : undefined;
    return (
      <div className="stack gap-4" style={{ maxWidth: 640 }}>
        <QidTypeSelector idType={type} onIdTypeChange={(t) => { setType(t); setNumber(''); }} allowedTypes={['QID', 'Diplomatic ID', 'Passport', 'GCC ID']} />
        <QidNumberField idType={type ?? 'QID'} value={number} onChange={setNumber} onFetch={fn()} error={error} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(c.getByLabelText('Qatar ID (QID) Number'), '12a');
    await expect(c.getByText('Digits only for this ID type.')).toBeVisible();
    await userEvent.click(c.getByRole('button', { name: 'Passport' }));
    await expect(c.getByLabelText('Passport Number')).toHaveValue('');
    await userEvent.type(c.getByLabelText('Passport Number'), 'P0998812');
    await expect(c.queryByText('Digits only for this ID type.')).toBeNull();
  },
};

export const TypeSelectorUnavailable: Story = {
  name: 'Type selector: pre-approval types',
  render: () => (
    <div style={{ maxWidth: 640 }}>
      <QidTypeSelector idType="QID" onIdTypeChange={fn()} allowedTypes={['QID', 'Diplomatic ID']} unavailableTypes={['Passport', 'GCC ID']} unavailableHint="Passport and GCC ID need Back Office approval." />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('button', { name: 'Passport' })).toBeDisabled();
    await expect(c.getByRole('button', { name: 'Qatar ID (QID)' })).toHaveAttribute('aria-pressed', 'true');
  },
};
