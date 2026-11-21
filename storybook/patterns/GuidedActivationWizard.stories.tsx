import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { GuidedActivationWizard } from '../../src/capabilities';
import type { WizardStep } from '../../src/components/patterns/wizard/guidedWizardTypes';
import { Input } from 'dxp-ui';
import { Wizard } from '../../src/capabilities/previewDemos';
import { notificationActions } from '../../src/stores/notificationSlice';
import { workflowActions } from '../../src/stores/workflowSlice';
import { store } from '../../src/stores/store';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Guided Activation Wizard',
  component: GuidedActivationWizard,
  parameters: {
    ...docsParameters({
      purpose: 'The step shell every activation / migration / port-in journey runs in: the step list (rail), the step card, the running Journey Summary panel, the Back / Continue footer, draft saving and the leave / abandon prompts. (Capability registry: "Guided activation wizard".) The parts it is built from are documented under Patterns/Wizard Parts.',
      source: 'src/capabilities/GuidedActivationWizard/GuidedActivationWizard.tsx',
      variants: ['`fixedFooter` - the action bar fixed to the viewport (journeys) or inline (the stories).', '`allowCustomerView` - the Customer view button that mirrors the current step to a pop-up.', '`titleAside`, `belowPanel`, `showSelectedAddonsTray`, `hideTitleBand`, `hideAbandonFrom`, `milestones`.', 'Per step (`WizardStep`): `isValid`, `skip`, `autoPass`, `locksAfter`, `summary`, `primaryAction`, `footerLeft`, `headerAction`, `customerFacing`.'],
      states: ['First step (no Back)', 'Step invalid (Continue disabled)', 'Step valid (Continue enabled)', 'Last step (Continue becomes "Save & Finish")', 'Submitting', 'Locked after a step (Back and the rail frozen, no editing from the Summary)', 'Resumed from a draft'],
      events: ['`onSubmit(values)` on the last step\'s Save & Finish.', '`onAbandon()`, `onSaveExit()`.'],
      usage: ['A step is data: `{ key, label, render({ values, setValue, goNext, goToStepKey, ... }), isValid, summary }`. The wizard keeps one draft-values object, which every step reads and writes and the Summary derives from.', 'The `wizardId` keys the draft in the workflow store; the stories clear it on the way in and out so nothing is left behind.'],
      accessibility: ['The Summary announces "Summary updated" through a polite live region; each section is a disclosure button with `aria-expanded`.'],
      devices: ['The Customer view pop-up and the tablet footer behave per device; use the toolbar **Device** switch.'],
    }),
  },
  argTypes: { title: { control: 'text', description: 'Page title.' }, fixedFooter: { control: 'boolean', description: 'Fix the action bar to the viewport.' }, confirmLeave: { control: 'boolean', description: 'Prompt before leaving a dirty journey.' }, steps: { control: false }, onSubmit: { control: false } },
} satisfies Meta<typeof GuidedActivationWizard>;
export default meta;
type Story = StoryObj<typeof GuidedActivationWizard>;

const nextButton = (canvas: ReturnType<typeof within>) => canvas.getByRole('button', { name: /^(Continue|Save & Finish)/ });

/** The app's own Capability Library preview: three sample steps (Customer Verification, Offers & Plans, Checkout). */
export const Default: Story = { render: () => <Wizard /> };

/** Steps through the three steps: Continue follows `isValid`, Back appears after the first step, the last step reads Save & Finish. */
export const StepThrough: Story = {
  render: () => <Wizard />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(nextButton(canvas)).toBeDisabled();
    await expect(canvas.queryByRole('button', { name: /^Back/ })).toBeNull();
    await userEvent.type(canvas.getByRole('textbox', { name: /ID Number/ }), '28456701234');
    await expect(nextButton(canvas)).toBeDisabled();
    await userEvent.type(canvas.getByRole('textbox', { name: /Full Name/ }), 'Sample Customer');
    await expect(nextButton(canvas)).toBeEnabled();
    await userEvent.click(nextButton(canvas));
    // Step 2: nothing chosen yet, so Continue is disabled again; Back is now offered.
    await expect(await canvas.findByRole('button', { name: /Postpaid Essential/ })).toBeInTheDocument();
    await expect(nextButton(canvas)).toBeDisabled();
    await expect(canvas.getByRole('button', { name: /^Back/ })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: /Postpaid Plus/ }));
    await expect(nextButton(canvas)).toBeEnabled();
    await userEvent.click(nextButton(canvas));
    // Last step: Continue becomes Save & Finish.
    await expect(await canvas.findByRole('button', { name: /^Save & Finish/ })).toBeEnabled();
    // Back returns to the plan step with the choice kept.
    await userEvent.click(canvas.getByRole('button', { name: /^Back/ }));
    await expect(await canvas.findByRole('button', { name: /Postpaid Plus/ })).toHaveAttribute('aria-pressed', 'true');
  },
};

const FLAGS_WIZARD_ID = 'storybook-wizard-flags';
function FlagSteps({ locked, skipMiddle }: { locked: boolean; skipMiddle: boolean }) {
  useEffect(() => {
    store.dispatch(workflowActions.clearDraft(FLAGS_WIZARD_ID));
    return () => void store.dispatch(workflowActions.clearDraft(FLAGS_WIZARD_ID));
  }, []);
  const steps: WizardStep[] = [
    {
      key: 'one',
      label: 'Step One',
      render: ({ values, setValue }) => <Input label="Answer" value={(values.answer as string) ?? ''} onChange={(e) => setValue('answer', e.target.value)} />,
      isValid: (v) => Boolean(v.answer),
      summary: [{ key: 'answer', label: 'Answer', type: 'text', value: (v) => v.answer }],
    },
    { key: 'two', label: 'Step Two', render: () => <p className="text-secondary">Skipped when the answer is "skip".</p>, skip: (v) => skipMiddle && v.answer === 'skip', locksAfter: locked ? () => true : undefined },
    { key: 'three', label: 'Step Three', render: () => <p className="text-secondary">The last step.</p> },
  ];
  return (
    <GuidedActivationWizard
      wizardId={FLAGS_WIZARD_ID}
      fixedFooter={false}
      title="Step Flags"
      confirmLeave={false}
      steps={steps}
      onSubmit={() => {
        store.dispatch(notificationActions.pushToast('success', 'Submitted.'));
        store.dispatch(workflowActions.clearDraft(FLAGS_WIZARD_ID));
      }}
    />
  );
}

/** `skip`: a step removed from the journey by the draft (type "skip" in step one: step two is not visited). */
export const SkippedStep: Story = {
  render: () => <FlagSteps locked={false} skipMiddle />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: /Answer/ }), 'skip');
    await userEvent.click(nextButton(canvas));
    await expect(await canvas.findByText('The last step.')).toBeInTheDocument();
  },
};

/** `locksAfter`: once step two is passed the journey locks - Back disappears from the footer and the Summary offers no Edit. */
export const LockedAfterStep: Story = {
  render: () => <FlagSteps locked skipMiddle={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: /Answer/ }), 'x');
    await userEvent.click(nextButton(canvas));
    await userEvent.click(await canvas.findByRole('button', { name: /^Continue/ }));
    await expect(await canvas.findByText('The last step.')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Back/ })).toBeNull();
  },
};
