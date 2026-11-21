import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from 'dxp-ui';
import { TicketCreationModal } from '../../src/components/patterns/TicketCreationModal';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Feedback & Status/Ticket Creation Drawer',
  component: TicketCreationModal,
  parameters: {
    ...docsParameters({
      purpose: 'The "New Trouble Ticket" form. Despite its name it is a `Drawer` (forms are drawers, not modals): customer ID, issue type, area, template, queue, derived priority, duplicate-ticket warning.',
      source: 'src/components/patterns/TicketCreationModal.tsx',
      variants: ['Pre-filled when opened from Customer 360 (`initialCustomerId`, `initialIssueType`, `initialActualIssue`, `initialQueue`, `routingNote`, `severity`).'],
      states: ['Closed', 'Open, empty (Save disabled)', 'Restricted customer (notice, Save disabled)', 'Saving (button reads "Saving…")'],
      events: ['`onSubmit(value)` with the ticket; `onClose` on Cancel, X or Escape. A click outside does not close it (Drawer behaviour).'],
      validation: ['Business rule BR-068 gates Save on Issue Type plus template content; the message shows in red under the fields.', 'A customer ID in a protected segment shows the restricted notice and blocks Save.'],
      accessibility: ['Drawer: `role="dialog"`, `aria-modal`, named "New Trouble Ticket"; fields are labelled.'],
      restrictions: ['Reads customers and tickets from the mock data through the API layer, so the preview boots the app first.'],
    }),
  },
} satisfies Meta<typeof TicketCreationModal>;
export default meta;
type Story = StoryObj<typeof TicketCreationModal>;

function Demo({ startOpen = false, initialCustomerId, initialIssueType, initialQueue, routingNote }: { startOpen?: boolean; initialCustomerId?: string; initialIssueType?: string; initialQueue?: string; routingNote?: string }) {
  const [open, setOpen] = useState(startOpen);
  const [saved, setSaved] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>New ticket</Button>
      {saved && <p role="status" className="caption-muted">Submitted</p>}
      <TicketCreationModal
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={() => {
          setSaved(true);
          setOpen(false);
        }}
        initialCustomerId={initialCustomerId}
        initialIssueType={initialIssueType}
        initialQueue={initialQueue}
        routingNote={routingNote}
      />
    </>
  );
}

export const Default: Story = {
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'New ticket' }));
    const d = await within(document.body).findByRole('dialog');
    await expect(d).toHaveAccessibleName('New Trouble Ticket');
    await expect(within(d).getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull(), { timeout: 3000 });
  },
};

export const PrefilledFromCustomer360: Story = {
  render: () => <Demo startOpen initialCustomerId="CUST-1001" initialIssueType="Mobile Complaints" initialQueue="Complaints Team" routingNote="Routed by the Customer 360 complaint rules." />,
};
