import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { cafSignatureStep, checkoutSummaryStep, customerQualificationStep, numberSelectionStep, paymentStep, postpaidPlanStep, simTypeStep } from '../../src/capabilities';
import type { ActualUserValue } from '../../src/capabilities';
import { StepSummaryPanel } from '../../src/components/patterns/wizard/StepSummaryPanel';
import type { CompletedSummaryStep } from '../../src/components/patterns/wizard/StepSummaryPanel';
import type { WizardStep } from '../../src/components/patterns/wizard/guidedWizardTypes';
import { summaryPanelActions } from '../../src/stores/summaryPanelSlice';
import { store } from '../../src/stores/store';
import { exampleParameters } from './_harness';
import type { Values } from './_harness';
import { CLEAN_ELIGIBILITY, CUSTOMER, SIGNATURE_PNG, SLOW, contactOfCustomer, summaryText, useLoaded } from './_fixtures';

const SECONDARY_CUSTOMER = 'CUST-3004';

const meta: Meta = {
  title: 'Application Examples/Journey Summary',
  parameters: exampleParameters({
    purpose: 'The running Journey Summary beside a journey: one section per completed step, read from each step\'s own `summary` declaration and the single values object, so an edit to an earlier step shows at once and a new step or field appears without touching the panel. Here it lists six completed steps of a postpaid sale (Contact, Offers & Plans, Number Selection, SIM Selection with its Secondary Contact, Order Summary, CAF & Signature) with Payment as the current page.',
    source: 'src/components/patterns/wizard/StepSummaryPanel.tsx and StepSummarySection.tsx; the `summary` of each capability step (src/capabilities/*/summary.ts)',
    variants: [
      'Default: side panel (from the `lg` breakpoint), sections collapsed, the current page as a tinted name-only band.',
      'Secondary Contact: the person added on SIM Selection is a section of its own straight after SIM Selection.',
      'Collapsed rail: the panel folds to a slim rail of step icons (a preference kept in the store).',
      'Accordion: below `lg` the same content is a "Journey Summary" block above the action buttons.',
    ],
    states: ['Sections collapsed / expanded (per page; reset when the page changes)', 'Collapsed rail', 'Edit requested (goes back to the step)', 'Empty ("Your details will appear here as you complete each step.")'],
    events: ['`onEdit(index)` - the Edit button of a completed section; absent when the journey is locked (after the CAF is signed).'],
    usage: ['Sensitive values are masked to their last four characters (the ID number); a field left empty reads "Not provided"; names for ids (the plan) are resolved from the data set, never copied into the order.'],
    accessibility: ['The panel is an `aside` named "Summary of completed steps"; a polite live region announces "Summary updated: n of m steps completed."; each section header is a disclosure button with `aria-expanded`, and Edit is named "Edit <step>".'],
    devices: ['Side panel on desktop widths, accordion on tablet portrait and below (`lg:hidden`). The `Accordion` story uses the mobile viewport.'],
  }),
};
export default meta;
type Story = StoryObj<typeof meta>;

/** Real steps, built the way the postpaid journey builds them: only their `summary` / `extraSummary` are read here. */
const useSteps = (): WizardStep[] =>
  useMemo(
    () => [
      customerQualificationStep({ flow: 'new', existingCustomerId: undefined, guardedContactChange: (v, set) => set('contact', v), productAgnostic: true, journeyChosenLater: true }),
      postpaidPlanStep({ products: [], customerBenefits: undefined }),
      numberSelectionStep({ priceField: 'numberPriceQAR', waiveOff: true }),
      simTypeStep({ withActualUser: true }),
      checkoutSummaryStep(),
      cafSignatureStep({ variant: 'full' }),
      paymentStep(),
    ],
    []
  );

function SummaryExample({ secondary = false, variant, onEdit }: { secondary?: boolean; variant?: 'aside' | 'accordion'; onEdit?: (label: string) => void }) {
  const steps = useSteps();
  const contacts = useLoaded(async () => ({ primary: await contactOfCustomer(CUSTOMER.clean), other: await contactOfCustomer(SECONDARY_CUSTOMER) }));
  const [edited, setEdited] = useState<string | undefined>();
  if (!contacts) return <p className="muted-body">Loading the customers from the mock data…</p>;
  const values: Values = {
    contact: contacts.primary,
    customerType: { type: 'none' },
    eligibility: CLEAN_ELIGIBILITY,
    productId: 'PROD-107',
    msisdn: '+97477000000',
    numberPriceQAR: 50000,
    numberWaiver: 1000,
    simType: { simType: 'eSIM', esimIssued: true, esimActivationCode: 'LPA:1$demo.vodafone.qa$ACTIVATION', simIccid: '8974412009900140101' },
    checkoutTotals: { dueTodayQar: 46125, monthlyRecurringQar: 115 },
    caf: { cafType: 'Digital', signatureDataUrl: SIGNATURE_PNG, ...(secondary ? { secondarySignatureDataUrl: SIGNATURE_PNG, supplementaryAgreed: true } : {}) },
    ...(secondary ? { actualUser: { choice: 'other', identity: contacts.other } satisfies ActualUserValue } : {}),
  };
  const completed: CompletedSummaryStep[] = steps.slice(0, 6).map((step, index) => ({ index, step }));
  const current: CompletedSummaryStep = { index: 6, step: steps[6] };
  return (
    <div className="row-start gap-6">
      <div className="min-w-0 flex-1 pad-panel stack gap-2">
        <p className="caption-secondary">The journey's page would be here; the panel is the production Journey Summary.</p>
        <p role="status" className="caption-strong">
          {edited ? `Edit requested: ${edited}` : 'No edit requested.'}
        </p>
      </div>
      <StepSummaryPanel
        completed={completed}
        current={current}
        totalSteps={steps.length}
        values={values}
        variant={variant}
        onEdit={(i) => {
          setEdited(steps[i].label);
          onEdit?.(steps[i].label);
        }}
      />
    </div>
  );
}

