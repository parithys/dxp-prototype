import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { SupportingDocumentField } from '../../src/components/domain/SupportingDocumentField';
import type { AdditionalDocument } from '../../src/components/domain/AdditionalDocumentsUpload';
import { docsParameters } from '../_shared/docs';
import { chooseFile, expectAlert, jpgFile, oversizeFile, wrongTypeFile } from './fixtures';

type Props = Parameters<typeof SupportingDocumentField>[0];

function Stateful(props: Props) {
  const [document, setDocument] = useState<AdditionalDocument | undefined>(props.document);
  return (
    <SupportingDocumentField
      {...props}
      document={document}
      onChange={(d) => {
        setDocument(d);
        props.onChange(d);
      }}
    />
  );
}

const ATTACHED: AdditionalDocument = { id: 'doc-1', label: 'VAT Document', fileName: 'vat-certificate.pdf', sizeBytes: 184320, requirementId: 'vat-document' };

const meta = {
  title: 'Documents/Supporting Document Field',
  component: SupportingDocumentField,
  parameters: {
    ...docsParameters({
      purpose: 'One supporting document, uploaded where the data it supports is entered (a VAT registration number, say) rather than only at the end of the journey. It is attached at once under the document requirement it satisfies, so Additional Documents later shows it as already attached.',
      source: 'src/components/domain/SupportingDocumentField.tsx',
      variants: ['Web: `Initiate Scan` only (the desk scanner).', 'Tablet: `Upload Document` only.'],
      states: ['Empty (helper text: PDF or JPG, up to 2 MB)', 'Attached (file name and size, `Remove`; the tablet button reads `Replace Document`)', 'Validation error (type or size) shown as an alert under the field'],
      events: ['`onChange(document | undefined)` - the attached document (`{ id, label, fileName, sizeBytes, requirementId }`) or undefined when removed.'],
      validation: ['Checked against the shared upload rules: PDF or JPG only (`{file}: only PDF or JPG files can be uploaded.`), non-empty, at most 2 MB (`{file} is {size}. The limit is 2 MB per file.`).'],
      usage: ['Required: the label carries a red asterisk, and the caller gates its own Continue on `document` being present. The content is kept in the in-memory file store, so Additional Documents can open it.'],
      accessibility: ['The required marker is `aria-hidden`; errors are `role="alert"`.'],
      devices: ['The device is detected (toolbar Device switch, or `?device=tablet`). The `Web` and `Tablet` stories select it.'],
    }),
  },
  argTypes: {
    label: { control: 'text', description: 'The document\'s name on the screen.' },
    requirement: { control: 'object', description: 'The configured document type this upload satisfies ({ id, label }).' },
    document: { control: 'object', description: 'The attached document, or undefined.' },
    onChange: { control: false },
  },
  args: { label: 'VAT Registration Certificate', requirement: { id: 'vat-document', label: 'VAT Document' }, document: undefined, onChange: fn() },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof SupportingDocumentField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Web: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Upload Document' })).toBeNull();
    await expect(canvas.getByText('PDF or JPG, up to 2 MB')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Initiate Scan' }));
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Remove' })).toBeVisible(), { timeout: 5000 });
    await expect(canvas.getByText(/scan-\d{14}-vat-document\.jpg/)).toBeVisible();
    await expect(args.onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'VAT Document', requirementId: 'vat-document' }));
  },
};

export const Tablet: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Initiate Scan' })).toBeNull();
    await chooseFile(canvasElement, jpgFile('vat-certificate.jpg'), /Choose the vat registration certificate/);
    await waitFor(() => expect(canvas.getByText(/vat-certificate\.jpg/)).toBeVisible());
    await expect(args.onChange).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'vat-certificate.jpg' }));
    await expect(canvas.getByRole('button', { name: 'Replace Document' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(canvas.getByText('PDF or JPG, up to 2 MB')).toBeVisible());
  },
};

export const Attached: Story = {
  args: { document: ATTACHED },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/vat-certificate\.pdf/)).toBeVisible();
  },
};

export const AttachedOnTablet: Story = {
  args: { document: ATTACHED },
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Replace Document' })).toBeVisible();
  },
};

export const WrongFileTypeRejected: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement, args }) => {
    await chooseFile(canvasElement, wrongTypeFile('notes.docx'), /Choose the vat registration certificate/);
    await expectAlert(canvasElement, 'notes.docx: only PDF or JPG files can be uploaded.');
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const OversizeFileRejected: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement, args }) => {
    await chooseFile(canvasElement, oversizeFile('big-scan.pdf'), /Choose the vat registration certificate/);
    await expectAlert(canvasElement, /big-scan\.pdf is .*The limit is 2 MB per file\./);
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const WithoutRequirement: Story = { args: { label: 'Employer Letter', requirement: undefined } };
