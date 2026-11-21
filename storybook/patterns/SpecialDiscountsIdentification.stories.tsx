import type { Meta, StoryObj } from '@storybook/react-vite';
import { SpecialDiscountsIdentification } from '../../src/capabilities';
import { SpecialDiscountsId } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Special Discounts Identification',
  component: SpecialDiscountsIdentification,
  parameters: {
    ...docsParameters({
      purpose: 'The Special Discounts section of Mobile Postpaid Activation as its own capability: choose Consumer B2B2C, Retiree or MADA, supply the evidence (company, ID number, Office ID scan or upload) and accept or reject the benefit. Independent of Customer Verification and Customer Type; it draws the Office ID capture from the shared ID upload components. (Capability registry: "Special Discounts Identification".)',
      source: 'src/capabilities/SpecialDiscountsIdentification/SpecialDiscountsIdentification.tsx',
      states: ['Empty (no type chosen)', 'Type chosen, evidence being collected', 'Evidence captured: the benefit is accepted as soon as it is captured (no OK / Cancel)'],
      events: ['`onChange(value: SpecialDiscountsValue)` with the chosen type and evidence; optional `derivedCompany` (employer already on the MOI record) is the Consumer B2B2C starting point.'],
      usage: ['Mounted through `specialDiscountsIdentificationStep`. A validated Special Discount unlocks the "Special Offers" tab of Plan Selection.'],
      devices: ['"Initiate scan" and "Upload document" are offered on every device.'],
    }),
  },
  argTypes: { value: { control: false }, onChange: { control: false } },
} satisfies Meta<typeof SpecialDiscountsIdentification>;
export default meta;
type Story = StoryObj<typeof SpecialDiscountsIdentification>;

/** The app's own Capability Library preview. */
export const Default: Story = { render: () => <SpecialDiscountsId /> };
