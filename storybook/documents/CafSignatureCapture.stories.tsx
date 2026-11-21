import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { CafSignatureCapture } from '../../src/components/patterns/CafSignatureCapture';
import { docsParameters } from '../_shared/docs';
import { PNG_DATA_URL, drawSignature } from './fixtures';

type Props = Parameters<typeof CafSignatureCapture>[0];
type Value = Props['value'];

/** Holds the CAF value the way the wizard step does, so signing, ticking and attaching work when clicked. */
function Stateful(props: Props) {
  const [value, setValue] = useState<Value>(props.value);
  return (
    <CafSignatureCapture
      {...props}
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange(v);
      }}
    />
  );
}

const ORDER_SUMMARY = [
  { label: 'Plan', value: 'Red Plus 300' },
  { label: 'Monthly charge', value: 'QAR 300.00' },
  { label: 'Contract', value: '24 months' },
];
const REQUIREMENTS = [{ id: 'vat-document', label: 'VAT Document', reason: 'A VAT registration number was entered on the new billing account.' }];

const meta = {
  title: 'Documents/CAF Signature Capture',
  component: CafSignatureCapture,
  parameters: {
    ...docsParameters({
      purpose: 'The Customer Application Form step: the form, the customer\'s signature and, once signed, the documents. This story set shows its signature capture and its document parts through the real props; the terms text (Full Terms, Key Information, bilingual content) is covered by the Terms and CAF stories of the Patterns category.',
      source: 'src/components/patterns/CafSignatureCapture.tsx (signature: SignatureCapture.tsx; documents: CafDocumentUpload.tsx, AdditionalDocumentsUpload.tsx)',
      variants: ['**Picker-led** (default): the agent chooses a CAF Type - Digital (in-app signature), Manual or Touch Screen (signed off screen; the signed paperwork is uploaded as Signed Documents).', '**Device-led** (`autoDetectDeviceType`, Postpaid): the CAF type is read from the device and never offered - Web resolves to Digital (mouse), Tablet to Touch Screen (finger) - and both sign on THIS screen. The legacy Signed Documents upload is replaced by Additional Documents once signed.', '`requireTermsAgreement`: the pad stays disabled until the customer ticks "I have read and agree to the full Terms and Conditions".', '`supplementaryForm`: a Supplementary Form with a second consent and a second signature by the secondary contact, on its own.'],
      states: ['Unsigned: the pad (`Please Sign`, Clear, Save).', 'Pad disabled until the agreements are ticked.', 'Signed: the pad is replaced by a `Signed` badge and the signature thumbnail - it is locked, nothing can be re-signed here.', 'With a Supplementary Form: Additional Documents appear only once BOTH signatures are captured.', 'Documents blocked: a document type chosen with no file, or a required document missing - reported through `value.documentsBlocked` so the step holds Continue.'],
      events: ['`onChange(value)` - the whole CAF value (`cafType`, `signatureDataUrl`, `termsAccepted`, `supplementaryAgreed`, `secondarySignatureDataUrl`, `documents`, `additionalDocuments`, `documentsBlocked`, `termsLanguage`).', '`onSave()` - the Save button shown after signing (device-led mode).'],
      usage: ['Additional Documents are agent-only: hidden in the customer-facing pop-up. Page-level Continue is the wizard\'s footer, never a button here.'],
      accessibility: ['Agreements are labelled checkboxes; the CAF Type tiles are toggle buttons (`aria-pressed`); the signature pad needs a pointer.'],
      devices: ['The CAF type follows the device: use the toolbar Device switch (or `?device=tablet`); the `Web` and `Tablet` stories select it.'],
      restrictions: ['`fullTerms` loads the full Terms and Conditions text and renders the closing signature block inside it; it is large and not repeated here.'],
    }),
  },
  argTypes: {
    autoDetectDeviceType: { control: 'boolean', description: 'Read the CAF type from the device instead of offering the picker.' },
    requireTermsAgreement: { control: 'boolean', description: 'The pad stays disabled until the customer agrees to the full terms.' },
    customerName: { control: 'text', description: 'The applicant.' },
    idLabel: { control: 'text', description: 'Binds an ID line onto the CAF preview.' },
    idValue: { control: 'text', description: 'The ID number shown.' },
    journey: { control: 'inline-radio', options: ['postpaid', 'prepaid'], description: 'Which journey\'s form this is.' },
    fullTerms: { control: 'boolean', description: 'New Connection layout: the full terms on the page (not repeated here).' },
    maxAdditionalDocuments: { control: 'number', description: 'Cap on post-signature documents (default 10).' },
    documentLabelOptions: { control: 'object', description: 'Post-signature document labels as a list.' },
    documentRequirements: { control: 'object', description: 'Documents this order requires, asked for after signing.' },
    orderSummary: { control: 'object', description: 'Customer-facing recap read before signing.' },
    supplementaryForm: { control: 'object', description: 'The actual user\'s rows and name.' },
    value: { control: 'object', description: 'The CAF value.' },
    onChange: { control: false },
    onSave: { control: false },
    ipayActivation: { control: false },
    journeyDocuments: { control: false },
    legalFacts: { control: false },
    keyInformation: { control: false },
    termsSections: { control: false },
    ipayTermsSections: { control: false },
  },
  args: { value: {}, onChange: fn(), customerName: 'Aisha Mohammed Al Naimi', idLabel: 'QID', idValue: '29850123456', orderSummary: ORDER_SUMMARY },
  render: (args) => <Stateful {...args} />,
  decorators: [(Story) => <div style={{ maxWidth: 880 }}><Story /></div>],
} satisfies Meta<typeof CafSignatureCapture>;
export default meta;
type Story = StoryObj<typeof CafSignatureCapture>;

