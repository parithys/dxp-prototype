import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { NewCustomerDetailsForm } from '../../src/components/patterns/NewCustomerDetailsForm';
import { docsParameters } from '../_shared/docs';
import { chooseFile, pdfFile, wrongTypeFile } from '../documents/fixtures';

type Props = Parameters<typeof NewCustomerDetailsForm>[0];

/** The form as the ID lookup step holds it: the ID number, expiry and uploaded document names live in the step. */
function Demo(props: Props) {
  const [idNumber, setIdNumber] = useState(props.idNumber);
  const [expiry, setExpiry] = useState(props.expiry);
  const [documents, setDocuments] = useState(props.documents ?? []);
  return (
    <div style={{ maxWidth: 880 }}>
      <NewCustomerDetailsForm
        {...props}
        idNumber={idNumber}
        expiry={expiry}
        documents={documents}
        onIdNumberChange={(v) => {
          props.onIdNumberChange(v);
          setIdNumber(v);
        }}
        onExpiryChange={(v) => {
          props.onExpiryChange(v);
          setExpiry(v);
        }}
        onDocumentsChange={(d) => {
          props.onDocumentsChange(d);
          setDocuments(d);
        }}
      />
    </div>
  );
}

const DETAILS = { firstName: 'Tariq', middleName: 'Mansoor', lastName: 'Al-Hashimi', nationality: 'Omani', dob: '14/06/1986', gender: 'Male' };

const meta = {
  title: 'Patterns/New Customer Details Form',
  component: NewCustomerDetailsForm,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'The details form the agent fills when the ID reader gave nothing (the Contact step\'s "Retake scan (5)"): ID number and expiry, names, nationality, date of birth and gender, with optional document uploads. What is typed is checked and handed on as the customer\'s identity; the lookup then marks it as typed, so the order goes for manager approval.',
      source: 'src/components/patterns/NewCustomerDetailsForm.tsx (validation in idLookupModel.ts `buildNewCustomerIdentity`)',
      variants: ['`idType` sets the number\'s label, placeholder and keyboard (QID numeric; Passport, GCC ID, Diplomatic ID, Other ID).', '`showUploads` off: no upload section (documents are taken after validation).', '`locked`: the details were validated - read-only, no Validate button, no uploads; `initial` seeds what to show.'],
      states: ['Empty (Validate with MOI disabled)', 'Complete (enabled)', 'Validation errors under the fields', 'Refused (`problem`, e.g. the person is already a customer: an error banner)', 'Busy (`aria-busy` while `onCreate` runs)', 'Locked / read-only'],
      events: ['`onIdNumberChange`, `onExpiryChange` (tidied to DD/MM/YYYY on blur), `onDocumentsChange` (names only, no preview).', '`onCreate(moi)` with the MOI-shaped identity, only when every check passes.'],
      validation: [
        'Every field but the middle name is required; Validate stays disabled until all are filled (the ID number and expiry included).',
        'Errors on Validate: "Choose the nationality.", "Enter the first name.", "Enter the last name.", "Enter a valid date of birth as DD/MM/YYYY.", "The date of birth cannot be in the future.", "Choose the gender.", "Enter a valid expiry date as DD/MM/YYYY.", "Enter the {ID label}."',
        'Uploaded files are checked by the identity-upload rules (type, size); a refused file is reported by name in a `role="alert"` and not added.',
      ],
      accessibility: ['A labelled `section` ("Customer details"); every field has a visible label and a required marker; errors are tied to their fields; the file input is visually hidden and driven by the "Upload Documents" button; each uploaded document has "Remove {name}".'],
      restrictions: ['The component has no masked contact field: contact details are taken on the step after the identity is validated.'],
    }),
  },
  argTypes: {
    idType: { control: 'select', options: ['QID', 'Passport', 'GCC ID', 'Diplomatic ID', 'Other ID'], description: 'The document the details are typed from.' },
    idNumber: { control: 'text', description: 'The ID number typed so far.' },
    expiry: { control: 'text', description: 'The expiry, DD/MM/YYYY.' },
    documents: { control: 'object', description: 'Uploaded documents, by name.' },
    problem: { control: 'text', description: 'Why the last attempt was refused.' },
    showUploads: { control: 'boolean', description: 'Show the upload section.' },
    locked: { control: 'boolean', description: 'The details were validated: read-only.' },
    initial: { control: 'object', description: 'What the form opens with (a validated identity\'s details).' },
    onIdNumberChange: { control: false },
    onExpiryChange: { control: false },
    onDocumentsChange: { control: false },
    onCreate: { control: false },
  },
  args: { idType: 'QID', idNumber: '', expiry: '', showUploads: true, locked: false, onIdNumberChange: fn(), onExpiryChange: fn(), onDocumentsChange: fn(), onCreate: fn() },
} satisfies Meta<typeof NewCustomerDetailsForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Validate with MOI' })).toBeDisabled();
    await expect(canvas.getByRole('textbox', { name: /First Name/ })).toBeVisible();
  },
};

