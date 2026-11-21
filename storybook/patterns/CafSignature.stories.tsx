import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { CafSignature } from '../../src/capabilities';
import { Caf } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/CAF & Signature',
  component: CafSignature,
  parameters: {
    ...docsParameters({
      purpose: 'The Customer Agreement Form: terms, CAF type, signature and supporting documents. Standard variant (name, key information, signature) and full variant (the customer reads back the Checkout Summary order, agrees the terms and signs; the journey locks once signed); postpaid and prepaid forms. (Capability registry: "CAF & Signature".) The terms panel is documented under Patterns/CAF Terms & Conditions.',
      source: 'src/capabilities/CafSignature/CafSignature.tsx (CafSignatureCapture)',
      variants: ['`variant="standard"` (default): the CAF with the customer\'s name; the CAF type follows the device. Prepaid, port-in, Pre-to-Post, FWA, Fixed Line.', '`variant="full"` (New Connection): order read-back (`orderSummary`), full terms (`fullTerms`), `legalFacts`, an inline signature pad, up to five additional documents.', 'Full with a Secondary Contact: `supplementaryForm` adds the Supplementary Form; the one signature signs both and the secondary contact signs their own.', '`authorizedRepresentative`: a Customer Representative signs for the actual customer.', '`journey="prepaid"`, `ipayActivation`, `keyInformation`, `keyInformationScenario`.'],
      states: ['Unsigned (Please Sign pad disabled until the terms are agreed)', 'Terms agreed (pad enabled)', 'Signed (Signed badge, signature, continue from the signed view)', 'Documents blocked (a type chosen with no file)'],
      events: ['`onChange(value)` - `{ cafType, termsAccepted, supplementaryAgreed, marketingConsent, signatureDataUrl, signedCafDataUrl, termsLanguage, additionalDocuments, documentsBlocked, ... }`.'],
      usage: ['The Signature pad needs a pointer or touch drag to draw; the stories cover the agreement gating, not the drawing.'],
      devices: ['The CAF type is the device\'s (Digital on the web, Touch Screen on a tablet), never picked by hand: use the toolbar **Device** switch. The signature is the same pad on both.'],
      restrictions: ['The customer\'s English / Arabic toggle appears only in the customer pop-up (`?mirror=1`); the "Customer pop-up" stories add that parameter to the preview address for the duration of the story.'],
    }),
  },
  argTypes: { variant: { control: 'select', options: ['standard', 'full'], description: 'Standard CAF or the full New Connection form.' }, customerName: { control: 'text' }, value: { control: false }, onChange: { control: false } },
  args: { customerName: 'Sample Customer' },
} satisfies Meta<typeof CafSignature>;
export default meta;
type Story = StoryObj<typeof CafSignature>;

const ORDER = [
  { label: 'Plan', value: 'Postpaid Essential' },
  { label: 'Monthly Charge', value: 'QAR 200 / month' },
  { label: 'Due Today', value: 'QAR 0' },
];

/** The app's own Capability Library preview, with its Full / Full with Secondary Contact / Standard switcher. */
export const Default: Story = { render: () => <Caf /> };

function Standard({ name }: { name?: string }) {
  const [v, setV] = useState({});
  return <CafSignature value={v} onChange={setV} customerName={name} />;
}
function Full({ name, secondary = false, prepaid = false, representative = false }: { name?: string; secondary?: boolean; prepaid?: boolean; representative?: boolean }) {
  const [v, setV] = useState({});
  return (
    <CafSignature
      variant="full"
      value={v}
      onChange={setV}
      customerName={name}
      orderSummary={ORDER}
      fullTerms
      legalFacts={{ hrnAdvanceQar: 0 }}
      journey={prepaid ? 'prepaid' : 'postpaid'}
      authorizedRepresentative={representative ? { name: 'Sample Representative' } : undefined}
      supplementaryForm={secondary ? { rows: [{ label: 'Secondary Contact', value: 'Sample Secondary' }], actualUserName: 'Sample Secondary' } : undefined}
    />
  );
}

export const StandardVariant: Story = { render: (args) => <Standard name={args.customerName} /> };
export const FullVariant: Story = {
  render: (args) => <Full name={args.customerName} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const agree = await canvas.findByRole('checkbox', { name: /I have read and agreed to the full/ });
    await expect(agree).not.toBeChecked();
    await userEvent.click(agree);
    await expect(agree).toBeChecked();
  },
};
export const FullWithSecondaryContact: Story = { render: (args) => <Full name={args.customerName} secondary /> };
export const FullPrepaid: Story = { render: (args) => <Full name={args.customerName} prepaid /> };
export const FullAuthorisedRepresentative: Story = { render: (args) => <Full name={args.customerName} representative /> };

/** Adds `?mirror=1` (the Customer view pop-up's address) while the story is mounted: the app reads it once per render. */
function InCustomerPopup({ children }: { children: ReactNode }) {
  const [ready] = useState(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('mirror', '1');
    window.history.replaceState(null, '', url);
    return true;
  });
  useEffect(
    () => () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('mirror');
      window.history.replaceState(null, '', url);
    },
    [],
  );
  return ready ? <>{children}</> : null;
}
const withCustomerPopup: Decorator = (Story) => (
  <InCustomerPopup>
    <Story />
  </InCustomerPopup>
);

/** The customer's pop-up: the language choice sits at the top; choosing العربية lays the form out right to left. */
export const CustomerPopupArabic: Story = {
  decorators: [withCustomerPopup],
  render: (args) => <Full name={args.customerName} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('tab', { name: 'العربية' }));
    await waitFor(() => expect(canvasElement.querySelector('[dir="rtl"][lang="ar"]')).not.toBeNull());
  },
};
export const CustomerPopupEnglish: Story = { decorators: [withCustomerPopup], render: (args) => <Full name={args.customerName} /> };
