import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button, Input } from 'dxp-ui';
import { WizardFooter } from '../../src/components/patterns/wizard/WizardFooter';
import { WizardStepPanel } from '../../src/components/patterns/wizard/WizardStepPanel';
import { StepSummaryPanel } from '../../src/components/patterns/wizard/StepSummaryPanel';
import { StepSummarySection } from '../../src/components/patterns/wizard/StepSummarySection';
import { SummaryFieldRow } from '../../src/components/patterns/wizard/SummaryFieldRow';
import { CustomerMirrorPanel } from '../../src/components/patterns/wizard/CustomerMirrorPanel';
import { maskAllButLast4 } from '../../src/components/patterns/wizard/stepSummary';
import type { WizardStep } from '../../src/components/patterns/wizard/guidedWizardTypes';
import { docsParameters } from '../_shared/docs';
import { Column } from '../_shared/layout';

const meta = {
  title: 'Patterns/Wizard Parts',
  component: WizardFooter,
  parameters: {
    ...docsParameters({
      purpose: 'The parts the Guided Activation Wizard is built from, shown on their own: WizardFooter (Back / Continue), WizardStepPanel (the step page body), StepSummaryPanel + StepSummarySection + SummaryFieldRow (the running Journey Summary) and CustomerMirrorPanel (the customer\'s pop-up view of the current step). The main story is Patterns/Guided Activation Wizard.',
      source: 'src/components/patterns/wizard/ (WizardFooter, WizardStepPanel, StepSummaryPanel, StepSummarySection, SummaryFieldRow, CustomerMirrorPanel)',
      states: ['Footer: first / middle / last step, invalid (disabled), submitting, locked (no Back)', 'Summary section: collapsed, expanded, current (name only), not completed (a link back to it)', 'Field row: filled, empty ("Not provided"), long list ("a, b, c +2 more" with Show all)', 'Mirror panel: read-only or interactive (the CAF step)'],
      usage: ['These are internals of the wizard shell; journeys never mount them. A step declares what the Summary echoes through its `summary` fields.'],
    }),
  },
  argTypes: { currentIndex: { control: 'number' }, stepCount: { control: 'number' }, canProceed: { control: 'boolean', description: 'The step is valid: Continue is enabled.' }, isLocked: { control: 'boolean', description: 'Journey locked: Back is removed.' }, submitting: { control: 'boolean' }, fixedToViewport: { control: 'boolean' }, goBack: { control: false }, goNext: { control: false }, setValue: { control: false }, onAbandonStep: { control: false }, currentStep: { control: false }, values: { control: false } },
  args: { fixedToViewport: false, currentStep: { key: 'sample', label: 'Sample', render: () => null }, currentIndex: 1, stepCount: 3, values: {}, isLocked: false, canProceed: true, submitting: false, goBack: fn(), goNext: fn(async () => {}), setValue: fn(), onAbandonStep: fn() },
} satisfies Meta<typeof WizardFooter>;
export default meta;
type Story = StoryObj<typeof meta>;

const next = (canvas: ReturnType<typeof within>) => canvas.getByRole('button', { name: /^(Continue|Save & Finish|Submitting)/ });

export const Default: Story = {};
export const FirstStep: Story = {
  args: { currentIndex: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /^Back/ })).toBeNull();
    await expect(next(canvas)).toHaveTextContent('Continue');
  },
};
export const LastStep: Story = {
  args: { currentIndex: 2 },
  play: async ({ canvasElement }) => {
    await expect(next(within(canvasElement))).toHaveTextContent('Save & Finish');
  },
};
export const StepInvalid: Story = {
  args: { canProceed: false },
  play: async ({ canvasElement }) => {
    await expect(next(within(canvasElement))).toBeDisabled();
  },
};
export const Submitting: Story = {
  args: { currentIndex: 2, submitting: true },
  play: async ({ canvasElement }) => {
    const button = next(within(canvasElement));
    await expect(button).toHaveTextContent('Submitting');
    await expect(button).toBeDisabled();
  },
};
export const Locked: Story = {
  args: { isLocked: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: /^Back/ })).toBeNull();
  },
};
export const BackAndContinueCallbacks: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^Back/ }));
    await userEvent.click(next(canvas));
    await expect(args.goBack).toHaveBeenCalled();
    await expect(args.goNext).toHaveBeenCalled();
  },
};
export const CustomActions: Story = {
  args: {
    currentStep: {
      key: 'custom',
      label: 'Custom',
      render: () => null,
      footerLeft: () => <Button variant="tertiary">Footer left link</Button>,
      primaryAction: ({ defaultButton }) => (
        <div className="row">
          <Button variant="secondary">Secondary action</Button>
          {defaultButton}
        </div>
      ),
    },
  },
};

