import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { customerQualificationStep, representativeHeaderAction } from '../../src/capabilities';
import { Qualification } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Customer Qualification',
  component: Qualification,
  parameters: {
    ...docsParameters({
      purpose: 'Identify the customer, run eligibility, then offer the special-discount types - the whole "Customer Verification" step of an activation, with its outcomes and footer actions. (Capability registry: "Customer Qualification".) Composes Customer Identification, the Eligibility Gate and Special Discounts; includes the Customer Representative scenario.',
      source: 'src/capabilities/CustomerQualification/step.tsx (customerQualificationStep), representativeStep.tsx, RepresentativeToggle.tsx',
      variants: ['Walk-in (`flow: \'new\'`) or existing customer (`flow: \'existing\'` + `existingCustomerId`).', '`productAgnostic`, `journeyType` (postpaid / prepaid), `manualEntry`, `knownCustomer`, `skipLineLimit`, `requestKind`.', 'Customer Representative: the checkbox at the right of the Contact heading swaps in the dedicated Customer Representative page (an authorised person acts for the actual customer); no Secondary Contact is then possible.'],
      states: ['Awaiting identification', 'Identified, eligibility running', 'Clear (Continue)', 'Approval routing (Proceed to Approval)', 'Soft stop', 'Hard stop (message, no way on)'],
      events: ['The step is a `WizardStep`: it reports through the wizard\'s `values.contact`, `values.eligibility`, `values.customerRepresentative`.'],
      usage: ['The story is the capability on the real wizard as a one-step journey, so the outcomes and footer actions work as in New Connection. A scan or a typed ID of a test customer runs the checks.'],
      restrictions: ['It needs the wizard shell (footer outcome actions, draft values), so it is shown inside `GuidedActivationWizard`; the draft is cleared on the way in and out.'],
    }),
  },
} satisfies Meta<typeof Qualification>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The app's own Capability Library preview: Customer Qualification on the real wizard. */
export const Default: Story = { render: () => <Qualification /> };

function RepresentativeToggleHost() {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const setValue = (field: string, value: unknown) => setValues((v) => ({ ...v, [field]: value }));
  return (
    <div className="stack gap-3">
      {representativeHeaderAction({ values, setValue })}
      <p className="caption-muted">customerRepresentative: {JSON.stringify(values.customerRepresentative ?? null)}</p>
    </div>
  );
}
/** The Customer Representative checkbox as the Contact step puts it in the title row; ticking it records `customerRepresentative: { enabled: true }` and clears the contact and eligibility. */
export const CustomerRepresentativeToggle: Story = {
  render: () => <RepresentativeToggleHost />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole('checkbox', { name: 'Customer Representative' });
    await expect(box).not.toBeChecked();
    await userEvent.click(box);
    await expect(box).toBeChecked();
    await expect(canvas.getByText(/"enabled":true/)).toBeInTheDocument();
  },
};

export const StepDefinition: Story = {
  render: () => {
    const step = customerQualificationStep({ flow: 'new', existingCustomerId: undefined, guardedContactChange: () => {}, productAgnostic: true });
    return (
      <p className="body-text">
        <code>customerQualificationStep()</code> returns the wizard step with key <code>{step.key}</code> and rail label <code>{step.label}</code>.
      </p>
    );
  },
};
