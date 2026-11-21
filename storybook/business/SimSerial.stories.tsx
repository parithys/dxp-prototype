import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { SimSerial } from '../../src/capabilities/SimType/SimSerial';
import { docsParameters } from '../_shared/docs';
import { SideBySide, Specimen } from '../_shared/layout';

type Props = Parameters<typeof SimSerial>[0];

/** Holds the serial the way a journey step does. */
function Host(props: Props) {
  const [value, setValue] = useState(props.value);
  return (
    <SimSerial
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

const meta = {
  title: 'Business Components/SIM Serial',
  component: SimSerial,
  parameters: {
    ...docsParameters({
      purpose: 'The SIM Type capability\'s serial part: scan or enter a SIM\'s serial number and validate it against inventory. The Physical option of SIM Type is this; journeys that only need the serial (port-in, SIM swap, the dual-play serial check) mount it directly. It is a thin pass-through to the Documents component `SimSerialScanner` and takes exactly its props - see Documents/SIM Serial Scanner for every state.',
      source: 'src/capabilities/SimType/SimSerial.tsx',
      variants: ['`device="web"` (type-led) and `device="tablet"` (scan-led: the barcode icon is the scan, no autofocus).'],
      states: ['Empty', 'Validating', 'Validated (SIM Type, serial, ICCID, stock status)', 'Error (not found / already assigned / reserved)'],
      events: ['`onChange(serial, valid, details?)` - `details` (ICCID, stock status) is given the moment validation succeeds.'],
      devices: ['The `device` prop picks the experience; the toolbar **Device** switch changes what the app itself detects when `device` is omitted.'],
      accessibility: ['A labelled text field with an inline error; the scan control is a button named "Scan SIM barcode".'],
      restrictions: ['`TrimMultiSims` in the same folder is headless (renders nothing) and has no story.'],
    }),
  },
  argTypes: { device: { control: 'inline-radio', options: ['web', 'tablet'], description: 'Type-led (web) or scan-led (tablet) field.' }, value: { control: 'text', description: 'The serial.' }, onChange: { control: false } },
  args: { value: '', onChange: fn() },
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof SimSerial>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Web: Story = { args: { device: 'web' } };
export const Tablet: Story = { args: { device: 'tablet' }, parameters: { viewport: { defaultViewport: 'tablet' } } };
export const WebAndTablet: Story = {
  render: (args) => (
    <SideBySide>
      <Specimen label="device=web"><Host {...args} device="web" /></Specimen>
      <Specimen label="device=tablet"><Host {...args} device="tablet" /></Specimen>
    </SideBySide>
  ),
};

export const TypeValidSerial: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.type(within(canvasElement).getByRole('textbox'), AVAILABLE);
    await userEvent.tab();
    // Read the recorded call directly: asymmetric matchers (expect.any) did not match across the test and browser realms.
    const calls = (args.onChange as unknown as { mock: { calls: [string, boolean, { iccid?: string } | undefined][] } }).mock.calls;
    await waitFor(() => {
      const last = calls[calls.length - 1];
      expect(last[0]).toBe(AVAILABLE);
      expect(last[1]).toBe(true);
      expect(last[2]?.iccid).toBe(AVAILABLE);
    }, { timeout: 10000 });
  },
};
