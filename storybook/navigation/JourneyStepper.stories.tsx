import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { StepSummaryPanel } from '../../src/components/patterns/wizard/StepSummaryPanel';
import { StepSummarySection } from '../../src/components/patterns/wizard/StepSummarySection';
import type { WizardStep } from '../../src/components/patterns/wizard/guidedWizardTypes';
import { stepIcon } from '../../src/assets/icons/stepIcons';
import { store } from '../../src/stores/store';
import { summaryPanelActions } from '../../src/stores/summaryPanelSlice';
import { docsParameters } from '../_shared/docs';
import { Column, Specimen } from '../_shared/layout';

// Plain fixtures: a step is a key, a label and what to echo back from the draft values. Keys are real step keys so stepIcon() finds the app's icons.
const field = (key: string, label: string) => ({ key, label, type: 'text' as const, value: (v: Record<string, unknown>) => v[key] });
const STEPS: WizardStep[] = [
  { key: 'contact', label: 'Contact', render: () => null, summary: [field('name', 'Name'), field('phone', 'Mobile number')] },
  { key: 'address', label: 'Address', render: () => null, summary: [field('city', 'City')] },
  { key: 'plan', label: 'Plan & Add-ons', render: () => null, summary: [field('planName', 'Plan')] },
  { key: 'checkout', label: 'Checkout', render: () => null, summary: [field('total', 'Total')] },
];
const VALUES = { name: 'Aisha Al-Thani', phone: '5551 2345', city: 'Doha', planName: 'Red 300' };
const entry = (i: number) => ({ index: i, step: STEPS[i] });

const meta = {
  title: 'Navigation/Journey Stepper',
  component: StepSummaryPanel,
  parameters: {
    layout: 'padded',
    ...docsParameters({
      purpose:
        'The journey rail of the guided wizards: the "Journey Summary" panel lists the steps already completed (each with its entered values and an Edit action), the step on screen (marked current) and, after going back to edit, a pending step that jumps straight to where the agent was.',
      source: 'src/components/patterns/wizard/StepSummaryPanel.tsx, StepSummarySection.tsx, src/assets/icons/stepIcons.ts (stepIcon)',
      variants: ['variant "aside" (default): the fixed side card, expanded (w-80) or collapsed to an icon rail.', 'variant "accordion": the collapsible "Journey Summary" block shown above the action buttons below lg.'],
      states: [
        'Completed: its own step icon in the muted tone, a collapsible details block and an Edit action.',
        'Current: tinted band, accent icon, aria-current="step", no details or Edit.',
        'Upcoming: not listed. The panel lists reached steps only; the count reads "N of M steps completed".',
        'Pending (returnTo): a step reached earlier but not on screen, shown as a link with "(not completed)" for assistive tech.',
        'Milestone: a flag in place of the tick (milestoneSteps).',
        'Locked journey: no `onEdit`, so no Edit actions. There is no Disabled or Error state in this component.',
      ],
      events: ['onEdit(index): go back to a completed step.', 'returnTo.onReturn(): jump to the furthest step reached.', 'The collapsed / expanded choice is stored in Redux (summaryPanel) and remembered.'],
      usage: ['This is a summary rail, not a clickable stepper for future steps: the agent can only revisit steps already reached.'],
      accessibility: [
        'An <aside> labelled "Summary of completed steps"; the collapsed rail is a nav "Journey steps"; a polite status region announces "Summary updated: N of M steps completed" and the current step.',
        'Section toggles are buttons with aria-expanded / aria-controls; collapsed icon-only rows have a tooltip and an aria-label.',
      ],
      devices: ['The aside is for lg and up; below lg the accordion variant is used (Tablet and Mobile stories).'],
    }),
  },
  argTypes: {
    variant: { control: 'select', options: ['aside', 'accordion'], description: 'Side card, or the collapsible block for small screens.' },
    totalSteps: { control: { type: 'number', min: 1 }, description: 'Steps in the journey ("N of M steps completed").' },
    completed: { control: false, description: 'Completed steps that declare a summary, in order.' },
    current: { control: false, description: 'The step on screen.' },
    values: { control: 'object', description: 'The wizard\'s draft values the summaries read.' },
    onEdit: { control: false },
    returnTo: { control: false },
    milestoneSteps: { control: false },
  },
  args: { completed: [entry(0), entry(1)], current: entry(2), totalSteps: 4, values: VALUES, onEdit: fn(), variant: 'aside' },
  decorators: [
    (Story) => {
      if (store.getState().summaryPanel.collapsed) store.dispatch(summaryPanelActions.toggleCollapsed());
      return <Story />;
    },
  ],
} satisfies Meta<typeof StepSummaryPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText('2 of 4 steps completed', { exact: false })).toBeInTheDocument();
  },
};

