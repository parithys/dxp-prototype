import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { CustomerIdentification, contactIdentificationProps } from '../../src/capabilities';
import type { GuidedContactValue } from '../../src/components/patterns/guidedContactModel';
import { Identification } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Customer Identification',
  component: CustomerIdentification,
  parameters: {
    ...docsParameters({
      purpose: 'Select an ID type, scan the document, validate with MOI and show the validated Identity Details in one card, in every journey. (Capability registry: "Customer Verification".)',
      source: 'src/capabilities/CustomerIdentification/CustomerIdentification.tsx',
      variants: [
        'New customer (walk-in): `contactIdentificationProps({ flow: \'new\' })` - a scanned ID that no registry knows is handled as a new customer.',
        'Existing customer: `flow: \'existing\'` + `existingCustomerId` - the journey is bound to the customer it was opened for; a scanned ID is checked against them.',
        'Prepaid: `journeyType: \'prepaid\'` offers the prepaid journey\'s ID types.',
      ],
      states: ['Empty (ID type not chosen)', 'ID type chosen, scan / typed number and expiry', 'Validating (MOI fetch)', 'Validated (Identity Details card, "MOI Validated")', 'Scan unclear (Retake)', 'Locked once the journey locks the customer'],
      events: ['`onChange(value: GuidedContactValue)` - `{ idType, idNumber, scannedExpiry, moiResult, ... }`.'],
      usage: ['Mounted as the first step of every activation / service journey (through `idLookupStep` or `customerQualificationStep`). The props the journeys pass come from one function, `contactIdentificationProps`, which the stories spread too.'],
      validation: ['Field errors appear under the field (red border, `aria-invalid`); Fetch stays disabled until the expiry is filled; an ID that MOI does not know raises the new-customer path or an error depending on `allowNewCustomer`.'],
      devices: ['Scanner-led on a tablet (camera / reader), type-led on the web. Use the toolbar **Device** switch to compare; the scanner simulators show only when demo UI is on.'],
      restrictions: ['MOI, the card reader and Big Data are simulated by the mock data layer; use the test IDs from the mock data (for example the QID 28456701234).'],
    }),
  },
  argTypes: { value: { control: false }, onChange: { control: false } },
} satisfies Meta<typeof CustomerIdentification>;
export default meta;
type Story = StoryObj<typeof CustomerIdentification>;

function Mounted({ props }: { props: ReturnType<typeof contactIdentificationProps> }) {
  const [v, setV] = useState<GuidedContactValue>({});
  return <CustomerIdentification {...props} value={v} onChange={setV} />;
}

/** The app's own Capability Library preview: New Connection's walk-in customer. */
export const Default: Story = {
  render: () => <Identification />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('button').length).toBeGreaterThan(0);
  },
};

export const ExistingCustomer: Story = { render: () => <Mounted props={contactIdentificationProps({ flow: 'existing', existingCustomerId: 'CUST-1001' })} /> };
export const Prepaid: Story = { render: () => <Mounted props={contactIdentificationProps({ flow: 'new', journeyType: 'prepaid' })} /> };
export const ManualEntryAllowed: Story = { render: () => <Mounted props={contactIdentificationProps({ flow: 'new', manualEntry: true })} /> };
