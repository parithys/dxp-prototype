import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { BulkOperationPortal, type BulkRow } from '../../src/components/patterns/BulkOperationPortal';
import { docsParameters } from '../_shared/docs';

type Props = Parameters<typeof BulkOperationPortal>[0];

/** Holds the rows with the functional updater the component requires. */
function Host(props: Props) {
  const [rows, setRows] = useState<BulkRow[]>(props.rows);
  return <BulkOperationPortal {...props} rows={rows} onChange={(updater) => setRows(updater)} />;
}

const row = (n: number, patch: Partial<BulkRow> = {}): BulkRow => ({ rowId: `ROW-${n}`, billingProfileId: `BILL-100${n}`, bucket: 'Rental', unitOfMeasurement: 'QAR', amount: '25', comment: 'Goodwill adjustment', status: 'Pending', ...patch });

/** The demo submit: a row with no billing profile fails, every other row succeeds. */
const submitRow = async (r: BulkRow) => (r.billingProfileId.trim() ? { ok: true } : { ok: false, reason: 'Billing profile is required' });

const meta = {
  title: 'Patterns/Bulk Operation Portal',
  component: BulkOperationPortal,
  parameters: {
    ...docsParameters({
      purpose: 'Pattern 17: a fixed-template grid of rows (billing profile, bucket, unit of measurement, amount, free-text comment) submitted as a batch. Rows are processed one after another asynchronously; each shows Success or Failed with its reason, and only the failed rows can be re-uploaded. Row entry stands in for the evidenced file-upload template (there is no real file I/O in a front-end-only app) - same rows, same fields.',
      source: 'src/components/patterns/BulkOperationPortal.tsx',
      states: ['Empty (no rows: "No rows in the template - Add Row to start.")', 'Rows pending', 'Processing (the Submit Batch button reads "Processing…" and is disabled)', 'Row Success / Failed (with `failureReason`)', 'Failed rows present (Re-upload Failed Rows (n))'],
      events: ['`onChange(updater)` - functional-updater style, like React\'s `setState`: the batch awaits each row in turn, so a plain array setter would let every update overwrite the last.', '`onSubmitRow(row)` - resolves `{ ok, reason? }` for one row. Submit Batch sends every row that is not yet Success; Re-upload sends only the failed ones.'],
      usage: ['The caller owns the rows and passes a functional updater (`(updater) => setRows(updater)`). Used by the bulk adjustment submission screen.'],
      accessibility: ['Every cell control has an `aria-label` (Billing Profile, Bucket, Unit, Amount, Comment); the remove control is a labelled icon button ("Remove row"). Status is a text Badge, not colour alone.'],
      restrictions: ['The component keeps no state of its own besides "submitting": rows live in the caller.'],
    }),
  },
  argTypes: { rows: { control: false }, onChange: { control: false }, onSubmitRow: { control: false } },
  args: { rows: [], onChange: fn(), onSubmitRow: fn(submitRow) },
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof BulkOperationPortal>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { rows: [row(1), row(2, { billingProfileId: 'BILL-1002', bucket: 'Usage', unitOfMeasurement: 'GB', amount: '5' })] } };

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No rows in the template - Add Row to start.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Submit Batch' })).toBeDisabled();
  },
};

export const MixedResults: Story = { args: { rows: [row(1, { status: 'Success' }), row(2, { billingProfileId: '', status: 'Failed', failureReason: 'Billing profile is required' }), row(3)] } };

export const AddAndRemoveRows: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add Row' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Add Row' }));
    await expect(canvas.getAllByRole('button', { name: 'Remove row' })).toHaveLength(2);
    await userEvent.click(canvas.getAllByRole('button', { name: 'Remove row' })[0]);
    await expect(canvas.getAllByRole('button', { name: 'Remove row' })).toHaveLength(1);
  },
};

export const SubmitBatch: Story = {
  args: { rows: [row(1), row(2)] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Submit Batch' }));
    await waitFor(() => expect(canvas.getAllByText('Success')).toHaveLength(2), { timeout: 5000 });
    await expect(args.onSubmitRow).toHaveBeenCalledTimes(2);
  },
};

export const FailedRowThenReupload: Story = {
  args: { rows: [row(1), row(2, { billingProfileId: '' })] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Submit Batch' }));
    await waitFor(() => expect(canvas.getByText('Billing profile is required')).toBeVisible(), { timeout: 5000 });
    await expect(canvas.getByText('Success')).toBeVisible();
    // Fix the failed row, then re-upload only it.
    await userEvent.type(canvas.getAllByLabelText('Billing Profile')[1], 'BILL-2002');
    await userEvent.click(canvas.getByRole('button', { name: 'Re-upload Failed Rows (1)' }));
    await waitFor(() => expect(canvas.getAllByText('Success')).toHaveLength(2), { timeout: 5000 });
    await expect(args.onSubmitRow).toHaveBeenCalledTimes(3);
  },
};
