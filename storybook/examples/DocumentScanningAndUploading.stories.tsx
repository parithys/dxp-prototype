import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AdditionalDocumentsUpload } from '../../src/capabilities';
import type { AdditionalDocument } from '../../src/capabilities';
import { Button, Card, detectDeviceType } from 'dxp-ui';
import { consolidatedDocuments, documentTypeOptionsFor, mandatoryDocumentLabels, missingMandatoryDocuments } from '../../src/engines/journeyDocuments';
import { store } from '../../src/stores/store';
import { exampleParameters } from './_harness';
import type { Values } from './_harness';
import { SLOW, chooseFile, chooseOption, jpgFile } from './_fixtures';

const meta: Meta = {
  title: 'Application Examples/Document Scanning and Uploading',
  parameters: exampleParameters({
    purpose: 'Additional Documents as one scenario: the three documents every order must carry - Special Needs Card, Star Number Discount Approval and Upfront Payment Receipt (public/config/document-types.json, `mandatory`) - the Document Type list that offers those types only, the capture buttons by device, the preview with Accept / Rescan, and a Continue that stays disabled until all three are uploaded. Built from the production Additional Documents upload and the document-rules engine.',
    source: 'src/components/domain/AdditionalDocumentsUpload.tsx (via src/capabilities/DocumentUpload), DocumentCaptureActions.tsx and src/engines/journeyDocuments.ts',
    variants: [
      'Web: **Upload Document** and **Initiate Scan** (the desk scanner) beside the Document Type. A flatbed document (Passport, CAF, Upfront Payment Receipt) takes Add Page for further pages; an OCR document is one scan.',
      'Tablet: **Upload Document** only - nothing is scanned and there is no camera capture.',
      'With journey documents: what the journey already holds (an ID scan, the signed CAF) is listed above, viewable and never removable here.',
    ],
    states: ['Nothing uploaded (all three missing, Continue disabled)', 'Type chosen, no file (capture buttons enabled, upload pending)', 'File or scan chosen (preview with Accept / Rescan)', 'Uploaded (the type leaves the list; the checklist marks it)', 'All three uploaded (Continue enabled)'],
    events: ['`onChange(documents)` - the uploaded documents (`label`, `fileName`, `sizeBytes`, `origin: "additional-documents"`).', '`onPendingChange(pending)` - a type is chosen but its document is not attached yet; the journey holds Continue meanwhile.'],
    validation: ['Only PDF or JPG up to the shared upload limit (see Documents / File Upload); a refused file shows its reason under the buttons.', 'The capture buttons are disabled until a Document Type is chosen ("Choose a Document Type first").', 'Continue needs every mandatory type among the uploaded ones (`missingMandatoryDocuments`).'],
    devices: ['The device is detected once per page (`lib/deviceType.ts`): use the toolbar **Device** switch or `?device=tablet`. The `Web` and `Tablet` stories select it and their plays assert the buttons that device offers.'],
    restrictions: ['The desk scanner is simulated: Initiate Scan produces one A4 JPEG after a short delay.'],
  }, 900, 'padded'),
};
export default meta;
type Story = StoryObj<typeof meta>;

const personaId = () => store.getState().persona.activePersonaId;
const context = (values: Values) => ({ values, personaId: personaId(), journey: 'new-connection' });

/** The page as the CAF step has it: the uploader, what is still missing, and the Continue the journey holds until nothing is. */
function DocumentsPage({ values = {} }: { values?: Values }) {
  const [docs, setDocs] = useState<AdditionalDocument[]>([]);
  const [pending, setPending] = useState(false);
  const mandatory = mandatoryDocumentLabels();
  const missing = missingMandatoryDocuments(docs);
  const [done, setDone] = useState(false);
  return (
    <div className="stack gap-4">
      <Card className="p-6 stack gap-4">
        <AdditionalDocumentsUpload
          documents={docs}
          onChange={setDocs}
          labelOptions={documentTypeOptionsFor(context(values))}
          journeyDocuments={consolidatedDocuments(values)}
          onPendingChange={setPending}
          maxDocuments={5}
        />
      </Card>
      <section aria-label="Mandatory documents" className="card pad-panel stack gap-2">
        <h3 className="title title-sm">Mandatory documents</h3>
        <ul className="stack gap-1">
          {mandatory.map((label) => (
            <li key={label} className="caption-secondary">
              {docs.some((d) => d.label === label) ? 'Uploaded' : 'Missing'}: {label}
            </li>
          ))}
        </ul>
      </section>
      <div className="row justify-end">
        <Button disabled={missing.length > 0 || pending} onClick={() => setDone(true)}>
          Continue
        </Button>
      </div>
      {done && (
        <p role="status" className="notice-success pad-row">
          The journey would carry on to Payment. Nothing was written: this example holds its state locally.
        </p>
      )}
    </div>
  );
}

