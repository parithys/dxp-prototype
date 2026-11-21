import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { Button } from 'dxp-ui';
import { ExceptionRequestModal } from '../../src/capabilities';
import { docsParameters } from '../_shared/docs';
import { attachDocument } from '../business/_documents';

type Props = Parameters<typeof ExceptionRequestModal>[0];

function Demo(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Request exception
      </Button>
      <ExceptionRequestModal {...props} open={open} onClose={() => { setOpen(false); props.onClose(); }} />
    </>
  );
}

const meta = {
  title: 'Feedback & Status/Exception Request Modal',
  component: ExceptionRequestModal,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'The Exception Request for an applicant under 18: the agent attaches the mandatory supporting document (the Court Type Order) and submits the request for approval. It does not lift the age rule - it is the controlled approval path; the order is held for the approver.',
      source: 'src/capabilities/EligibilityGate/ExceptionRequestModal.tsx',
      variants: ['`requirement` given: the document is named after it (e.g. Court Type Order) and attached under its id; without it the label is "Supporting Document".', '`document`: a document already attached to this exception is shown, with Remove.'],
      states: ['No document: Submit for Approval disabled', 'Document attached: file name and size, Remove, Submit enabled', 'Refused file (wrong type or over the size limit): `role="alert"` message, nothing attached'],
      events: ['`onSubmit(document)` with the attached document; `onClose` on Cancel, X or Escape (a file chosen but not submitted is forgotten).'],
      validation: ['Submit for Approval stays disabled until the document is uploaded. The file is checked against the shared supporting-document rules (PDF or JPG, up to the size limit).'],
      accessibility: ['The app\'s Modal: focus trapped, Escape closes, focus returns to the opener; the document label carries a required asterisk (hidden from assistive tech; the dialog text states the document is needed). The file input is named "Choose the {label}".'],
      devices: ['Web: Initiate Scan (the demo desk scanner) and Upload Document, as in Additional Documents. Tablet: Upload Document only. The toolbar\'s Device switch selects the experience.'],
    }),
  },
  argTypes: {
    approverRole: { control: 'text', description: 'Whose queue the request goes to, named in the text.' },
    requirement: { control: 'object', description: 'The configured document the exception requires: { id, label }.' },
    document: { control: 'object', description: 'A document already attached to this exception.' },
    open: { control: false },
    onClose: { control: false },
    onSubmit: { control: false },
  },
  args: { open: false, approverRole: 'Retail Manager', requirement: { id: 'DOC-COURT-ORDER', label: 'Court Type Order' }, onClose: fn(), onSubmit: fn() },
} satisfies Meta<typeof ExceptionRequestModal>;
export default meta;
type Story = StoryObj<typeof meta>;

const openIt = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Request exception' }));
  return screen.findByRole('dialog');
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    await expect(dialog).toHaveAccessibleName('Exception Request');
    await expect(within(dialog).getByRole('button', { name: 'Submit for Approval' })).toBeDisabled();
  },
};

export const SubmitEnabledAfterUpload: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await openIt(canvasElement);
    const submit = within(dialog).getByRole('button', { name: 'Submit for Approval' });
    await expect(submit).toBeDisabled();
    await attachDocument(dialog, (el) => userEvent.click(el));
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};

export const RemoveDocumentDisablesSubmit: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    await attachDocument(dialog, (el) => userEvent.click(el));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await expect(within(dialog).getByRole('button', { name: 'Submit for Approval' })).toBeDisabled();
  },
};

export const WithoutConfiguredRequirement: Story = {
  args: { requirement: undefined },
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    await expect(within(dialog).getByText(/Upload the Supporting Document/)).toBeVisible();
  },
};

export const DocumentAlreadyAttached: Story = {
  args: { document: { id: 'DOC-demo', label: 'Court Type Order', fileName: 'court-order.pdf', sizeBytes: 48_000, requirementId: 'DOC-COURT-ORDER' } },
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    await expect(within(dialog).getByText(/court-order\.pdf/)).toBeVisible();
    await expect(within(dialog).getByRole('button', { name: 'Submit for Approval' })).toBeEnabled();
  },
};

export const CancelDoesNotSubmit: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await openIt(canvasElement);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};
