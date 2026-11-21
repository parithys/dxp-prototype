import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { AdditionalDocumentsUpload } from '../../src/components/domain/AdditionalDocumentsUpload';
import type { AdditionalDocument } from '../../src/components/domain/AdditionalDocumentsUpload';
import { mandatoryDocumentLabels } from '../../src/engines/journeyDocuments';
import type { DocumentRequirement, JourneyDocument } from '../../src/engines/journeyDocuments';
import { docsParameters } from '../_shared/docs';
import { PDF_DATA_URL, PNG_DATA_URL, chooseFile, chooseOption, expectAlert, jpgFile, oversizeFile, pdfFile, seedStoredFile, wrongTypeFile } from './fixtures';

type Props = Parameters<typeof AdditionalDocumentsUpload>[0];

/** Holds the documents the way the CAF step does; seeds the in-memory file store so a listed document can be opened. */
function Stateful(props: Props) {
  const [documents, setDocuments] = useState<AdditionalDocument[]>(props.documents);
  // The list reads the file store while it renders, so the stored files must exist before the first render (an effect would be too late).
  useState(() => props.documents.forEach((d) => seedStoredFile(d.id, d.fileName.endsWith('.pdf') ? PDF_DATA_URL : PNG_DATA_URL, d.fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png')));
  useEffect(() => {
    const undo = props.documents.map((d) => (d.fileName.endsWith('.pdf') ? seedStoredFile(d.id, PDF_DATA_URL, 'application/pdf') : seedStoredFile(d.id, PNG_DATA_URL, 'image/png')));
    return () => undo.forEach((u) => u());
  }, [props.documents]);
  return (
    <AdditionalDocumentsUpload
      {...props}
      documents={documents}
      onChange={(d) => {
        setDocuments(d);
        props.onChange(d);
      }}
    />
  );
}

const TYPES = ['QID', 'Passport', 'GCC ID', 'Employee ID', 'Special Needs Card'];
const UPLOADED: AdditionalDocument[] = [
  { id: 'story-doc-1', label: 'Employee ID', fileName: 'employee-id.png', sizeBytes: 90112, origin: 'additional-documents' },
  { id: 'story-doc-2', label: 'Special Needs Card', fileName: 'special-needs-card.pdf', sizeBytes: 204800, origin: 'additional-documents' },
];
const REQUIREMENTS: DocumentRequirement[] = [
  { id: 'vat-document', label: 'VAT Document', reason: 'A VAT registration number was entered on the new billing account.' },
  { id: 'court-type-order', label: 'Court Type Order', reason: 'The applicant is under 18.' },
];
const JOURNEY_DOCS: JourneyDocument[] = [
  { id: 'j1', label: 'QID Document (Front)', source: 'Customer Verification · Uploaded', fileName: 'qid-front.png', dataUrl: PNG_DATA_URL },
  { id: 'j2', label: 'QID Document (Back)', source: 'Customer Verification · Uploaded', fileName: 'qid-back.png', dataUrl: PNG_DATA_URL },
  { id: 'j3', label: 'Signed CAF', source: 'CAF & Signature · Signed', fileName: 'caf-signed.pdf', dataUrl: PDF_DATA_URL },
];

const meta = {
  title: 'Documents/Additional Documents Upload',
  component: AdditionalDocumentsUpload,
  parameters: {
    ...docsParameters({
      purpose: 'The end of the journey, after the CAF is signed: (1) the documents this order REQUIRES, asked for as cards; (2) anything else the agent attaches, labelled by Document Type; (3) every document the journey holds, consolidated and viewable. No signature is needed for any of it. This is the capability `src/capabilities/DocumentUpload` exposes.',
      source: 'src/components/domain/AdditionalDocumentsUpload.tsx (rules: documentUploadRules.ts, engines/journeyDocuments.ts; file content: lib/documentFileStore.ts)',
      variants: ['Document type chosen from a list (`labelOptions`) or typed (`Document Label`).', 'Required document cards (`requirements`), each with its own capture buttons.', 'Mandatory documents: when any configured type is `mandatory`, the Document Type list offers those only.', '`reviewScan` (default): a scan or chosen file is shown at once with Accept (attaches it) and Rescan (web). `reviewScan={false}`: stage the file, then `Upload Document` with a progress bar; a flatbed type (Passport, CAF ...) takes several pages (`Add Page`) combined into one PDF.', '`bare` (no card, no heading, no journey documents), `whiteBackground`.'],
      states: ['Empty / Disabled (type not chosen yet: capture buttons disabled, tooltip `Choose a Document Type first`)', 'Scanned or chosen, waiting for Accept', 'Uploading (progressbar `Upload progress`, `Uploading {file} - n%`)', 'Required documents missing / all supplied', 'Uploaded list with Remove (confirmation dialog) and a view link per document', 'View All Journey Documents expanded / collapsed', 'At the limit (default 10): `Maximum of N documents reached. Remove one to upload another.`', 'Every offered type already uploaded: the upload panel is hidden', 'Validation error: wrong type, empty or oversize file'],
      events: ['`onChange(documents)` - the full list.', '`onPendingChange(true)` - a type is chosen but its document is not uploaded yet (the caller blocks Continue).', '`onMissingRequiredChange(n)` - required documents still missing (the caller holds Continue until 0).'],
      validation: ['Shared upload rules: PDF or JPG, 2 MB, not empty. Messages: `{file}: only PDF or JPG files can be uploaded.` / `{file} is {size}. The limit is 2 MB per file.`', 'A type already uploaded is not offered again. Only documents uploaded in this section (`origin: "additional-documents"`) can be removed here; journey documents can be opened, never removed.'],
      usage: ['Removing asks `Remove this document?` (the shared Remove Document dialog) unless `confirmRemove={false}`.', 'Opening a document shows it in a side drawer (image, PDF, or the drawn specimen for a scan the reader kept no image of).'],
      accessibility: ['Required documents are a labelled region with a status announcement; the upload progress is a `progressbar`; the journey-documents toggle uses `aria-expanded` / `aria-controls`; Remove buttons are named `Remove {file name}`.'],
      devices: ['Web: `Initiate Scan` and `Upload Document` side by side (`uploadOnWeb`). Tablet: `Upload Document` only, no scan, no Rescan. The device is detected: use the toolbar Device switch or `?device=tablet`; the `Tablet` stories select it.'],
    }),
  },
  argTypes: {
    labelOptions: { control: 'object', description: 'Document types to pick from; absent: the label is typed.' },
    maxDocuments: { control: 'number', description: 'Cap on documents (default 10).' },
    bare: { control: 'boolean', description: 'No card, no heading, no journey documents.' },
    confirmRemove: { control: 'boolean', description: 'Ask "Remove this document?" before removing.' },
    reviewScan: { control: 'boolean', description: 'Show a scan/chosen file at once with Accept and Rescan (default true).' },
    requirements: { control: 'object', description: 'Documents the order requires ({ id, label, reason }).' },
    journeyDocuments: { control: 'object', description: 'Documents the journey already holds.' },
    documents: { control: 'object', description: 'Documents uploaded in this section.' },
    onChange: { control: false },
    onPendingChange: { control: false },
    onMissingRequiredChange: { control: false },
  },
  args: { documents: [], labelOptions: TYPES, onChange: fn(), onPendingChange: fn(), onMissingRequiredChange: fn() },
  render: (args) => <Stateful {...args} />,
  decorators: [(Story) => <div style={{ maxWidth: 760 }}><Story /></div>],
} satisfies Meta<typeof AdditionalDocumentsUpload>;
export default meta;
type Story = StoryObj<typeof AdditionalDocumentsUpload>;

const dialog = () => within(document.body).findByRole('dialog', { name: 'Remove this document?' });

export const Default: Story = {
  name: 'Default (type not chosen: disabled)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Initiate Scan' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Upload Document' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Upload Document' })).toHaveAttribute('title', 'Choose a Document Type first');
  },
};