const MANDATORY = ['Special Needs Card', 'Star Number Discount Approval', 'Upfront Payment Receipt'];

/** Attaches one document under its type: pick the type, then scan (web) or upload (either device), then Accept the preview. */
async function attach(canvasElement: HTMLElement, label: string, how: 'upload' | 'scan') {
  const canvas = within(canvasElement);
  await chooseOption(canvasElement, 'Document Type', label);
  if (how === 'scan') await userEvent.click(canvas.getByRole('button', { name: 'Initiate Scan' }));
  else await chooseFile(canvasElement, 'Choose the document to upload', jpgFile(`${label.toLowerCase().replace(/\s+/g, '-')}.jpg`));
  await userEvent.click(await canvas.findByRole('button', { name: 'Accept' }, SLOW));
  await expect(await canvas.findByText(`Uploaded: ${label}`)).toBeVisible();
}

export const Web: Story = {
  globals: { device: 'web' },
  render: () => <DocumentsPage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('combobox', { name: 'Document Type' }, SLOW);
    // Nothing uploaded: all three are missing, Continue is disabled, and the capture buttons wait for a type.
    for (const label of MANDATORY) await expect(canvas.getByText(`Missing: ${label}`)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
    if (detectDeviceType() !== 'web') return;
    await expect(canvas.getByRole('button', { name: 'Upload Document' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Initiate Scan' })).toBeDisabled();
    // The list offers the mandatory types only.
    await userEvent.click(canvas.getByRole('combobox', { name: 'Document Type' }));
    await expect((await canvas.findAllByRole('option')).map((o: HTMLElement) => o.textContent)).toEqual(expect.arrayContaining(MANDATORY));
    await userEvent.keyboard('{Escape}');
    await attach(canvasElement, 'Special Needs Card', 'scan');
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await attach(canvasElement, 'Star Number Discount Approval', 'upload');
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await attach(canvasElement, 'Upfront Payment Receipt', 'upload');
    // All three uploaded: Continue is enabled.
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled());
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await expect(await canvas.findByRole('status')).toBeVisible();
  },
};

export const Tablet: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  parameters: { viewport: { defaultViewport: 'tablet' } },
  render: () => <DocumentsPage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('combobox', { name: 'Document Type' }, SLOW);
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
    if (detectDeviceType() !== 'tablet') return;
    // The tablet uploads only: no scanner button at all.
    await expect(canvas.getByRole('button', { name: 'Upload Document' })).toBeDisabled();
    await expect(canvas.queryByRole('button', { name: 'Initiate Scan' })).toBeNull();
    for (const label of MANDATORY) await attach(canvasElement, label, 'upload');
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled());
  },
};

export const RefusedFile: Story = {
  name: 'Refused file (wrong type)',
  render: () => <DocumentsPage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('combobox', { name: 'Document Type' }, SLOW);
    await chooseOption(canvasElement, 'Document Type', 'Special Needs Card');
    await chooseFile(canvasElement, 'Choose the document to upload', new File(['not a document the app accepts'], 'notes.docx', { type: 'application/msword' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Accept' }, SLOW));
    // The shared upload rules refuse it with a reason, and nothing is attached.
    await expect(await canvas.findByRole('alert')).toHaveTextContent('notes.docx: only PDF or JPG files can be uploaded.');
    await expect(canvas.getByText('Missing: Special Needs Card')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
  },
};

const journeyValues: Values = {
  contact: { idType: 'QID', idNumber: '28456701234', qidScans: { frontScanned: true, backScanned: true, frontFile: '28456701234-front.jpg', backFile: '28456701234-back.jpg', source: 'upload' } },
};

export const WithJourneyDocuments: Story = {
  name: 'With the journey\'s own documents',
  render: () => <DocumentsPage values={journeyValues} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The ID the customer was identified with is listed here, to open and download.
    const toggle = await canvas.findByRole('button', { name: /View All Journey Documents \(2\)/ }, SLOW);
    await userEvent.click(toggle);
    await expect(canvas.getByText('QID Document - Front')).toBeVisible();
    await expect(canvas.getByText('QID Document - Back')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
  },
};
