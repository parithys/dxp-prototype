import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { ActualCustomerDocuments, AuthorizedPerson } from '../../src/capabilities';
import type { CustomerRepresentativeValue } from '../../src/capabilities';
import { docsParameters } from '../_shared/docs';
import { chooseFile, jpgFile } from '../documents/fixtures';

/** The page holds the value in the wizard's draft values; here it is local state. */
function ActualHost({ initial }: { initial?: CustomerRepresentativeValue }) {
  const [value, setValue] = useState<CustomerRepresentativeValue>(initial ?? { enabled: true });
  return (
    <div style={{ maxWidth: 880 }}>
      <ActualCustomerDocuments value={value} onChange={setValue} />
      <p className="caption-muted mt-4">Documents on the order: {(value.actualIdDocuments ?? []).length}</p>
    </div>
  );
}

function AuthorizedHost({ initial }: { initial?: CustomerRepresentativeValue }) {
  const [value, setValue] = useState<CustomerRepresentativeValue>(initial ?? { enabled: true });
  return (
    <div style={{ maxWidth: 880 }}>
      <AuthorizedPerson value={value} onChange={setValue} values={{ customerRepresentative: value }} actualCustomerId="CUST-1001" />
    </div>
  );
}

const meta = {
  title: 'Business Components/Customer Representative Sections',
  component: ActualCustomerDocuments,
  render: (args) => <ActualHost initial={args.value} />,
  parameters: {
    ...docsParameters({
      purpose: 'The two sections of the Customer Representative scenario (an authorised person acts for the actual customer). `ActualCustomerDocuments` takes the actual customer\'s ID documents - any number, scanned or uploaded, originals, printed or digital copies - once their typed details are validated. `AuthorizedPerson` identifies the authorised person present with the same ID reader as the Contact page, then asks for the authorization documents once MOI has validated them.',
      source: 'src/capabilities/CustomerQualification/RepresentativeSections.tsx (value model: representative.ts)',
      variants: [
        '`ActualCustomerDocuments`: Web offers Initiate scan (primary) and Upload Documents (multiple files); Tablet offers the capture actions (upload / camera). A scan is previewed and attached only on Accept (or Rescan).',
        '`AuthorizedPerson`: the identification card (unbound: no customer record is created, nothing is bound to the context customer), then - after MOI - Authorization / Supporting Documents (Power of Attorney / Authorization Letter, Court Order, Other Supporting Document; up to 5).',
      ],
      states: ['No documents', 'Documents listed with Remove (asks to confirm)', 'Refused file (a `role="alert"` with the upload rules\' message)', 'Scan preview awaiting Accept', 'Authorized person not yet validated: no documents section', 'Representative problem (`role="alert"`) while the identity is incomplete'],
      events: ['`onChange(value)` with the whole `CustomerRepresentativeValue` (`actualIdDocuments`, `authorizationDocuments`, `identity`).'],
      validation: ['Files are checked against the shared supporting-document rules (PDF or JPG, size limit); refused files are reported together.'],
      accessibility: ['Sections are named (`aria-labelledby` / `aria-label`); the hidden file input is named "Upload the actual customer ID documents"; each document has "Remove {file}" and removal is confirmed in a dialog.'],
      devices: ['Web scans with the desk scanner; Tablet uploads or captures with the camera. The toolbar\'s Device switch selects the experience.'],
      restrictions: ['`AuthorizedPerson` embeds Customer Identification, so it reads customers and identity documents from the mock data; the demo reader presents a different person from the actual customer.'],
    }),
  },
  argTypes: { value: { control: 'object', description: 'The representative value (`enabled`, `actualIdDocuments`, `authorizationDocuments`, `identity`).' }, onChange: { control: false } },
  args: { value: { enabled: true }, onChange: () => {} },
} satisfies Meta<typeof ActualCustomerDocuments>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { name: /Actual Customer.s Identity Document/ })).toBeVisible();
  },
};

export const WithDocuments: Story = {
  args: { value: { enabled: true, actualIdDocuments: [{ id: 'sb-1', label: 'Actual Customer ID', fileName: 'qid-front.jpg', sizeBytes: 120_000 }, { id: 'sb-2', label: 'Actual Customer ID', fileName: 'qid-back.jpg', sizeBytes: 98_000 }] } },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list', { name: 'Actual customer ID documents' });
    await expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  },
};

export const RemoveAsksToConfirm: Story = {
  args: WithDocuments.args,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Remove qid-front.jpg' }));
    await expect(await screen.findByRole('dialog')).toBeVisible();
  },
};

/** Web only: the Upload Documents button and its hidden multiple-file input. On Tablet the capture actions replace them. */
export const UploadOnWeb: Story = {
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input[aria-label="Upload the actual customer ID documents"]');
    if (!input) {
      await expect(within(canvasElement).getByRole('button', { name: 'Upload Document' })).toBeVisible();
      return;
    }
    await chooseFile(canvasElement, jpgFile('qid-front.jpg'), 'Upload the actual customer ID documents');
    await waitFor(() => expect(within(canvasElement).getByRole('list', { name: 'Actual customer ID documents' })).toBeVisible());
    await expect(within(canvasElement).getByText(/Documents on the order: 1/)).toBeVisible();
  },
};

export const AuthorizedPersonIdentification: StoryObj<typeof AuthorizedPerson> = {
  render: () => <AuthorizedHost />,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('region', { name: 'Authorized Person Identity' })).toBeVisible();
    await expect(within(canvasElement).queryByText('Authorization / Supporting Documents')).toBeNull();
  },
};
