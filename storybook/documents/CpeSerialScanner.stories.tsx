import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { CpeSerialScanner } from '../../src/components/domain/CpeSerialScanner';
import { docsParameters } from '../_shared/docs';

type Props = Parameters<typeof CpeSerialScanner>[0];

function Stateful(props: Props) {
  const [value, setValue] = useState(props.value);
  return (
    <CpeSerialScanner
      {...props}
      value={value}
      onChange={(v, valid) => {
        setValue(v);
        props.onChange(v, valid);
      }}
    />
  );
}

const meta = {
  title: 'Documents/CPE Serial Scanner',
  component: CpeSerialScanner,
  parameters: {
    ...docsParameters({
      purpose: 'Barcode-scan input for a CPE (Indoor / Outdoor) serial, validated on blur against UIM inventory (cpe-devices.json) - the same real-time inventory validation as the SIM Serial Scanner, for FWA / fixed-line devices.',
      source: 'src/components/domain/CpeSerialScanner.tsx',
      states: ['Empty', 'Checking inventory…', 'Valid (an In-Stock device of the expected type)', 'Error: required (blank), not found in inventory, wrong device type, already assigned'],
      events: ['`onChange(value, valid)` - `valid` is true only after a successful check on blur; every keystroke reports `false`.'],
      validation: ['Blank: `{label} is required.`; unknown: `{label} not found in inventory.`; another type: `This serial is a {type}, not a {expected}.`; not In-Stock: `This {type} is already assigned ({stock status}).`'],
      accessibility: ['A labelled text input; the error is its error text.'],
      restrictions: ['It has no scan button of its own: a hardware barcode reader types into the field, like a keyboard.'],
    }),
  },
  argTypes: {
    label: { control: 'text', description: 'The field label.' },
    deviceType: { control: 'select', options: ['Indoor IDU', 'Outdoor ODU', 'ONT', 'Combo Box'], description: 'The device type the serial must belong to.' },
    value: { control: 'text', description: 'The serial.' },
    onChange: { control: false },
  },
  args: { label: 'CPE Indoor Serial Number', deviceType: 'Indoor IDU', value: '', onChange: fn() },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof CpeSerialScanner>;
export default meta;
type Story = StoryObj<typeof meta>;

const typeAndBlur = async (root: HTMLElement, serial: string) => {
  const input = within(root).getByRole('textbox');
  if (serial) await userEvent.type(input, serial);
  else await userEvent.click(input);
  await userEvent.tab();
};

export const Empty: Story = {};

export const ValidInStockSerial: Story = {
  play: async ({ canvasElement, args }) => {
    await typeAndBlur(canvasElement, 'HW889950C');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('HW889950C', true), { timeout: 3000 });
    await expect(within(canvasElement).queryByRole('alert')).toBeNull();
  },
};

export const RequiredWhenBlank: Story = {
  play: async ({ canvasElement }) => {
    await typeAndBlur(canvasElement, '');
    await waitFor(() => expect(within(canvasElement).getByText('CPE Indoor Serial Number is required.')).toBeVisible());
  },
};

export const NotFoundInInventory: Story = {
  play: async ({ canvasElement }) => {
    await typeAndBlur(canvasElement, 'ZZ000000X');
    await waitFor(() => expect(within(canvasElement).getByText('CPE Indoor Serial Number not found in inventory.')).toBeVisible(), { timeout: 3000 });
  },
};

export const WrongDeviceType: Story = {
  play: async ({ canvasElement }) => {
    await typeAndBlur(canvasElement, 'NK772201B');
    await waitFor(() => expect(within(canvasElement).getByText('This serial is a Outdoor ODU, not a Indoor IDU.')).toBeVisible(), { timeout: 3000 });
  },
};

export const AlreadyAssigned: Story = {
  args: { label: 'CPE Combo Serial Number', deviceType: 'Combo Box' },
  play: async ({ canvasElement }) => {
    await typeAndBlur(canvasElement, 'HW889912A');
    await waitFor(() => expect(within(canvasElement).getByText('This Combo Box is already assigned (Sold/Assigned).')).toBeVisible(), { timeout: 3000 });
  },
};