/** The footer on a live step: Continue follows the step's own `isValid`, as the wizard wires it. */
export const FollowsStepValidity: Story = {
  render: (args) => {
    const step: WizardStep = { key: 'v', label: 'V', render: () => null, isValid: (v) => Boolean(v.name) };
    const [values, setValues] = useState<Record<string, unknown>>({});
    return (
      <div className="stack gap-4">
        <Input label="Name" value={(values.name as string) ?? ''} onChange={(e) => setValues({ name: e.target.value })} />
        <WizardFooter {...args} currentStep={step} values={values} canProceed={step.isValid?.(values) ?? true} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(next(canvas)).toBeDisabled();
    await userEvent.type(canvas.getByRole('textbox', { name: /Name/ }), 'Sample');
    await expect(next(canvas)).toBeEnabled();
    await userEvent.clear(canvas.getByRole('textbox', { name: /Name/ }));
    await expect(next(canvas)).toBeDisabled();
  },
};

/* ---- WizardStepPanel --------------------------------------------------------------------------------------------------------------- */
export const StepPanelLayout: StoryObj<typeof WizardStepPanel> = {
  render: () => (
    <WizardStepPanel
      bottomClass="pb-4"
      above={<p className="caption-muted mx-8 mt-4">Above the card (a step's own `aboveCard`)</p>}
      below={<p className="caption-muted mx-8">Under the card (below-panel slot)</p>}
      aside={<aside className="card p-4 w-72 m-8">The Journey Summary column</aside>}
    >
      <h2 className="title title-xl">Step heading</h2>
      <p className="text-secondary mt-2">The step card: 32px from the page edges, 24px padding.</p>
    </WizardStepPanel>
  ),
};

/* ---- Journey Summary ---------------------------------------------------------------------------------------------------------------- */
const SUMMARY_STEPS: WizardStep[] = [
  { key: 'contact', label: 'Customer Verification', render: () => null, summary: [{ key: 'id', label: 'ID Number', type: 'text', sensitive: true, value: (v) => v.idNumber }, { key: 'name', label: 'Name', type: 'text', value: (v) => v.name }] },
  { key: 'plan', label: 'Offers & Plans', render: () => null, summary: [{ key: 'plan', label: 'Plan', type: 'select', options: { essential: 'Postpaid Essential' }, value: (v) => v.plan }, { key: 'addons', label: 'Add-ons', type: 'multi', value: (v) => v.addons }] },
  { key: 'checkout', label: 'Checkout', render: () => null },
];
const VALUES = { idNumber: '28456701234', name: 'Sample Customer', plan: 'essential', addons: ['Data 5GB', 'Roaming', 'Music', 'Caller Tune', 'Insurance'] };

export const JourneySummary: StoryObj<typeof StepSummaryPanel> = {
  render: () => (
    <StepSummaryPanel
      completed={[{ index: 0, step: SUMMARY_STEPS[0] }, { index: 1, step: SUMMARY_STEPS[1] }]}
      current={{ index: 2, step: SUMMARY_STEPS[2] }}
      totalSteps={3}
      values={VALUES}
      onEdit={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(maskAllButLast4('28456701234'))).toBeNull();
    // The name also matches "Edit Customer Verification": the disclosure is the button with aria-expanded.
    await userEvent.click(canvas.getAllByRole('button', { name: /Customer Verification/ }).find((b: HTMLElement) => b.hasAttribute('aria-expanded')) as HTMLElement);
    // The ID number is sensitive: masked to its last four digits.
    await expect(await canvas.findByText(maskAllButLast4('28456701234'))).toBeInTheDocument();
    await expect(canvas.getByText('Sample Customer')).toBeInTheDocument();
  },
};
export const JourneySummaryEmpty: StoryObj<typeof StepSummaryPanel> = { render: () => <StepSummaryPanel completed={[]} totalSteps={3} values={{}} /> };
export const JourneySummaryLocked: StoryObj<typeof StepSummaryPanel> = {
  name: 'Journey Summary (no Edit: locked journey)',
  render: () => <StepSummaryPanel completed={[{ index: 0, step: SUMMARY_STEPS[0] }]} totalSteps={3} values={VALUES} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: /^Edit/ })).toBeNull();
  },
};
export const JourneySummaryAccordion: StoryObj<typeof StepSummaryPanel> = {
  name: 'Journey Summary (accordion, small screens)',
  parameters: { viewport: { defaultViewport: 'mobile' } },
  render: () => <StepSummaryPanel variant="accordion" completed={[{ index: 0, step: SUMMARY_STEPS[0] }]} totalSteps={3} values={VALUES} />,
};

