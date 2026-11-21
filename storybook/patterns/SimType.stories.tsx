import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SimType } from '../../src/capabilities';
import { Sim } from '../../src/capabilities/previewDemos';
import { SideBySide, Specimen } from '../_shared/layout';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/SIM Type',
  component: SimType,
  parameters: {
    ...docsParameters({
      purpose: 'Choose and validate the SIM: Physical (scan or enter the serial) or eSIM (issued, handed over after payment). (Capability registry: "SIM Type".)',
      source: 'src/capabilities/SimType/SimType.tsx (SimTypeStep)',
      variants: ['Physical and eSIM shown side by side from the start; Physical\'s serial field is the primary action.', '`prePaired` - a Pre-Paired SIM is scanned from the Pre-Paired inventory, read-only, eSIM not offered.', '`device` - scan-led on a tablet, type-led on the web.'],
      states: ['Nothing chosen', 'Serial being validated against inventory (validity + stock)', 'Physical SIM validated', 'eSIM generated (code issued; QR emailed to `customerEmail`)', 'Approval required'],
      events: ['`onChange(value: SimTypeValue)`.'],
      devices: ['The serial field takes a `device` prop: the **Web and Tablet** stories pass each explicitly side by side; the toolbar **Device** switch changes what the app itself detects.'],
    }),
  },
  argTypes: { device: { control: 'select', options: [undefined, 'web', 'tablet'], description: 'Scan-led (tablet) or type-led (web) serial field.' }, prePaired: { control: 'boolean' }, value: { control: false }, onChange: { control: false }, customerEmail: { control: 'text', description: 'Where the eSIM QR is sent.' } },
  args: { customerEmail: 'sample.customer@example.qa' },
} satisfies Meta<typeof SimType>;
export default meta;
type Story = StoryObj<typeof SimType>;

function Host({ device, prePaired, email }: { device?: 'web' | 'tablet'; prePaired?: boolean; email?: string }) {
  const [v, setV] = useState({});
  return <SimType value={v} onChange={setV} customerEmail={email} device={device} prePaired={prePaired} />;
}

/** The app's own Capability Library preview. */
export const Default: Story = { render: () => <Sim /> };
export const Web: Story = { render: (args) => <Host device="web" email={args.customerEmail} /> };
export const Tablet: Story = { render: (args) => <Host device="tablet" email={args.customerEmail} /> };
export const WebAndTablet: Story = {
  render: (args) => (
    <SideBySide>
      <Specimen label="device=web"><Host device="web" email={args.customerEmail} /></Specimen>
      <Specimen label="device=tablet"><Host device="tablet" email={args.customerEmail} /></Specimen>
    </SideBySide>
  ),
};
export const PrePairedSim: Story = { render: (args) => <Host prePaired email={args.customerEmail} /> };