export const CurrentStep: Story = {
  name: 'Current step',
  play: async ({ canvasElement }) => {
    const current = canvasElement.querySelector('[aria-current="step"]');
    await expect(current).not.toBeNull();
    await expect(current).toHaveTextContent('Plan & Add-ons');
  },
};

export const CompletedStepExpanded: Story = {
  name: 'Completed: details expanded',
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    // "Contact" also matches the "Edit Contact" button: the disclosure is the one with aria-expanded.
    const toggle = c.getAllByRole('button', { name: /Contact/ }).find((b: HTMLElement) => b.hasAttribute('aria-expanded')) as HTMLElement;
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // Contact echoes its own fields (Doha belongs to the Address step, still collapsed).
    await expect(c.getByText('Aisha Al-Thani')).toBeVisible();
    await expect(c.getByText('5551 2345')).toBeVisible();
  },
};

export const EditCompleted: Story = {
  name: 'Edit a completed step',
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getAllByRole('button', { name: /Edit/ })[0]);
    await expect(args.onEdit).toHaveBeenCalledWith(0);
  },
};

export const Empty: Story = {
  name: 'Empty (nothing completed)',
  args: { completed: [], current: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Your details will appear here/)).toBeInTheDocument();
  },
};

export const FirstStepCurrent: Story = {
  args: { completed: [], current: entry(0), totalSteps: 4 },
};

export const AllCompleted: Story = {
  args: { completed: [entry(0), entry(1), entry(2)], current: entry(3), totalSteps: 4 },
};

export const Locked: Story = {
  name: 'Locked (no Edit)',
  args: { onEdit: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: /Edit/ })).toBeNull();
  },
};

export const Milestone: Story = {
  name: 'Milestone reached',
  args: { milestoneSteps: new Set(['contact']) },
};

export const AfterGoingBack: Story = {
  name: 'Pending step after editing (returnTo)',
  args: { completed: [entry(0)], current: entry(1), returnTo: { label: 'Plan & Add-ons', key: 'plan', index: 2, onReturn: fn() } },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: /Plan & Add-ons/ }));
    await expect(args.returnTo?.onReturn).toHaveBeenCalled();
  },
};

export const Collapsed: Story = {
  name: 'Collapsed icon rail',
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Collapse journey summary' }));
    await expect(c.getByRole('navigation', { name: 'Journey steps' })).toBeInTheDocument();
    await userEvent.click(c.getByRole('button', { name: 'Expand journey summary' }));
    await expect(c.getByRole('heading', { name: 'Journey Summary' })).toBeInTheDocument();
  },
};

export const Accordion: Story = {
  args: { variant: 'accordion' },
  parameters: { viewport: { defaultViewport: 'tablet' } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const toggle = c.getByRole('button', { name: /Journey Summary/ });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveTextContent('Journey Summary');
  },
};

export const Mobile: Story = {
  args: { variant: 'accordion' },
  parameters: { viewport: { defaultViewport: 'mobile' } },
};

export const Focus: Story = {
  name: 'Focus (keyboard)',
  play: async () => {
    await userEvent.tab();
  },
};

export const SectionStates: Story = {
  name: 'Row states side by side (StepSummarySection)',
  render: () => (
    <Column>
      <Specimen label="Completed (collapsed, with Edit)">
        <StepSummarySection title="Contact" icon={stepIcon('contact')} open={false} onToggle={() => undefined} onEdit={() => undefined}>
          <p className="caption-muted">Aisha Al-Thani</p>
        </StepSummarySection>
      </Specimen>
      <Specimen label="Completed, milestone flag">
        <StepSummarySection title="Address" icon={stepIcon('address')} open={false} onToggle={() => undefined} milestone>
          <p className="caption-muted">Doha</p>
        </StepSummarySection>
      </Specimen>
      <Specimen label="Current">
        <StepSummarySection title="Plan & Add-ons" icon={stepIcon('plan')} open onToggle={() => undefined} current>
          {null}
        </StepSummarySection>
      </Specimen>
      <Specimen label="Pending (a link back to it)">
        <StepSummarySection title="Checkout" icon={stepIcon('checkout')} open={false} onToggle={() => undefined} onGo={() => undefined}>
          {null}
        </StepSummarySection>
      </Specimen>
    </Column>
  ),
};