export const WebScanThenAccept: Story = {
  name: 'Web: scan, review, Accept (interactive)',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await chooseOption(canvasElement, /Document Type/, 'QID');
    await expect(args.onPendingChange).toHaveBeenLastCalledWith(true);
    await userEvent.click(canvas.getByRole('button', { name: 'Initiate Scan' }));
    await expect(await canvas.findByLabelText('Scanned document preview', undefined, { timeout: 5000 })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Rescan' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(canvas.getByRole('group', { name: 'Uploaded documents' })).toHaveTextContent('QID'), { timeout: 5000 });
    await expect(args.onChange).toHaveBeenCalledTimes(1);
    // The pending flag clears in an effect, a render after the document is listed.
    await waitFor(() => expect(args.onPendingChange).toHaveBeenLastCalledWith(false));
  },
};

export const WebUploadFile: Story = {
  name: 'Web: Upload Document (file chosen, Accept)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await chooseOption(canvasElement, /Document Type/, 'Passport');
    await chooseFile(canvasElement, jpgFile('passport.jpg'), /Choose the document to upload/);
    await expect((await canvas.findAllByText('passport.jpg'))[0]).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Remove passport.jpg' })).toBeVisible(), { timeout: 5000 });
  },
};

export const Tablet: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Initiate Scan' })).toBeNull();
    await chooseOption(canvasElement, /Document Type/, 'GCC ID');
    await chooseFile(canvasElement, jpgFile('gcc-id.jpg'), /Choose the document to upload/);
    await expect((await canvas.findAllByText('gcc-id.jpg'))[0]).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Rescan' })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Remove gcc-id.jpg' })).toBeVisible(), { timeout: 5000 });
  },
};