function SectionHost({ state }: { state: 'completed' | 'current' | 'pending' }) {
  const [open, setOpen] = useState(false);
  return (
    <StepSummarySection title="Offers & Plans" open={open} onToggle={() => setOpen((o) => !o)} onEdit={state === 'completed' ? fn() : undefined} current={state === 'current'} onGo={state === 'pending' ? fn() : undefined}>
      <SummaryFieldRow label="Plan" value={{ text: 'Postpaid Essential', empty: false }} />
    </StepSummarySection>
  );
}
export const SummarySections: StoryObj<typeof StepSummarySection> = {
  render: () => (
    <Column>
      <SectionHost state="completed" />
      <SectionHost state="current" />
      <SectionHost state="pending" />
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggles = canvas.getAllByRole('button', { name: /Offers & Plans/ });
    await expect(toggles[0]).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggles[0]);
    await expect(toggles[0]).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('Postpaid Essential')).toBeInTheDocument();
  },
};

export const SummaryRows: StoryObj<typeof SummaryFieldRow> = {
  render: () => (
    <dl className="card p-4">
      <SummaryFieldRow label="Plan" value={{ text: 'Postpaid Essential', empty: false }} />
      <SummaryFieldRow label="Secondary Contact" value={{ text: 'Not provided', empty: true }} />
      <SummaryFieldRow label="Add-ons" value={{ text: 'Data 5GB, Roaming, Music +2 more', fullList: ['Data 5GB', 'Roaming', 'Music', 'Caller Tune', 'Insurance'], empty: false }} />
    </dl>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Show all' }));
    await expect(canvas.getByText(/Data 5GB, Roaming, Music, Caller Tune, Insurance/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Show less' }));
    await expect(canvas.getByText(/Music \+2 more/)).toBeInTheDocument();
  },
};

/* ---- Customer mirror ---------------------------------------------------------------------------------------------------------------- */
const MIRROR_STEP: WizardStep = {
  key: 'caf',
  label: 'CAF & Signature',
  heading: 'Customer Agreement Form',
  subheading: 'Read and sign.',
  render: ({ values, setValue }) => <Input label="Customer name" value={(values.name as string) ?? ''} onChange={(e) => setValue('name', e.target.value)} />,
};
function MirrorHost({ interactive }: { interactive: boolean }) {
  const [values, setValues] = useState<Record<string, unknown>>({ name: 'Sample Customer' });
  return <CustomerMirrorPanel step={MIRROR_STEP} values={values} interactive={interactive} onSetValue={(f, v) => setValues((s) => ({ ...s, [f]: v }))} />;
}
/** The customer's pop-up: the step in the agent's own card, with no agent controls. Read only except the CAF step. */
export const CustomerMirrorReadOnly: StoryObj<typeof CustomerMirrorPanel> = { render: () => <MirrorHost interactive={false} /> };
export const CustomerMirrorInteractive: StoryObj<typeof CustomerMirrorPanel> = {
  render: () => <MirrorHost interactive />,
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole('textbox', { name: /Customer name/ });
    await userEvent.clear(box);
    await userEvent.type(box, 'Changed');
    await expect(box).toHaveValue('Changed');
  },
};
