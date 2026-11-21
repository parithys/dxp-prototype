import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { SimSerialScanner } from '../../src/components/domain/SimSerialScanner';
import { docsParameters } from '../_shared/docs';
import { SideBySide, Specimen } from '../_shared/layout';

type Props = Parameters<typeof SimSerialScanner>[0];

/** Holds the serial the way a journey step does. */
function Stateful(props: Props) {
  const [value, setValue] = useState(props.value);
  return (
    <SimSerialScanner
      {...props}
      value={value}
      onChange={(v, valid, details) => {
        setValue(v);
        props.onChange(v, valid, details);
      }}
    />
  );
}

// Serials from public/mock-data/sims.json.
const AVAILABLE = '8974412345678901234';
const ISSUED = '8974412009900123456';
const PRE_PAIRED = '8974412009900140001';

const meta = {
  title: 'Documents/SIM Serial Scanner',
  component: SimSerialScanner,
  parameters: {
    ...docsParameters({
      purpose: 'The SIM serial capture with real-time stock validation: a barcode-scan field checked against the store\'s stock (sims.json). It blocks Continue with an inline error when the serial is not found, already assigned or reserved, and reads the validated SIM back (SIM Type, serial, extra rows) in a green container.',
      source: 'src/components/domain/SimSerialScanner.tsx (rule: simSerialModel.ts `checkSimSerial`)',
      variants: ['Web (`device="web"`): type-led - the field takes focus; the scan icon is the alternative.', 'Tablet (`device="tablet"`): scan-led - the barcode icon (a larger hit area) is the scan, no autofocus.', 'Inventory: `standard` (a Pre-Paired SIM is refused), `pre-paired` (only Pre-Paired SIMs; the read-back carries the MSISDN), `any` (the serial decides).'],
      states: ['Empty', 'Scanning (`Scanning…`)', 'Checking stock', 'Validated (green read-back)', 'Error: not found / already assigned / reserved / used for another SIM in this order / wrong stock', '`disabled`', '`suppressValidation` (eSIM chosen instead: no error, not required)'],
      events: ['`onChange(value, valid, details?)` - `details` (ICCID, stock status ...) only on a successful validation.'],
      validation: ['Runs on blur (not when the scan icon is pressed). An empty field shows no message; Continue is already blocked.', '`excludeSerials` are serials used for another SIM in the order: a scan never picks one and typing one is refused.'],
      accessibility: ['The scan trigger is an icon button named `Scan SIM barcode`; the error is the field\'s error text.'],
      devices: ['Pass `device` (the stories do). Journeys that adapt to the device pass the detected one.'],
    }),
  },
  argTypes: {
    device: { control: 'inline-radio', options: ['web', 'tablet'], description: 'Web is type-led, tablet is scan-led.' },
    inventory: { control: 'select', options: ['standard', 'pre-paired', 'any'], description: 'Which stock the serial is read from.' },
    label: { control: 'text', description: 'The field label.' },
    disabled: { control: 'boolean', description: 'Field and scan unavailable.' },
    suppressValidation: { control: 'boolean', description: 'eSIM is the current choice: no validation, no required marker.' },
    hideDetails: { control: 'boolean', description: 'The caller shows the read-back itself.' },
    autoFocus: { control: 'boolean', description: 'Focus the field on arrival (default: on web only).' },
    excludeSerials: { control: 'object', description: 'Serials already used for another SIM in this order.' },
    extraRows: { control: 'object', description: 'Extra label / value rows in the read-back.' },
    value: { control: 'text', description: 'The serial.' },
    onChange: { control: false },
  },
  args: { value: '', onChange: fn(), device: 'web', autoFocus: false },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof SimSerialScanner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Web: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Scan SIM barcode' })).toBeVisible();
  },
};

export const Tablet: Story = {
  args: { device: 'tablet' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('button', { name: 'Scan SIM barcode' })).toHaveLength(1);
  },
};

export const ScanBarcode: Story = {
  name: 'Scan barcode (interactive)',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Scan SIM barcode' }));
    await expect(await canvas.findByText('Scanning…')).toBeVisible();
    await waitFor(() => expect(canvas.getByText('SIM Type')).toBeVisible(), { timeout: 5000 });
    // onChange fires first with the scanned serial (not yet checked), then again with the checked result.
    // Read the recorded call directly: asymmetric matchers (expect.any) did not match across the test and browser realms.
    const calls = (args.onChange as unknown as { mock: { calls: [string, boolean, { iccid?: string; stockStatus?: string } | undefined][] } }).mock.calls;
    await waitFor(() => {
      const last = calls[calls.length - 1];
      expect(last[0]).toMatch(/^\d+$/);
      expect(last[1]).toBe(true);
      expect(last[2]?.stockStatus).toBe('Available');
      expect(last[2]?.iccid).toBeTruthy();
    });
  },
};

export const TypeValidSerial: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox'), AVAILABLE);
    await userEvent.tab();
    await waitFor(() => expect(canvas.getByText('SIM Type')).toBeVisible(), { timeout: 3000 });
    await expect(canvas.getByText(AVAILABLE, { selector: 'dd' })).toBeVisible();
  },
};

export const ValidatedWithExtraRows: Story = {
  args: { value: AVAILABLE, extraRows: [['Paired', 'Unpaired']] },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(within(canvasElement).getByText('Paired')).toBeVisible(), { timeout: 3000 });
  },
};

export const NotFound: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox'), '0000000000000000000');
    await userEvent.tab();
    await waitFor(() => expect(canvas.getByRole('alert')).toHaveTextContent("SIM not found in this store's stock."), { timeout: 3000 });
  },
};

export const AlreadyAssigned: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox'), ISSUED);
    await userEvent.tab();
    await waitFor(() => expect(canvas.getByRole('alert')).toHaveTextContent('This SIM is already assigned.'), { timeout: 3000 });
  },
};

export const UsedForAnotherSimInTheOrder: Story = {
  args: { excludeSerials: [AVAILABLE] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox'), AVAILABLE);
    await userEvent.tab();
    await waitFor(() => expect(canvas.getByRole('alert')).toHaveTextContent('already used for another SIM in this order'), { timeout: 3000 });
  },
};

export const PrePairedSimRefusedInStandardStock: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox'), PRE_PAIRED);
    await userEvent.tab();
    await waitFor(() => expect(canvas.getByRole('alert')).toHaveTextContent('This is a Pre-Paired SIM'), { timeout: 3000 });
  },
};

export const PrePairedInventory: Story = {
  args: { inventory: 'pre-paired', label: 'Pre-Paired SIM Serial Number', value: PRE_PAIRED },
};

export const Disabled: Story = { args: { disabled: true } };
export const ESimChosenValidationSuppressed: Story = { args: { suppressValidation: true } };

export const WebAndTablet: Story = {
  render: (args) => (
    <SideBySide>
      <Specimen label="Web (type-led)">
        <Stateful {...args} device="web" />
      </Specimen>
      <Specimen label="Tablet (scan-led)">
        <Stateful {...args} device="tablet" />
      </Specimen>
    </SideBySide>
  ),
};