export const FreeTextLabel: Story = {
  args: { labelOptions: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Document Label')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Upload Document' })).toHaveAttribute('title', 'Enter a Document Label first');
    await userEvent.type(canvas.getByLabelText('Document Label'), 'Employer Letter');
    await expect(canvas.getByRole('button', { name: 'Upload Document' })).toBeEnabled();
  },
};

export const RequiredDocuments: Story = {
  args: { requirements: REQUIREMENTS },
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Required documents' })).toBeVisible();
    await expect(canvas.getByText('A VAT registration number was entered on the new billing account.')).toBeVisible();
    await expect(args.onMissingRequiredChange).toHaveBeenLastCalledWith(2);
    await chooseFile(canvasElement, pdfFile('vat.pdf'), /Choose the vat document/);
    await waitFor(() => expect(args.onMissingRequiredChange).toHaveBeenLastCalledWith(1), { timeout: 5000 });
    await expect(canvas.getByRole('button', { name: 'Remove vat.pdf' })).toBeVisible();
  },
};

export const RequiredDocumentsWeb: Story = {
  args: { requirements: REQUIREMENTS.slice(0, 1) },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement.querySelector('section[aria-label="Required documents"]') as HTMLElement);
    await expect(region.getByRole('button', { name: 'Initiate Scan' })).toBeVisible();
    await expect(region.getByRole('button', { name: 'Upload Document' })).toBeVisible();
  },
};

export const MandatoryDocuments: Story = {
  name: 'Mandatory documents (configured)',
  args: { labelOptions: mandatoryDocumentLabels() },
  parameters: { docs: { description: { story: 'Types marked `mandatory` in `public/config/document-types.json` are the only ones the Document Type list offers, whatever the journey, role or customer; the caller holds Continue until they are uploaded (`missingMandatoryDocuments`).' } } },
};

export const Populated: Story = {
  args: { documents: UPLOADED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole('group', { name: 'Uploaded documents' });
    await expect(list).toHaveTextContent('Employee ID');
    await expect(list).toHaveTextContent('special-needs-card.pdf');
  },
};

