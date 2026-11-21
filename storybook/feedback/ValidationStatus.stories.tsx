import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from 'dxp-ui';
import { ValidationStatus, TechnicalFailure } from '../../src/components/patterns/ValidationStatus';
import { IdLookupStatus } from '../../src/components/patterns/IdLookupStatus';
import { docsParameters } from '../_shared/docs';
import { Column, Specimen } from '../_shared/layout';

const meta = {
  title: 'Feedback & Status/Messages/Validation Status',
  component: ValidationStatus,
  parameters: {
    ...docsParameters({
      purpose: 'The one panel every Customer Verification check reports through, so the five situations an agent can be in look different at a glance: success, business failure, technical failure, pending, retrying. `TechnicalFailure` wraps it with Retry and an exhausted-retries recovery; `IdLookupStatus` chooses between them for the ID step.',
      source: 'src/components/patterns/ValidationStatus.tsx, IdLookupStatus.tsx',
      variants: [
        'success (green, tick): the check passed.',
        'business-failure (red, cross): the system answered and the answer is no.',
        'technical (amber, warning): no usable answer - nothing is decided; retry or recover.',
        'pending (neutral, spinner) and retry (amber, spinner): in progress.',
        '`tag` overrides the small label; `reference` shows a quotable reference; `actions` renders buttons.',
      ],
      states: ['Pending', 'Retrying (attempt n of 3)', 'Success', 'Business failure', 'Technical failure with Retry', 'Retries exhausted (reference shown, Retry removed)', 'Expired validation'],
      events: ['`onRetry` on TechnicalFailure; `runMoiValidation` on IdLookupStatus.'],
      accessibility: ['technical and business-failure: `role="alert"`; success, pending, retry: `role="status"`.', 'The busy variants use the Spinner, whose `label` (the title) is announced; the icon alone never carries the meaning - each panel has a text tag.'],
    }),
  },
  argTypes: {
    variant: { control: 'select', options: ['success', 'business-failure', 'technical', 'pending', 'retry'], description: 'Which situation the panel reports.' },
    title: { control: 'text', description: 'Headline.' },
    tag: { control: 'text', description: 'Overrides the default small label.' },
    reference: { control: 'text', description: 'A reference to quote when escalating.' },
    children: { control: false },
    actions: { control: false },
  },
  args: { variant: 'success', title: 'Identity validated', children: 'MOI confirmed the document details.' },
} satisfies Meta<typeof ValidationStatus>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Identity validated');
  },
};
export const Success: Story = {};
export const BusinessFailure: Story = {
  args: { variant: 'business-failure', title: 'ID not found', children: 'No record matches this ID in MOI.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('Not validated');
  },
};
export const Technical: Story = { args: { variant: 'technical', title: 'MOI is unavailable', children: 'Nothing has been decided - try again.' } };
export const Pending: Story = { args: { variant: 'pending', title: 'Validating the identity document…', children: 'Nothing is decided until this completes.' } };
export const Retrying: Story = { args: { variant: 'retry', title: 'Trying again…', tag: 'Retrying - attempt 2 of 3' } };
export const WithActionsAndReference: Story = {
  args: {
    variant: 'technical',
    title: 'MOI did not respond',
    reference: 'VAL-MOI-TIM-1042',
    actions: <Button size="sm">Retry</Button>,
  },
};

export const AllVariants: Story = {
  render: () => (
    <Column>
      {(['success', 'business-failure', 'technical', 'pending', 'retry'] as const).map((v) => (
        <Specimen key={v} label={v}>
          <ValidationStatus variant={v} title={`Variant ${v}`}>
            Supporting text for the {v} state.
          </ValidationStatus>
        </Specimen>
      ))}
    </Column>
  ),
};

export const TechnicalFailureStates: Story = {
  name: 'Technical failure (retry, exhausted, expired)',
  render: () => (
    <Column>
      <Specimen label="Attempt 1 of 3 used - Retry offered">
        <TechnicalFailure service="moi" kind="timeout" attempts={1} onRetry={fn()} />
      </Specimen>
      <Specimen label="Retries exhausted - reference, no Retry">
        <TechnicalFailure service="moi" kind="unavailable" attempts={3} onRetry={fn()} />
      </Specimen>
      <Specimen label="Expired - Validate again">
        <TechnicalFailure service="moi" kind="expired" attempts={0} onRetry={fn()} />
      </Specimen>
      <Specimen label="Retrying">
        <TechnicalFailure service="moi" kind="timeout" attempts={1} retrying />
      </Specimen>
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('button', { name: 'Retry (1 of 3 used)' })).toBeVisible();
    await expect(c.getByRole('button', { name: 'Validate again' })).toBeVisible();
    await expect(c.getAllByRole('button', { name: /Retry \(/ })).toHaveLength(1);
  },
};

const retrySpy = fn();

export const TechnicalRetryFires: Story = {
  render: () => <TechnicalFailure service="nas" kind="network" attempts={1} onRetry={retrySpy} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Retry (1 of 3 used)' }));
    await expect(retrySpy).toHaveBeenCalled();
  },
};

export const IdLookupStatusStates: Story = {
  name: 'ID lookup status (loading, failure, duplicates)',
  render: () => {
    const run = fn(async () => undefined);
    return (
      <Column>
        <Specimen label="Loading">
          <IdLookupStatus loading failure={null} retrying={false} expiredNotice={false} duplicates={null} hasMoiResult={false} runMoiValidation={run} />
        </Specimen>
        <Specimen label="Technical failure">
          <IdLookupStatus loading={false} failure={{ service: 'moi', kind: 'timeout', attempts: 1 }} retrying={false} expiredNotice={false} duplicates={null} hasMoiResult={false} runMoiValidation={run} />
        </Specimen>
        <Specimen label="Expired validation">
          <IdLookupStatus loading={false} failure={null} retrying={false} expiredNotice duplicates={null} hasMoiResult={false} runMoiValidation={run} />
        </Specimen>
        <Specimen label="Duplicate candidates">
          <IdLookupStatus
            loading={false}
            failure={null}
            retrying={false}
            expiredNotice={false}
            duplicates={[
              { customerId: 'CUST-0001', name: 'Sample Person A', dob: '1990-01-15' },
              { customerId: 'CUST-0002', name: 'Sample Person B', dob: '1990-01-15' },
            ]}
            hasMoiResult
            runMoiValidation={run}
          />
        </Specimen>
      </Column>
    );
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getAllByRole('button', { name: 'Use this record' })).toHaveLength(2);
  },
};
