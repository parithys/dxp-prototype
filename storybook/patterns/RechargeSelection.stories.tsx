import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RechargeSelection } from '../../src/capabilities';
import { Recharges } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Recharge Selection',
  component: RechargeSelection,
  parameters: {
    ...docsParameters({
      purpose: 'Choose the recharge of a prepaid subscription: the recharge products by category (Combo+, Flex, Credit, Data, International, Roamers, Visitors) as selectable cards, with what the choice does to the SIM card charge. Whether a recharge is mandatory is the journey\'s rule. (Capability registry: "Recharge Selection".)',
      source: 'src/capabilities/RechargeSelection/RechargeSelection.tsx',
      variants: ['`idType="QID"`: SIM card charge waived at a recharge of 20.', '`idType="Passport"`: waived at 35.'],
      states: ['Nothing chosen', 'Recharge chosen (selected card)', 'Chosen again to clear'],
      events: ['`onChange(id | undefined)`.'],
      restrictions: ['The catalogue is a sample until the real one is supplied.'],
    }),
  },
  argTypes: { idType: { control: 'select', options: ['QID', 'Passport'], description: 'ID type of the customer; decides the SIM card charge waiver threshold.' }, value: { control: false }, onChange: { control: false } },
} satisfies Meta<typeof RechargeSelection>;
export default meta;
type Story = StoryObj<typeof RechargeSelection>;

function Host({ idType }: { idType: 'QID' | 'Passport' }) {
  const [id, setId] = useState<string | undefined>();
  return <RechargeSelection value={id} onChange={setId} idType={idType} />;
}

/** The app's own Capability Library preview, with its QID / Passport switcher. */
export const Default: Story = { render: () => <Recharges /> };
export const QidWaivedAt20: Story = { render: () => <Host idType="QID" /> };
export const PassportWaivedAt35: Story = { render: () => <Host idType="Passport" /> };
