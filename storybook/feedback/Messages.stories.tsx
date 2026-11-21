import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { RestrictedCustomerNotice } from '../../src/components/patterns/RestrictedCustomerNotice';
import { RestrictedRowsNotice } from '../../src/components/patterns/RestrictedRowsNotice';
import { FamilyPackageNotice } from '../../src/components/patterns/FamilyPackageNotice';
import { docsParameters } from '../_shared/docs';
import { Column, Specimen } from '../_shared/layout';

// Inline messages: the `.notice-*` classes (ui-components.css) and the components that render them.
const meta = {
  title: 'Feedback & Status/Messages/Notices',
  parameters: {
    ...docsParameters({
      purpose: 'Inline messages: informational, success, warning and error callouts built from the `.notice-*` classes, and the app components that render them (RestrictedCustomerNotice, RestrictedRowsNotice, FamilyPackageNotice). Validation panels have their own page (Messages / Validation Status).',
      source: 'src/ui-components.css (.notice-*); src/components/patterns/RestrictedCustomerNotice.tsx, RestrictedRowsNotice.tsx, FamilyPackageNotice.tsx',
      variants: [
        '`.notice-info` (blue), `.notice-success` (green), `.notice-warning` / `.notice-warning-edge` (amber), `.notice-danger` / `.notice-danger-edge` (red), `.notice-neutral` (plain surface).',
        'RestrictedCustomerNotice: `compact` inline form or the full page form; optional back link.',
        'RestrictedRowsNotice: count line above a list; nothing when the count is 0.',
        'FamilyPackageNotice: neutral status ("this connection is ... of the Family Package") or red refusal with the engine\'s reason; nothing for a non-Family plan.',
      ],
      states: ['Visible', 'Not rendered (zero count, plan not applicable)'],
      accessibility: [
        'RestrictedCustomerNotice and the FamilyPackageNotice refusal use `role="alert"`; RestrictedRowsNotice and the FamilyPackageNotice status use `role="status"`.',
        'The bare `.notice-*` classes carry no role: add `role="status"` (polite) or `role="alert"` (assertive) where the message appears dynamically. Never rely on colour alone - keep a text label.',
      ],
    }),
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoticeClasses: Story = {
  name: 'Notice classes (info, success, warning, error)',
  render: () => (
    <Column>
      <Specimen label=".notice-info">
        <p role="status" className="notice-info pad-row">Your changes are saved as a draft.</p>
      </Specimen>
      <Specimen label=".notice-success">
        <p role="status" className="notice-success pad-row">The order was submitted.</p>
      </Specimen>
      <Specimen label=".notice-warning">
        <p role="status" className="notice-warning pad-row">The customer's ID expires within 30 days.</p>
      </Specimen>
      <Specimen label=".notice-warning-edge">
        <p role="status" className="notice-warning-edge pad-row">A potential duplicate ticket exists.</p>
      </Specimen>
      <Specimen label=".notice-danger">
        <p role="alert" className="notice-danger pad-row">The ID could not be validated.</p>
      </Specimen>
      <Specimen label=".notice-neutral">
        <p role="status" className="notice-neutral pad-row">Nothing needs your attention.</p>
      </Specimen>
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getAllByRole('alert')).toHaveLength(1);
    await expect(c.getAllByRole('status')).toHaveLength(5);
  },
};

export const RestrictedCustomer: Story = {
  name: 'Restricted customer (full)',
  render: () => <RestrictedCustomerNotice backTo="/" backLabel="Back to Home" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('Access restricted');
  },
};

export const RestrictedCustomerCompact: Story = {
  name: 'Restricted customer (compact)',
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <RestrictedCustomerNotice compact />
    </div>
  ),
};

export const RestrictedRows: Story = {
  name: 'Restricted rows',
  render: () => (
    <Column>
      <Specimen label="count = 1">
        <RestrictedRowsNotice count={1} />
      </Specimen>
      <Specimen label="count = 4">
        <RestrictedRowsNotice count={4} />
      </Specimen>
      <Specimen label="count = 0 (renders nothing)">
        <RestrictedRowsNotice count={0} />
      </Specimen>
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/1 entry is hidden/)).toBeVisible();
    await expect(c.getByText(/4 entries are hidden/)).toBeVisible();
  },
};

export const FamilyPackage: Story = {
  name: 'Family package notice',
  render: () => (
    <Column>
      <Specimen label="Joins the package (status)">
        <FamilyPackageNotice check={{ applies: true, ok: true, lineLabel: 'Primary Line 2', planId: 'PLAN-1', additional: { packageId: 'FP-1', tierPlanId: 'PLAN-1', role: 'Primary', sequence: 2, type: 'Mobile', charge: 'Free' } as never }} planName="Family 200" />
      </Specimen>
      <Specimen label="Refused (alert)">
        <FamilyPackageNotice check={{ applies: true, ok: false, kind: 'eligibility', reason: 'This customer has not cleared eligibility, so a Family Plan cannot be started.' }} planName="Family 200" />
      </Specimen>
      <Specimen label="Not a Family Plan (renders nothing)">
        <FamilyPackageNotice check={{ applies: false }} planName={undefined} />
      </Specimen>
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('status')).toHaveTextContent('Primary Line 2');
    await expect(c.getByRole('alert')).toHaveTextContent('not cleared eligibility');
  },
};
