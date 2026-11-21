import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { SimTypeStep } from '../../src/components/domain/SimTypeStep';
import type { SimTypeValue } from '../../src/components/domain/SimTypeStep';
import { docsParameters } from '../_shared/docs';
import { SideBySide, Specimen } from '../_shared/layout';

type StepProps = Parameters<typeof SimTypeStep>[0];

/** The step as the wizard holds it: the SIM choice is local state. */
function Demo(props: StepProps) {
  const [value, setValue] = useState<SimTypeValue>(props.value);
  return (
    <div style={{ maxWidth: 900 }}>
      <SimTypeStep
        {...props}
        value={value}
        onChange={(v) => {
          props.onChange(v);
          setValue(v);
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Business Components/SIM Type Step',
  component: SimTypeStep,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'The SIM step: a Physical SIM (scan or type the serial; validated against stock in real time) and an eSIM (Generate eSIM) side by side - the two are alternatives, not a tab pair. A Pre-Paired variant scans a SIM from the Pre-Paired inventory and reads back the number already on it.',
      source: 'src/components/domain/SimTypeStep.tsx (+ esimProfile.ts for the eSIM profile; the serial field is the Documents-owned SimSerialScanner)',
      variants: [
        'Default: Physical SIM scanner beside the eSIM action.',
        '`prePaired`: only "Pre-Paired SIM Serial Number"; a valid SIM shows SIM Type, serial, ICCID and Mobile Number (read-only); eSIM is not offered.',
        '`pairingFromScan`: either stock is accepted and the serial decides Paired / Unpaired (Mobile Prepaid); the agent makes no choice.',
        '`approvalRequired`: the eSIM note says the QR code is released on approval, not on submission.',
        '`extraRows`: extra label / value rows in the SIM read-back (New Prepaid: Paired / Unpaired).',
      ],
      states: ['Empty; Physical valid (green read-back); Physical invalid (field error: not found, already assigned, reserved); eSIM generating ("Generating eSIM..." and disabled); eSIM selected (badge "eSIM selected", read-back, note that the QR code follows payment). Choosing eSIM suppresses the Physical field\'s "required" validation.'],
      events: ['`onChange(value)` - the whole SimTypeValue (`simType`, `simSerial`, `simValid`, `simIccid`, `simStockStatus`, `simKind`, `prePaired`, `prePairedMsisdn`, `esimIssued`, `esimActivationCode`).'],
      usage: ['`excludeSerials` / `excludeIccids` list the SIMs another line of the same order already uses; a serial in the list is refused and the eSIM picks another profile.'],
      validation: ['The serial is checked against stock on blur / scan: "SIM not found in this store\'s stock.", "This SIM is already assigned.", "This SIM is reserved for another order." The wizard step is valid with either a validated serial or a selected eSIM.'],
      accessibility: ['The serial field is a labelled input (required marker `aria-hidden`, `aria-required`); the barcode icon is a button named "Scan SIM barcode". The eSIM state is carried by text and a badge.'],
      devices: ['`device="web"` is type-led (the field takes focus on arrival); `device="tablet"` is scan-led (the barcode icon is the scan, no autofocus so the on-screen keyboard stays down).'],
    }),
  },
  argTypes: {
    value: { control: 'object', description: 'The SIM choice so far (SimTypeValue).' },
    customerEmail: { control: 'text', description: 'Where the eSIM QR code will be sent.' },
    device: { control: 'select', options: ['web', 'tablet'], description: 'Type-led (web) or scan-led (tablet) serial field.' },
    prePaired: { control: 'boolean', description: 'Scan a SIM from the Pre-Paired inventory.' },
    pairingFromScan: { control: 'boolean', description: 'The scanned serial decides Paired / Unpaired.' },
    approvalRequired: { control: 'boolean', description: 'The order is held for approval: the QR code is released on approval.' },
    excludeSerials: { control: 'object', description: 'Serials used by another SIM in this order.' },
    excludeIccids: { control: 'object', description: 'ICCIDs taken by another eSIM of this order.' },
    extraRows: { control: 'object', description: 'Extra label / value rows for the SIM read-back.' },
    autoFocus: { control: 'boolean', description: 'Whether the serial field takes focus on arrival (default: the device decides).' },
    onChange: { control: false },
  },
  args: { value: {}, customerEmail: 'customer@example.com', device: 'web', approvalRequired: false, onChange: fn() },
} satisfies Meta<typeof SimTypeStep>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PhysicalSimValid: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: /SIM Serial Number/ }), '8974412009900129000');
    await userEvent.tab();
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ simType: 'Physical', simValid: true })));
    await expect(await canvas.findByText('SIM Type')).toBeInTheDocument();
  },
};

export const PhysicalSimAlreadyAssigned: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: /SIM Serial Number/ }), '8974412009900123456');
    await userEvent.tab();
    await expect(await canvas.findByText('This SIM is already assigned.')).toBeInTheDocument();
  },
};

export const PhysicalSimNotFound: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: /SIM Serial Number/ }), '8974412000000000001');
    await userEvent.tab();
    await expect(await canvas.findByText("SIM not found in this store's stock.")).toBeInTheDocument();
  },
};

export const GenerateEsim: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Generate eSIM' }));
    await expect(await canvas.findByText('Generating eSIM…')).toBeInTheDocument();
    await expect(await canvas.findByText('eSIM selected', undefined, { timeout: 4000 })).toBeInTheDocument();
    await expect(args.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ simType: 'eSIM', esimIssued: true }));
  },
};

export const EsimSelected: Story = {
  args: { value: { simType: 'eSIM', esimIssued: true, esimActivationCode: 'LPA:1$smdp.vodafone.qa$ABCD2345EFGH6789', simIccid: '8974412009900140101' } },
};

export const EsimAwaitingApproval: Story = { args: { approvalRequired: true, value: { simType: 'eSIM', esimIssued: true, esimActivationCode: 'LPA:1$smdp.vodafone.qa$ABCD2345EFGH6789', simIccid: '8974412009900140101' } } };

export const PrePairedSim: Story = {
  args: { prePaired: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: /Pre-Paired SIM Serial Number/ }), '8974412009900140001');
    await userEvent.tab();
    await expect(await canvas.findByText('+97433990001')).toBeInTheDocument();
  },
};

export const PairingDecidedByScan: Story = { args: { pairingFromScan: true, extraRows: [['SIM Status', 'Paired']] } };

export const WebAndTablet: Story = {
  render: (args) => (
    <SideBySide>
      <Specimen label="device = web (type-led)">
        <Demo {...args} device="web" autoFocus={false} />
      </Specimen>
      <Specimen label="device = tablet (scan-led)">
        <Demo {...args} device="tablet" />
      </Specimen>
    </SideBySide>
  ),
};