/** The collapsed rail is a stored preference: start every story expanded. */
const expanded = () => {
  if (store.getState().summaryPanel.collapsed) store.dispatch(summaryPanelActions.toggleCollapsed());
  return {};
};

export const Default: Story = {
  loaders: [expanded],
  render: () => <SummaryExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { name: 'Journey Summary' }, SLOW)).toBeVisible();
    // Six completed sections and the current page as its own band.
    for (const label of ['Contact', 'Offers & Plans', 'Number Selection', 'SIM Selection', 'Order Summary', 'CAF & Signature']) {
      await expect(canvas.getByRole('button', { name: label })).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(canvas.getByText('Payment')).toBeVisible();
    // Expanding a section reads its fields from the values: the plan name is resolved from the catalogue, the ID number is masked.
    await userEvent.click(canvas.getByRole('button', { name: 'Offers & Plans' }));
    await expect(await canvas.findByText('Postpaid Essential', undefined, SLOW)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Contact' }));
    await expect(canvas.getByText(/^•+1234$/)).toBeVisible();
    // Number Selection shows the Additional Discount beside the number's price.
    await userEvent.click(canvas.getByRole('button', { name: 'Number Selection' }));
    await expect(canvas.getByText('Additional Discount')).toBeVisible();
    // Edit goes back to the step it names.
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Offers & Plans' }));
    await expect(canvas.getByText('Edit requested: Offers & Plans')).toBeVisible();
  },
};

export const WithSecondaryContact: Story = {
  loaders: [expanded],
  render: () => <SummaryExample secondary />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const secondary = await canvas.findByRole('button', { name: 'Secondary Contact' }, SLOW);
    await expect(secondary).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(secondary);
    await expect(await canvas.findByText('Actual user')).toBeVisible();
    // It sits straight after SIM Selection, and the CAF section reports both signatures.
    const sections = [...canvasElement.querySelectorAll('aside section button[aria-expanded]')].map((b) => b.textContent);
    await expect(sections.indexOf('Secondary Contact')).toBe(sections.indexOf('SIM Selection') + 1);
    await userEvent.click(canvas.getByRole('button', { name: 'CAF & Signature' }));
    await expect(canvas.getByText('Signed by both')).toBeVisible();
  },
};

export const CollapsedRail: Story = {
  loaders: [expanded],
  render: () => <SummaryExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Collapse journey summary' }, SLOW));
    // The rail keeps one icon per step; each opens the panel again.
    await expect(await canvas.findByRole('button', { name: 'Contact, completed. Expand journey summary' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Payment, current step. Expand journey summary' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Expand journey summary' }));
    await waitFor(() => expect(canvas.getByRole('heading', { name: 'Journey Summary' })).toBeVisible());
  },
};

export const Accordion: Story = {
  loaders: [expanded],
  parameters: { viewport: { defaultViewport: 'mobile' } },
  render: () => <SummaryExample variant="accordion" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('button', { name: /^Journey Summary/, hidden: true }, SLOW);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(canvas.getByRole('button', { name: /^Journey Summary/, hidden: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(summaryText(canvasElement)).toContain('Offers & Plans');
  },
};

function EmptySummary() {
  const steps = useSteps();
  return <div className="row-start gap-6"><div className="flex-1" /><StepSummaryPanel completed={[]} current={{ index: 0, step: steps[0] }} totalSteps={steps.length} values={{}} /></div>;
}

export const NothingCompletedYet: Story = {
  loaders: [expanded],
  render: () => <EmptySummary />,
  play: async ({ canvasElement }) => {
    await expect(summaryText(canvasElement)).toContain('Contact');
    await expect(within(canvasElement).getByRole('heading', { name: 'Journey Summary' })).toBeVisible();
  },
};
