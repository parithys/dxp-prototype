import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { CrossSalesStep } from '../../src/capabilities';
import { CrossSell } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Cross-sell Offers',
  component: CrossSalesStep,
  parameters: {
    ...docsParameters({
      purpose: 'Recommended offers for the identified customer: offer cards, details drawer, interested (lead) and select actions, and hand-off to the other journeys. (Capability registry: "Recommended Offers".)',
      source: 'src/capabilities/CrossSellOffers/CrossSalesStep.tsx',
      states: ['No offer chosen', 'Offer chosen', 'Marked interested (lead)', 'Details drawer open', 'No offers for the customer'],
      events: ['`onChange(value)`.', '`onHandOff()` - the agent leaves for the offer\'s own journey.'],
      usage: ['The step before Plan Selection in the activation journeys; `journey` names the journey it is mounted in (the preview uses "new-postpaid") and `customerId` the identified customer.'],
    }),
  },
  argTypes: { customerId: { control: 'text', description: 'The identified customer.' }, value: { control: false }, onChange: { control: false }, onHandOff: { control: false } },
  args: { customerId: 'CUST-1001', onHandOff: fn() },
} satisfies Meta<typeof CrossSalesStep>;
export default meta;
type Story = StoryObj<typeof CrossSalesStep>;

/** The app's own Capability Library preview. */
export const Default: Story = { render: () => <CrossSell /> };

export const ForAnotherCustomer: Story = {
  args: { customerId: 'CUST-1002' },
  render: (args) => {
    const [v, setV] = useState<Parameters<typeof CrossSalesStep>[0]['value']>({});
    return <CrossSalesStep customerId={args.customerId} value={v} onChange={setV} onHandOff={() => {}} journey="new-postpaid" />;
  },
};
