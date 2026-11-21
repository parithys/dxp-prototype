import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { EligibilityGateStep, OutcomeActions } from '../../src/capabilities';
import type { EligibilityResult } from '../../src/components/domain/eligibilityTypes';
import { Button, Card } from 'dxp-ui';
import { listEntities } from '../../src/services/entityOps';
import { Column } from '../_shared/layout';
import { exampleParameters } from './_harness';
import { CUSTOMER, SLOW, useLoaded } from './_fixtures';

const meta: Meta = {
  title: 'Application Examples/Eligibility Checks',
  parameters: exampleParameters({
    purpose: 'The eligibility outcomes of a postpaid sale as one scenario: the Eligibility Gate runs the real eligibility engine over a real customer of public/mock-data, lists only the checks that did not pass, and the footer action follows the outcome (Continue, Request Approval by Continue, Continue Prepaid / Proceed to Payment, or no way on). Nothing is simulated in the story - changing a customer or the engine changes what shows.',
    source: 'src/capabilities/EligibilityGate (EligibilityGateStep.tsx, EligibilityOutcomes.tsx) over src/engines/eligibilityEngine.ts and connectionEligibility.ts',
    variants: [
      'Pass (CUST-1001, clean): nothing is listed - a clean run is silence - and Continue is the footer action.',
      'Approval routing: an ID type that needs Credit Control approval (CUST-1002, Passport on postpaid) and the line limit (CUST-3002 and CUST-3082 hold 5 and 20 postpaid lines). The order continues and is held for approval when submitted.',
      'Soft stop: postpaid cannot be issued but Prepaid is offered - a collections blacklist with an amount owed (CUST-1004) and the GCC ID (CUST-1005: postpaid is not permitted with a GCC ID).',
      'Hard stop: nothing to continue to - a security blacklist (CUST-1006) and the expatriate mobile-line cap (CUST-3072).',
    ],
    states: ['Checking eligibility…', 'Pass (no rows)', 'Approval routing', 'Soft stop', 'Hard stop'],
    events: ['`onResult(result)` - the `EligibilityResult` (`pass`, `hardStop`, `softStop`, `checks`, `requiresHrnAdvance`, `customerId` ...) the journey keeps under `eligibility` for Plan, Checkout and Payment.'],
    usage: ['Each row is a card whose edge, icon and title carry the outcome (not colour alone). Customer Verification judges the checks common to every product; Product Selection judges the postpaid ones, as here (`scope="product"`).'],
    restrictions: ['The outcomes come from the data as it stands in public/mock-data (balances, blacklist, line counts, ID expiry); the story does not assert more than the outcome class and the row headings the engine produces.'],
  }, 900, 'padded'),
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The outcome class the footer acts on, read from the same result fields OutcomeActions reads. */
const outcomeOf = (r: EligibilityResult | undefined): string =>
  !r ? 'Checking' : r.hardStop ? 'Hard Stop' : r.softStop ? 'Soft Stop' : r.checks.some((c) => c.outcome === 'approval-routing') ? 'Approval Routing' : 'Pass';

/** One customer, the gate and the footer, on the postpaid journey. */
function Scenario({ customerId }: { customerId: string }) {
  const customer = useLoaded(async () => (await listEntities<{ customerId: string; qid: string; name: string; idType: string; activePostpaidLines?: number }>('customers')).find((c) => c.customerId === customerId), [customerId]);
  const [result, setResult] = useState<EligibilityResult | undefined>();
  if (!customer) return <p className="muted-body">Loading {customerId}…</p>;
  return (
    <Card className="p-6 stack gap-4" aria-label={`Eligibility of ${customer.customerId}`}>
      <div>
        <h3 className="title title-md">
          {customer.customerId}: {customer.name}
        </h3>
        <p className="caption-secondary">
          {customer.idType} {customer.qid}, {customer.activePostpaidLines ?? 0} postpaid lines on record
        </p>
      </div>
      <EligibilityGateStep key={customer.customerId} idNumber={customer.qid} result={result} onResult={setResult} announcePass={false} scope="product" journeyType="postpaid" />
      <p role="status" className="caption-strong">
        Outcome: {outcomeOf(result)}
      </p>
      <div className="row justify-end divider-top pt-4">
        <OutcomeActions eligibility={result} defaultButton={<Button disabled={!result || !result.pass}>Continue</Button>} />
      </div>
    </Card>
  );
}

const outcome = (canvas: ReturnType<typeof within>, name: string) => canvas.findByText(`Outcome: ${name}`, undefined, SLOW);

export const Pass: Story = {
  render: () => <Scenario customerId={CUSTOMER.clean} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await outcome(canvas, 'Pass');
    await expect(canvas.queryByRole('list', { name: 'Eligibility results' })).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled();
  },
};

