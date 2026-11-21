import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { CafDocumentUpload } from '../../src/components/domain/CafDocumentUpload';
import type { CafDocument } from '../../src/components/domain/CafDocumentUpload';
import { docsParameters } from '../_shared/docs';
import { chooseFile, chooseOption, expectAlert, oversizeFile, pdfFile, wrongTypeFile } from './fixtures';

type Props = Parameters<typeof CafDocumentUpload>[0];

function Stateful(props: Props) {
  const [documents, setDocuments] = useState<CafDocument[]>(props.documents);
  return (
    <CafDocumentUpload
      {...props}
      documents={documents}
      onChange={(d) => {
        setDocuments(d);
        props.onChange(d);
      }}
    />
  );
}

const DOCS: CafDocument[] = [
  { id: 'd1', docType: 'Signed CAF', fileName: 'caf-signed.pdf', sizeBytes: 482000 },
  { id: 'd2', docType: 'Passport', fileName: 'passport-page.pdf', sizeBytes: 311000 },
];

const meta = {
  title: 'Documents/CAF Document Upload (Signed Documents)',
  component: CafDocumentUpload,
  parameters: {
    ...docsParameters({
      purpose: 'Upload of the signed CAF and its supporting documents. The type is chosen FIRST, then the file: a file with no type is an unfiled attachment nobody can classify.',
      source: 'src/components/domain/CafDocumentUpload.tsx',
      variants: ['Web: `Initiate Scan` (the desk scanner), named `scan-{id}-{type}.jpg`.', 'Tablet: `Upload Document`.'],
      states: ['Empty: the capture buttons are disabled until a Document Type is chosen (tooltip `Choose a document type first`).', 'Populated: a list of files with type and size and a Remove button each (no confirmation here).', 'At the limit (5 documents): the picker is replaced by `Maximum of 5 documents reached. Remove one to upload another.`', 'Validation error (type, size).'],
      events: ['`onChange(documents)` - the new list (`{ id, docType, fileName, sizeBytes }`).'],
      validation: ['Shared upload rules: PDF or JPG, 2 MB each. A type already uploaded is not offered again.', 'A file with no type chosen is refused (`Choose a document type before uploading.`) even if the disabled control is bypassed.'],
      usage: ['Types: `Signed CAF`, the ID types (Qatar ID (QID), Passport, GCC ID, Diplomatic ID) and `Other ID`. Used by the legacy CAF-Manual and CAF-Touch Screen flows (see CAF Signature Capture).'],
      accessibility: ['Each Remove button is named `Remove {file name}`; errors are `role="alert"`.'],
      devices: ['Detected device: the `Web` and `Tablet` stories select it (toolbar Device switch, or `?device=tablet`).'],
    }),
  },
  argTypes: { documents: { control: 'object', description: 'The documents uploaded so far.' }, onChange: { control: false } },
  args: { documents: [], onChange: fn() },
  render: (args) => <Stateful {...args} />,
  decorators: [(Story) => <div style={{ maxWidth: 640 }}><Story /></div>],
} satisfies Meta<typeof CafDocumentUpload>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Initiate Scan' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Initiate Scan' })).toHaveAttribute('title', 'Choose a document type first');
  },
};

export const Web: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await chooseOption(canvasElement, /Document Type/, 'Signed CAF');
    await userEvent.click(canvas.getByRole('button', { name: 'Initiate Scan' }));
    await waitFor(() => expect(canvas.getByText(/scan-\d{14}-signed-caf\.jpg/)).toBeVisible(), { timeout: 5000 });
    await expect(args.onChange).toHaveBeenCalled();
  },
};

export const Tablet: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Upload Document' })).toBeDisabled();
    await chooseOption(canvasElement, /Document Type/, 'Signed CAF');
    await expect(canvas.getByRole('button', { name: 'Upload Document' })).toBeEnabled();
    await chooseFile(canvasElement, pdfFile('caf-signed.pdf'), /Choose the signed document/);
    await waitFor(() => expect(canvas.getByText('caf-signed.pdf')).toBeVisible());
    await expect(args.onChange).toHaveBeenCalledTimes(1);
    // A type already uploaded is not offered again, and the file can be removed.
    await userEvent.click(canvas.getByRole('button', { name: 'Remove caf-signed.pdf' }));
    await waitFor(() => expect(canvas.queryByText('caf-signed.pdf')).toBeNull());
  },
};

export const Populated: Story = {
  args: { documents: DOCS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('caf-signed.pdf')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove passport-page.pdf' }));
    await waitFor(() => expect(canvas.queryByText('passport-page.pdf')).toBeNull());
  },
};

export const AtTheLimit: Story = {
  args: {
    documents: ['Signed CAF', 'Qatar ID (QID)', 'Passport', 'GCC ID', 'Other ID'].map((docType, i) => ({ id: `d${i}`, docType, fileName: `file-${i + 1}.pdf`, sizeBytes: 120000 })),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Maximum of 5 documents reached. Remove one to upload another.')).toBeVisible();
  },
};

export const WrongFileTypeRejected: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement, args }) => {
    await chooseOption(canvasElement, /Document Type/, 'Passport');
    await chooseFile(canvasElement, wrongTypeFile('notes.docx'), /Choose the signed document/);
    await expectAlert(canvasElement, 'notes.docx: only PDF or JPG files can be uploaded.');
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const OversizeFileRejected: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement, args }) => {
    await chooseOption(canvasElement, /Document Type/, 'Passport');
    await chooseFile(canvasElement, oversizeFile('big-scan.pdf'), /Choose the signed document/);
    await expectAlert(canvasElement, /big-scan\.pdf is .*The limit is 2 MB per file\./);
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
