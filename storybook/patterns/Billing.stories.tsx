import type { Meta, StoryObj } from '@storybook/react-vite';
import { billingStep } from '../../src/capabilities';
import { Billing } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Billing',
  component: Billing,
  parameters: {
    ...docsParameters({
      purpose: 'Set up what an order bills to, as the New Postpaid journey does: the customer\'s existing billing accounts, or Create New Billing Account (contact, billing address, payment, card on file, primary payment profile, billing profile setup, credit limit); an existing account is selected, or a new one created, automatically. (Capability registry: "Billing".)',
      source: 'src/capabilities/Billing/step.tsx (billingStep) and src/components/patterns/BillingAccountStep.tsx',
      states: ['Existing account auto-selected', 'No accounts: a new account is created automatically', 'Create New Billing Account form', 'Credit limit and VAT document shown for the customer'],
      events: ['The step writes its answers through the journey\'s `setValue` (`billing` field).'],
      usage: ['The capability is a wizard step builder (`billingStep()`): its `render` is the page and its `headless` resolver does the automatic selection, so the story mounts the step\'s own two functions with the values a journey would hold by then (CUST-1001 and an address from the Address step) - the same sample the Capability Library uses.'],
      restrictions: ['Billing cannot render without journey values (identified customer, address); the story seeds them as local state, never via `src/`.'],
    }),
  },
} satisfies Meta<typeof Billing>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The app's own Capability Library preview: the step with an identified customer who already has a billing account. */
export const Default: Story = { render: () => <Billing /> };

export const StepLabel: Story = {
  render: () => (
    <p className="body-text">
      The step is built by <code>billingStep()</code>: key <code>{billingStep().key}</code>, rail label <code>{billingStep().label}</code>.
    </p>
  ),
};
