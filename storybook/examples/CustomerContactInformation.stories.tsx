import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { customerQualificationStep, hasIdentityDetails, isValidAltPhone, isValidEmail } from '../../src/capabilities';
import type { GuidedContactValue } from '../../src/capabilities';
import { SinglePage, exampleParameters } from './_harness';
import { CUSTOMER, SLOW, contactOfCustomer, contactOfNasRecord, useLoaded } from './_fixtures';

const meta: Meta = {
  title: 'Application Examples/Customer Contact Information',
  parameters: {
    ...exampleParameters({
      purpose: 'The Contact step of New Connection as one scenario: the validated identity (Identity Details card), the contact details that ride with it (email, mobile, work number, language), the eligibility panel that runs on the validated ID, and the Special Discounts choice - composed from the production Customer Verification capability, with Continue gated by the step\'s own `isValid`.',
      source: 'src/capabilities/CustomerQualification/step.tsx (composes src/capabilities/CustomerIdentification, EligibilityGate and SpecialDiscountsIdentification)',
      variants: [
        'Default: an existing customer (CUST-1001) already validated with MOI - identity read-only, contact editable, Continue enabled once eligibility clears.',
        'Masked contact: a person only the NAS knows (a new customer) - the email and mobile show masked (`y***i@e****e.qa`, `6******7`); focusing selects them, so typing replaces them and the edited value is shown as typed.',
        'Validation errors: a malformed email, mobile and work number.',
        'Required fields: no email on record - Continue stays disabled until a valid one is typed.',
      ],
      states: ['Loading the customer', 'Validated, eligibility running ("Checking eligibility…")', 'Valid (Continue enabled)', 'Field errors (red border, message under the field)'],
      validation: [
        'Email ID is required and must be `name@domain.tld`; Work Email, Mobile Number and Work Number are optional but validated when entered (Qatar mobile: 8 digits, leading 3/5/6/7).',
        'Identity fields (first / last name, date of birth, nationality, gender, ID expiry) are registry-sourced and all required; a missing one keeps Continue disabled.',
        'An edited NAS email shows "Verification pending - address differs from the registry record."',
      ],
      devices: ['Scanner-led on a tablet (camera / reader), type-led on the web. Use the toolbar **Device** switch or `?device=tablet`; the `Tablet` story selects it for you.'],
      restrictions: ['MOI, NAS and the eligibility service are the app\'s mock data layer. The ID scanner itself is not walked here (the customer is already validated) - see Patterns / Customer Identification.'],
    }, 900, 'padded'),
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The Customer Verification step exactly as New Connection builds it (product not chosen yet, journey chosen later), with local state. */
function ContactStep({ load, patch }: { load: () => Promise<GuidedContactValue>; patch?: Partial<GuidedContactValue> }) {
  const contact = useLoaded(load);
  const step = useMemo(() => customerQualificationStep({ flow: 'new', existingCustomerId: undefined, guardedContactChange: (v, set) => set('contact', v), productAgnostic: true, journeyChosenLater: true }), []);
  if (!contact) return <p className="muted-body">Loading the customer from the mock data…</p>;
  return (
    <SinglePage
      step={step}
      initial={{ contact: { ...contact, ...patch }, customerType: { type: 'none' } }}
      extra={(values) => <ContactChecklist contact={values.contact as GuidedContactValue} />}
    />
  );
}

/** The same rules the field errors and Continue use (guidedContactModel), listed so the cross-field validation is visible. */
function ContactChecklist({ contact }: { contact: GuidedContactValue }) {
  const rows: [string, boolean][] = [
    ['Identity details complete (name, date of birth, nationality, gender, ID expiry)', hasIdentityDetails(contact)],
    ['Email ID is a valid address', isValidEmail(contact.email)],
    ['Work Email, if entered, is valid', !contact.workEmail || isValidEmail(contact.workEmail)],
    ['Mobile Number, if entered, is a Qatar mobile', !contact.personalMobile || isValidAltPhone(contact.personalMobile)],
    ['Work Number, if entered, is a Qatar mobile', !contact.altPhone || isValidAltPhone(contact.altPhone)],
  ];
  return (
    <section aria-label="Contact validation" className="card pad-panel stack gap-2">
      <h3 className="title title-sm">What Continue checks</h3>
      <ul className="stack gap-1">
        {rows.map(([label, ok]) => (
          <li key={label} className="caption-secondary">
            {ok ? 'Met' : 'Not met'}: {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

export const Default: Story = {
  render: () => <ContactStep load={() => contactOfCustomer(CUSTOMER.clean)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = await canvas.findByRole('textbox', { name: /^Email ID/ }, SLOW);
    await expect(email).toHaveValue('ahmed.alsulaiti@example.qa');
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled(), SLOW);
  },
};

export const MaskedEmailAndMobileEdit: Story = {
  name: 'Masked email and mobile (new customer)',
  render: () => <ContactStep load={() => contactOfNasRecord('29207063400101')} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = await canvas.findByRole('textbox', { name: /^Email ID/ }, SLOW);
    // The NAS address is never shown in full.
    await expect((email as HTMLInputElement).value).toContain('*');
    // Clearing replaces the whole masked value; what is typed next is shown as typed and is flagged as not yet verified.
    await userEvent.clear(email);
    await userEvent.type(email, 'yousef.new@example.qa');
    await expect(email).toHaveValue('yousef.new@example.qa');
    await expect(await canvas.findByText(/Verification pending/)).toBeVisible();
  },
};

export const ValidationErrors: Story = {
  render: () => <ContactStep load={() => contactOfCustomer(CUSTOMER.clean)} patch={{ email: 'not-an-email', workEmail: 'work@', personalMobile: '12345', altPhone: '123' }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('textbox', { name: /^Email ID/ }, SLOW);
    await expect(canvas.getAllByText('Please enter a valid email address.').length).toBe(2);
    await expect(canvas.getAllByText('Enter a valid Qatar mobile number.').length).toBe(2);
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
  },
};

export const RequiredFieldsMissing: Story = {
  name: 'Required field missing',
  render: () => <ContactStep load={() => contactOfCustomer(CUSTOMER.clean)} patch={{ email: '' }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = await canvas.findByRole('textbox', { name: /^Email ID/ }, SLOW);
    await expect(email).toBeRequired();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
    // Typing a valid address satisfies the rule and, once eligibility has cleared, enables Continue.
    await userEvent.type(email, 'ahmed@example.qa');
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled(), SLOW);
  },
};

export const Tablet: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  parameters: { viewport: { defaultViewport: 'tablet' } },
  render: () => <ContactStep load={() => contactOfCustomer(CUSTOMER.clean)} />,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('textbox', { name: /^Email ID/ }, SLOW)).toBeVisible();
  },
};
