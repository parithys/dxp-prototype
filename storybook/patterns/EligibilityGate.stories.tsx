import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent, within } from 'storybook/test';
import { Button } from 'dxp-ui';
import { EligibilityGateStep, EligibilityOutcomePanel, OutcomeActions } from '../../src/capabilities';
import type { EligibilityResult } from '../../src/components/domain/eligibilityTypes';
import { Eligibility } from '../../src/capabilities/previewDemos';
import { outcomePreviewActions } from '../../src/stores/outcomePreviewSlice';
import { store } from '../../src/stores/store';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Eligibility Gate',
  component: EligibilityGateStep,
  parameters: {
    ...docsParameters({
      purpose: 'Hard-stop / soft-stop / pass eligibility check shown after identification, with the outcome panel, checks report and footer actions. (Capability registry: "Eligibility gate".) Three parts: `EligibilityGateStep` (runs the checks for an ID and reports the result), `EligibilityOutcomePanel` (the blockers behind an outcome) and `OutcomeActions` (the footer\'s primary action by outcome).',
      source: 'src/capabilities/EligibilityGate/EligibilityGateStep.tsx, EligibilityOutcomes.tsx',
      variants: ['Clear: the ordinary Continue.', 'Approval Routing: ordinary Continue; approval is requested at submit.', 'Soft Stop (collections): "Continue Prepaid" and "Proceed to Payment", each behind a confirmation.', 'Hard Stop: no footer action (Abandon Order is in the page header); an under-18 applicant gets "Apply for Exception".', 'Advisory Only (HRN): ordinary Continue.'],
      states: ['Checking (loading)', 'Pass', 'Soft stop', 'Hard stop', 'Approval routing'],
      events: ['`onResult(result | undefined)` with the `EligibilityResult` (`pass`, `hardStop`, `softStop`, `checks`, ...).', '`onProceedToApproval`, `onSwitchToPrepaid`.'],
      usage: ['Each preview scenario is a test customer whose result is that outcome: Clear 28456701234, Approval Routing P0998812, Soft Stop 29011122233, Hard Stop DIP-QA-004521.'],
    }),
  },
  argTypes: { idNumber: { control: 'text', description: 'The identified customer\'s ID number; the checks run for it.' }, onResult: { control: false }, result: { control: false } },
} satisfies Meta<typeof EligibilityGateStep>;
export default meta;
type Story = StoryObj<typeof EligibilityGateStep>;

/** The app's own Capability Library preview with its four scenarios. */
export const Default: Story = { render: () => <Eligibility /> };

function Scenario({ idNumber }: { idNumber: string }) {
  const [r, setR] = useState<EligibilityResult | undefined>(undefined);
  return (
    <div className="space-y-4">
      <EligibilityGateStep idNumber={idNumber} result={r} onResult={setR} announcePass={false} scope="product" />
      <div className="row justify-end divider-top pt-4">
        <OutcomeActions eligibility={r} defaultButton={<Button>Continue</Button>} />
      </div>
    </div>
  );
}
export const Clear: Story = { render: () => <Scenario idNumber="28456701234" /> };
export const ApprovalRouting: Story = { render: () => <Scenario idNumber="P0998812" /> };
export const SoftStop: Story = { render: () => <Scenario idNumber="29011122233" /> };
export const HardStop: Story = { render: () => <Scenario idNumber="DIP-QA-004521" /> };

/** The Eligibility step's inline blockers panel, driven by the outcome the footer links pick (outcomePreviewSlice). */
function OpenOutcome({ outcome, children }: { outcome: 'Hard Stop' | 'Soft Stop' | 'Approval Routing' | 'Advisory Only'; children: ReactNode }) {
  useEffect(() => {
    store.dispatch(outcomePreviewActions.close());
    store.dispatch(outcomePreviewActions.toggle(outcome));
    return () => void store.dispatch(outcomePreviewActions.close());
  }, [outcome]);
  return <>{children}</>;
}
const withOutcome = (outcome: 'Hard Stop' | 'Soft Stop' | 'Approval Routing' | 'Advisory Only'): Decorator => (Story) => (
  <OpenOutcome outcome={outcome}>
    <Story />
  </OpenOutcome>
);
export const OutcomePanelHardStop: Story = {
  decorators: [withOutcome('Hard Stop')],
  render: () => <EligibilityOutcomePanel />,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('region', { name: 'Hard Stop blockers' })).toBeInTheDocument();
  },
};
export const OutcomePanelSoftStop: Story = { decorators: [withOutcome('Soft Stop')], render: () => <EligibilityOutcomePanel /> };
export const OutcomePanelApprovalRouting: Story = { decorators: [withOutcome('Approval Routing')], render: () => <EligibilityOutcomePanel /> };

const SOFT: EligibilityResult = { pass: false, hardStop: false, softStop: true, checks: [], blacklisted: true, lineCapExceeded: false, requiresHrnAdvance: false, defaultCreditLimitQar: 1000, idNumber: '29011122233' };
const HARD: EligibilityResult = { ...SOFT, softStop: false, hardStop: true };
const CLEAR: EligibilityResult = { ...SOFT, pass: true, softStop: false, blacklisted: false };

export const FooterActionsSoftStop: Story = {
  render: () => <OutcomeActions eligibility={SOFT} defaultButton={<Button>Continue</Button>} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Continue' })).toBeNull();
    await userEvent.click(await canvas.findByRole('button', { name: 'Proceed to Payment' }));
    await expect(await screen.findByText('Proceed to Payment?')).toBeInTheDocument();
  },
};
export const FooterActionsHardStop: Story = {
  render: () => <OutcomeActions eligibility={HARD} defaultButton={<Button>Continue</Button>} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryAllByRole('button')).toHaveLength(0);
  },
};
export const FooterActionsClear: Story = {
  render: () => <OutcomeActions eligibility={CLEAR} defaultButton={<Button>Continue</Button>} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Continue' })).toBeEnabled();
  },
};