export const TypingEnablesValidate: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: /Qatar ID|QID|ID Number/ }), '29287654321');
    await expect(args.onIdNumberChange).toHaveBeenCalled();
    await userEvent.type(canvas.getByRole('textbox', { name: /First Name/ }), 'Tariq');
    await expect(canvas.getByRole('button', { name: 'Validate with MOI' })).toBeDisabled();
  },
};

export const Complete: Story = {
  args: { idNumber: '29287654321', expiry: '31/12/2030', initial: DETAILS },
  play: async ({ canvasElement, args }) => {
    const validate = within(canvasElement).getByRole('button', { name: 'Validate with MOI' });
    await expect(validate).toBeEnabled();
    await userEvent.click(validate);
    await waitFor(() => expect(args.onCreate).toHaveBeenCalledTimes(1));
    const moi = (args.onCreate as ReturnType<typeof fn>).mock.calls[0][0];
    await expect(moi).toMatchObject({ name: 'Tariq Mansoor Al-Hashimi', dob: '1986-06-14', expiryDate: '2030-12-31', isNewCustomer: true, createdByAgent: true });
  },
};

export const InvalidDateOfBirth: Story = {
  args: { idNumber: '29287654321', expiry: '31/12/2030', initial: { ...DETAILS, dob: '31/02/1990' } },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Validate with MOI' }));
    await expect(await within(canvasElement).findByText('Enter a valid date of birth as DD/MM/YYYY.')).toBeVisible();
    await expect(args.onCreate).not.toHaveBeenCalled();
  },
};

export const FutureDateOfBirth: Story = {
  args: { idNumber: '29287654321', expiry: '31/12/2030', initial: { ...DETAILS, dob: '01/01/2999' } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Validate with MOI' }));
    await expect(await within(canvasElement).findByText('The date of birth cannot be in the future.')).toBeVisible();
  },
};

export const InvalidExpiry: Story = {
  args: { idNumber: '29287654321', expiry: '99/99/2030', initial: DETAILS },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Validate with MOI' }));
    await expect(await within(canvasElement).findByText('Enter a valid expiry date as DD/MM/YYYY.')).toBeVisible();
  },
};

export const Passport: Story = { args: { idType: 'Passport', idNumber: 'R7712345', expiry: '31/10/2031', initial: { ...DETAILS, firstName: 'Camille', lastName: 'Fontaine', nationality: 'French', gender: 'Female' } } };

export const RefusedWithProblem: Story = {
  args: { idNumber: '29287654321', expiry: '31/12/2030', initial: DETAILS, problem: 'This person is already a customer.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('This person is already a customer.')).toBeVisible();
  },
};

export const UploadDocuments: Story = {
  play: async ({ canvasElement, args }) => {
    await chooseFile(canvasElement, pdfFile('passport-page.pdf'));
    await waitFor(() => expect(args.onDocumentsChange).toHaveBeenCalledWith([{ name: 'passport-page.pdf' }]));
    await expect(within(canvasElement).getByRole('list', { name: 'Uploaded documents' })).toBeVisible();
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Remove passport-page.pdf' }));
    await expect(within(canvasElement).queryByRole('list', { name: 'Uploaded documents' })).toBeNull();
  },
};

export const RefusedUploadFile: Story = {
  play: async ({ canvasElement, args }) => {
    await chooseFile(canvasElement, wrongTypeFile('notes.docx'));
    await expect(await within(canvasElement).findByRole('alert')).toBeVisible();
    await expect(args.onDocumentsChange).not.toHaveBeenCalled();
  },
};

export const WithoutUploads: Story = { args: { showUploads: false } };

export const LockedAfterValidation: Story = {
  args: { idNumber: '29287654321', expiry: '31/12/2030', initial: DETAILS, locked: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: /First Name/ })).toHaveAttribute('readonly');
    await expect(canvas.queryByRole('button', { name: 'Validate with MOI' })).toBeNull();
  },
};