/* Picker-led ------------------------------------------------------------------------------------------------------ */

export const PickerNoTypeChosen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'CAF-Digital' })).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.queryByText('Please Sign')).toBeNull();
  },
};

export const DigitalSignThenLocked: Story = {
  name: 'Digital: sign, then locked (interactive)',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'CAF-Digital' }));
    await expect(canvas.getByText('Vodafone Customer Application Form')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeDisabled();
    await drawSignature(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(canvas.getByText('Signed')).toBeVisible());
    await expect(canvas.getByRole('img', { name: 'Signature' })).toBeVisible();
    await expect(canvas.queryByText('Please Sign')).toBeNull();
    await expect(canvas.getByText('Signed Documents')).toBeVisible();
    await expect(args.onChange).toHaveBeenCalledWith(expect.objectContaining({ cafType: 'Digital', signatureDataUrl: expect.stringMatching(/^data:image\/png/) }));
  },
};

export const DigitalSigned: Story = {
  args: { value: { cafType: 'Digital', signatureDataUrl: PNG_DATA_URL } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Signed')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Save' })).toBeNull();
  },
};

export const ManualCaf: Story = {
  args: { value: { cafType: 'Manual' } },
  parameters: { docs: { description: { story: 'CAF-Manual is signed on paper: there is no in-app signature, and the signed paperwork is uploaded as Signed Documents straight away.' } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Signed Documents')).toBeVisible();
    await expect(canvas.queryByText('Please Sign')).toBeNull();
  },
};

export const TouchScreenCaf: Story = {
  args: { value: { cafType: 'Touch Screen' } },
  parameters: { docs: { description: { story: 'In picker-led mode CAF-Touch Screen means signing on a separate terminal, so only the Signed Documents upload shows. In device-led mode (see the Tablet story) Touch Screen signs on this screen with a finger.' } } },
};

/* Device-led ------------------------------------------------------------------------------------------------------ */

export const Web: Story = {
  name: 'Web: device-led, Digital (unsigned, terms required)',
  args: { autoDetectDeviceType: true, requireTermsAgreement: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(args.onChange).toHaveBeenCalledWith(expect.objectContaining({ cafType: 'Digital' })));
    await expect(canvas.queryByRole('button', { name: 'CAF-Digital' })).toBeNull();
    await expect(canvas.getByText('Plan')).toBeVisible();
    // The pad is disabled until the agreement is ticked.
    await expect(canvasElement.querySelector('canvas')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(canvas.getByRole('checkbox'));
    await waitFor(() => expect(canvasElement.querySelector('canvas')).not.toHaveAttribute('aria-disabled'));
    await drawSignature(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(canvas.getByRole('heading', { name: 'Signed' })).toBeVisible());
    await expect(canvas.getByRole('img', { name: 'Signature' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Additional Documents' })).toBeVisible();
  },
};

export const Tablet: Story = {
  name: 'Tablet: device-led, Touch Screen (unsigned)',
  args: { autoDetectDeviceType: true, requireTermsAgreement: true },
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement, args }) => {
    await waitFor(() => expect(args.onChange).toHaveBeenCalledWith(expect.objectContaining({ cafType: 'Touch Screen' })));
    await expect(canvasElement.querySelector('canvas')).toBeVisible();
  },
};

export const SignedWithAdditionalDocuments: Story = {
  args: {
    autoDetectDeviceType: true,
    documentLabelOptions: ['QID', 'Passport', 'Employee ID'],
    documentRequirements: REQUIREMENTS,
    value: { cafType: 'Digital', signatureDataUrl: PNG_DATA_URL, termsAccepted: true },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Signed' })).toBeVisible();
    await expect(await canvas.findByRole('region', { name: 'Required documents' })).toBeVisible();
    await waitFor(() => expect(args.onChange).toHaveBeenCalledWith(expect.objectContaining({ documentsBlocked: true })));
  },
};

export const SignedOnTablet: Story = {
  args: {
    autoDetectDeviceType: true,
    documentLabelOptions: ['QID', 'Passport', 'Employee ID'],
    value: { cafType: 'Touch Screen', signatureDataUrl: PNG_DATA_URL, termsAccepted: true },
  },
  tags: ['tablet'], globals: { device: 'tablet' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Signed' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Initiate Scan' })).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Upload Document' })).toBeVisible();
  },
};

export const SupplementaryFormSecondContactUnsigned: Story = {
  name: 'Supplementary Form: second signature outstanding',
  args: {
    autoDetectDeviceType: true,
    requireTermsAgreement: true,
    supplementaryForm: { rows: [{ label: 'Actual user', value: 'Omar Al Naimi' }, { label: 'Relationship', value: 'Son' }], actualUserName: 'Omar Al Naimi' },
    value: { cafType: 'Digital', signatureDataUrl: PNG_DATA_URL, termsAccepted: true, supplementaryAgreed: true },
  },
  parameters: { docs: { description: { story: 'The primary customer has signed (the CAF and the Supplementary Form). The secondary contact ticks their own consent and signs on their own pad; Additional Documents stay hidden until that second signature is captured.' } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('region', { name: 'Supplementary Form - secondary contact' })).toBeVisible();
    await expect(canvas.queryByRole('heading', { name: 'Additional Documents' })).toBeNull();
    await userEvent.click(canvas.getAllByRole('checkbox')[0]);
    await drawSignature(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(canvas.getByRole('heading', { name: 'Additional Documents' })).toBeVisible());
  },
};

export const PrepaidForm: Story = {
  args: { autoDetectDeviceType: true, journey: 'prepaid', formDetails: [{ label: 'Mobile number', value: '+974 3399 0001' }, { label: 'SIM serial', value: '8974412345678901234' }] },
};