export const RemoveAsksForConfirmation: Story = {
  args: { documents: UPLOADED },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove employee-id.png' }));
    const confirm = within(await dialog());
    await expect(confirm.getByText('employee-id.png')).toBeVisible();
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(within(document.body).queryByRole('dialog', { name: 'Remove this document?' })).toBeNull());
    await expect(canvas.getByRole('button', { name: 'Remove employee-id.png' })).toBeVisible();
    await expect(args.onChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove employee-id.png' }));
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Remove Document' }));
    await waitFor(() => expect(canvas.queryByRole('button', { name: 'Remove employee-id.png' })).toBeNull());
    await expect(args.onChange).toHaveBeenCalledTimes(1);
  },
};

export const RemoveWithoutConfirmation: Story = {
  args: { documents: UPLOADED, confirmRemove: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove employee-id.png' }));
    await waitFor(() => expect(canvas.queryByRole('button', { name: 'Remove employee-id.png' })).toBeNull());
  },
};

export const ViewAUploadedDocument: Story = {
  args: { documents: UPLOADED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Employee ID' }));
    await expect(await within(document.body).findByRole('img', { name: 'Employee ID - employee-id.png' })).toBeVisible();
  },
};

export const JourneyDocumentsToggle: Story = {
  args: { documents: UPLOADED, journeyDocuments: JOURNEY_DOCS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: /View All Journey Documents/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByRole('button', { name: 'QID Document - Front' })).toBeVisible();
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  },
};

export const AtTheLimit: Story = {
  args: { documents: UPLOADED, maxDocuments: 2 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Maximum of 2 documents reached. Remove one to upload another.')).toBeVisible();
  },
};

export const AllOfferedTypesUploaded: Story = {
  args: { documents: UPLOADED, labelOptions: ['Employee ID', 'Special Needs Card'] },
  parameters: { docs: { description: { story: 'A configured list with nothing left to offer: there is nothing to upload as, so the upload panel is not shown.' } } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('combobox')).toBeNull();
  },
};

export const WrongFileTypeRejected: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement, args }) => {
    // The file is shown for review first; the upload rules refuse it when the agent presses Accept.
    await chooseOption(canvasElement, /Document Type/, 'QID');
    await chooseFile(canvasElement, wrongTypeFile('notes.docx'), /Choose the document to upload/);
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Accept' }));
    await expectAlert(canvasElement, 'notes.docx: only PDF or JPG files can be uploaded.');
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const OversizeFileRejected: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement, args }) => {
    await chooseOption(canvasElement, /Document Type/, 'QID');
    await chooseFile(canvasElement, oversizeFile('big-scan.pdf'), /Choose the document to upload/);
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Accept' }));
    await expectAlert(canvasElement, /big-scan\.pdf is .*The limit is 2 MB per file\./);
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const StageAndUploadWithProgress: Story = {
  name: 'Upload with progress (reviewScan off)',
  args: { reviewScan: false },
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await chooseOption(canvasElement, /Document Type/, 'Passport');
    await chooseFile(canvasElement, pdfFile('passport.pdf'), /Choose the document to upload/);
    await expect(await canvas.findByText('passport.pdf')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /^Upload Document$/ }));
    await expect(await canvas.findByRole('progressbar', { name: 'Upload progress' })).toBeVisible();
    await waitFor(() => expect(args.onChange).toHaveBeenCalledTimes(1), { timeout: 5000 });
    await waitFor(() => expect(canvas.queryByRole('progressbar')).toBeNull(), { timeout: 5000 });
  },
};

export const FlatbedPages: Story = {
  name: 'Flatbed scan: Add Page (reviewScan off, web)',
  args: { reviewScan: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await chooseOption(canvasElement, /Document Type/, 'Passport');
    await expect(canvas.getByRole('button', { name: 'Add Page' })).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Initiate Scan' }));
    await waitFor(() => expect(canvas.getByText(/1 page, uploaded as one PDF/)).toBeVisible(), { timeout: 5000 });
    await userEvent.click(canvas.getByRole('button', { name: 'Add Page' }));
    await waitFor(() => expect(canvas.getByText(/2 pages, uploaded as one PDF/)).toBeVisible(), { timeout: 5000 });
  },
};

export const Bare: Story = { args: { bare: true, documents: UPLOADED, journeyDocuments: JOURNEY_DOCS } };
