import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CustomerTypeStep } from '../../src/capabilities';
import { CustomerType } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Customer Type',
  component: CustomerTypeStep,
  parameters: {
    ...docsParameters({
      purpose: 'Special customer types (retired, MADA, B2B2C): the evidence the agent collects, the rules for accepting or rejecting the benefit, and the customer\'s benefits. (Capability registry: "Customer Type & Discounts".)',
      source: 'src/capabilities/CustomerType/CustomerTypeStep.tsx',
      states: ['No type chosen', 'Type chosen with evidence being collected', 'Benefit accepted', 'Benefit rejected'],
      events: ['`onChange(value)` - the chosen type, its evidence and the decision.'],
      usage: ['Distinct from Special Discounts Identification (its own step and model); use that one for the Mobile Postpaid Activation journey.'],
    }),
  },
  argTypes: { value: { control: false }, onChange: { control: false } },
} satisfies Meta<typeof CustomerTypeStep>;
export default meta;
type Story = StoryObj<typeof CustomerTypeStep>;

/** The app's own Capability Library preview. */
export const Default: Story = { render: () => <CustomerType /> };

export const Controlled: Story = {
  render: () => {
    const [v, setV] = useState<Parameters<typeof CustomerTypeStep>[0]['value']>({});
    return <CustomerTypeStep value={v} onChange={setV} />;
  },
};
