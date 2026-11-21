import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { Button } from 'dxp-ui';
import { AddConnectionModal } from '../../src/capabilities';
import { docsParameters } from '../_shared/docs';

type Props = Parameters<typeof AddConnectionModal>[0];

/** The Activation Complete page's use of it: a button opens the modal; the modal is mounted only while open, so each opening reads the package afresh. */
function Demo(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add another connection
      </Button>
      <AddConnectionModal {...props} open={open} onClose={() => { setOpen(false); props.onClose(); }} />
    </>
  );
}

const meta = {
  title: 'Feedback & Status/Add Connection Modal',
  component: AddConnectionModal,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'ADD ANOTHER CONNECTION: says what a customer\'s Family Package needs next, from its state - the agent is never asked for a connection type - and starts the New Postpaid journey joined to that package.',
      source: 'src/capabilities/ActivationComplete/AddConnectionModal.tsx',
      variants: [
        'Primary Line 2 available: "Add Primary Line 2" (next connection, on the package\'s plan, no additional charge).',
        'Both Primary Lines active: "Select A Plan" (the plan is chosen on the next page).',
        'Nothing to add: the reasons are listed and the action is disabled; the title names the cause (e.g. Primary Line 1 awaiting approval).',
        '`alreadyActive`: opened because the customer asked for another Family Package; shows the existing package (plan, lines activated, free lines) and the secondary button reads "Skip".',
      ],
      states: ['Loading ("Loading the Family Package…")', 'Error (alert and Try Again)', 'Ready', 'Starting ("Starting…"; one start per opening)', 'Stale (the package changed before Continue: a warning and the action refreshed)', 'Customer without a package'],
      events: ['`onStart({ packageId })` after `onBeforeStart` resolves and the modal closes; `onClose` on Cancel/Skip/Escape.'],
      accessibility: ['The app\'s Modal (focus trapped, Escape closes, focus returns to the opener). Loading and results are `role="status"`; errors and the stale note are `role="alert"`.'],
      restrictions: ['Reads `family-package-lines`, `orders` and `products` through the API layer, so the preview boots the app first. The data is the seeded demo set (CUST-1001 open, CUST-3084 awaiting approval, CUST-3202 two Primary Lines, CUST-3208 full).', '`PackageDetails` styles itself with inline tokens (documented in source: it must look right on hosts without the component classes).'],
    }),
  },
  argTypes: {
    open: { control: false, description: 'Controlled by the demo button.' },
    customerId: { control: 'select', options: ['CUST-1001', 'CUST-3202', 'CUST-3084', 'CUST-3208', 'CUST-1002'], description: 'The customer whose package is read.' },
    alreadyActive: { control: 'boolean', description: 'Opened because the customer already holds a package.' },
    onClose: { control: false },
    onStart: { control: false },
    onBeforeStart: { control: false },
  },
  args: { open: false, customerId: 'CUST-1001', onClose: fn(), onStart: fn() },
} satisfies Meta<typeof AddConnectionModal>;
export default meta;
type Story = StoryObj<typeof meta>;

const openIt = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add another connection' }));
  return screen.findByRole('dialog');
};

export const PrimaryLine2: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await openIt(canvasElement);
    await expect(await within(dialog).findByText(/Primary Line 2 is the next connection/)).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add Primary Line 2' }));
    await waitFor(() => expect(args.onStart).toHaveBeenCalledWith({ packageId: 'FPK-CUST-1001' }));
  },
};

export const SelectAPlan: Story = {
  args: { customerId: 'CUST-3202' },
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    await waitFor(() => expect(within(dialog).queryByText(/Loading the Family Package/)).toBeNull());
  },
};

export const AwaitingApproval: Story = {
  args: { customerId: 'CUST-3084' },
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    await waitFor(() => expect(within(dialog).queryByText(/Loading the Family Package/)).toBeNull());
    await expect(within(dialog).getByRole('button', { name: /Add Primary Line 2|Select A Plan/ })).toBeDisabled();
  },
};

export const NothingLeftToAdd: Story = {
  args: { customerId: 'CUST-3208' },
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    await waitFor(() => expect(within(dialog).queryByText(/Loading the Family Package/)).toBeNull());
  },
};

export const AlreadyActive: Story = {
  args: { alreadyActive: true },
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    await expect(await within(dialog).findByText('This customer already has an active Family Package')).toBeVisible();
    await expect(within(dialog).getByRole('button', { name: 'Skip' })).toBeVisible();
  },
};

export const CustomerWithoutPackage: Story = {
  args: { customerId: 'CUST-1002' },
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    await expect(await within(dialog).findByText('This customer has no Family Package.')).toBeVisible();
  },
};

export const CancelClosesWithoutStarting: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await openIt(canvasElement);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expect(args.onStart).not.toHaveBeenCalled();
  },
};
