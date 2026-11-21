import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActualUser } from '../../src/capabilities';
import { ActualUserPreview } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Actual User',
  component: ActualUser,
  parameters: {
    ...docsParameters({
      purpose: 'Who will use the line when it is not the customer who owns it: the agent adds an actual user, identified like the primary customer (ID type, scan or upload, MOI, email, phone). The actual user is named on the Supplementary Form, which the one CAF signature also signs. (Capability registry: "Actual User".)',
      source: 'src/capabilities/ActualUser/ActualUser.tsx',
      states: ['Not added', 'Adding: identification in progress', 'Identified (MOI validated), email and phone captured', 'Same as primary customer: blocked'],
      events: ['`onChange(value: ActualUserValue)`.'],
      usage: ['Needs the primary customer\'s `primaryIdNumber` / `primaryCustomerId` so the actual user cannot be the same person. An existing customer\'s changed email is written back to their record.'],
    }),
  },
  argTypes: { value: { control: false }, onChange: { control: false }, primaryIdNumber: { control: 'text', description: 'ID number of the primary customer.' }, primaryCustomerId: { control: 'text', description: 'Customer id of the primary customer.' } },
  args: { primaryIdNumber: '28456701234', primaryCustomerId: 'CUST-1001' },
} satisfies Meta<typeof ActualUser>;
export default meta;
type Story = StoryObj<typeof ActualUser>;

/** The app's own Capability Library preview. */
export const Default: Story = { render: () => <ActualUserPreview /> };

export const WithControls: Story = {
  render: (args) => {
    const [v, setV] = useState({});
    return <ActualUser value={v} onChange={setV} primaryIdNumber={args.primaryIdNumber} primaryCustomerId={args.primaryCustomerId} />;
  },
};