export const IdTypeApproval: Story = {
  name: 'Approval routing: ID type (Passport)',
  render: () => <Scenario customerId={CUSTOMER.passport} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await outcome(canvas, 'Approval Routing');
    await expect(await canvas.findByText('Credit Control Approval Required')).toBeVisible();
    // Approval routing is not a stop: Continue stays available and the order is held for approval when it is submitted.
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled();
  },
};

export const LineLimitApproval: Story = {
  name: 'Approval routing: line limit (5 and 20 lines)',
  render: () => (
    <Column>
      <Scenario customerId={CUSTOMER.fiveLines} />
      <Scenario customerId={CUSTOMER.twentyLines} />
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getAllByText('Outcome: Approval Routing')).toHaveLength(2), SLOW);
    await expect(canvas.getAllByRole('list', { name: 'Eligibility results' })).toHaveLength(2);
  },
};

export const SoftStopCollections: Story = {
  name: 'Soft stop: collections',
  render: () => <Scenario customerId={CUSTOMER.collections} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await outcome(canvas, 'Soft Stop');
    await expect(await canvas.findByText('Collections Check')).toBeVisible();
    // Postpaid cannot be issued: the footer offers Prepaid, or settling the balance.
    await expect(canvas.getByRole('button', { name: 'Continue Prepaid' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Proceed to Payment' })).toBeVisible();
  },
};

export const GccIdPostpaidStop: Story = {
  name: 'Soft stop: GCC ID on postpaid',
  render: () => <Scenario customerId={CUSTOMER.gccId} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await outcome(canvas, 'Soft Stop');
    await expect(await canvas.findByText('Postpaid Not Permitted With GCC ID')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Continue Prepaid' })).toBeVisible();
  },
};

export const HardStopSecurity: Story = {
  name: 'Hard stop: security blacklist',
  render: () => <Scenario customerId={CUSTOMER.security} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await outcome(canvas, 'Hard Stop');
    await expect(await canvas.findByText('Security Check')).toBeVisible();
    // No way on: no Continue, no payment, no prepaid.
    await expect(canvas.queryByRole('button', { name: 'Continue' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Proceed to Payment' })).toBeNull();
  },
};

export const HardStopLineCap: Story = {
  name: 'Hard stop: mobile line cap',
  render: () => <Scenario customerId={CUSTOMER.lineCapBlocked} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await outcome(canvas, 'Hard Stop');
    await expect(await canvas.findByRole('list', { name: 'Eligibility results' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Continue' })).toBeNull();
  },
};

export const AllOutcomes: Story = {
  name: 'All outcomes',
  render: () => (
    <Column>
      {[CUSTOMER.clean, CUSTOMER.passport, CUSTOMER.collections, CUSTOMER.gccId, CUSTOMER.security].map((id) => (
        <Scenario key={id} customerId={id} />
      ))}
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.queryAllByText('Outcome: Checking')).toHaveLength(0), SLOW);
    await expect(canvas.getAllByText(/^Outcome: /)).toHaveLength(5);
  },
};
