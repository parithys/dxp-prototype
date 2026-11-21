import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ServiceAddress } from '../../src/capabilities';
import type { ZsbAddressValue } from '../../src/components/patterns/ZsbAddressStep';
import { Address } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Service Address',
  component: ServiceAddress,
  parameters: {
    ...docsParameters({
      purpose: 'The address a service is activated at: one layout everywhere - Service Information (Kahramaa Meter ID / Vodafone Premise ID with Search), then Zone / Street / Building, then Additional Details, with Qatari-ID prefill. (Capability registry: "Service Address".)',
      source: 'src/capabilities/ServiceAddress/ServiceAddress.tsx (ZsbAddressStep)',
      variants: ['Full: with the Kahramaa / Vodafone ID card (`showServiceIds`, default yes).', 'Mobile line: `showServiceIds={false}` - a mobile line needs no serviceable premises.', 'Prefilled: `idNumber` + `nationality="Qatari"` looks up the registered address as an editable head start.'],
      states: ['Empty', 'Searching / fetching', 'Populated from a Kahramaa or Vodafone ID', 'Prefilled from a Qatari ID (editable)'],
      events: ['`onChange(value: ZsbAddressValue)`.'],
      usage: ['Mounted through `serviceAddressStep`.'],
    }),
  },
  argTypes: { showServiceIds: { control: 'boolean', description: 'Show the Kahramaa Meter ID / Vodafone Premise ID card.' }, value: { control: false }, onChange: { control: false }, idNumber: { control: 'text' }, nationality: { control: 'text' }, mode: { control: false } },
} satisfies Meta<typeof ServiceAddress>;
export default meta;
type Story = StoryObj<typeof ServiceAddress>;

function Host(props: { showServiceIds?: boolean; idNumber?: string; nationality?: string }) {
  const [v, setV] = useState<ZsbAddressValue>({});
  return <ServiceAddress mode="structured" value={v} onChange={setV} {...props} />;
}

/** The app's own Capability Library preview. */
export const Default: Story = { render: () => <Address /> };
export const WithoutServiceIds: Story = { render: () => <Host showServiceIds={false} /> };
export const QatariIdPrefill: Story = { render: () => <Host idNumber="28456701234" nationality="Qatari" /> };
