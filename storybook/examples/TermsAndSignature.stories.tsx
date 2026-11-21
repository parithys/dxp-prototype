import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { cafSignatureStep, checkoutSummaryStep } from '../../src/capabilities';
import type { ActualUserValue } from '../../src/capabilities';
import type { SimTypeValue } from '../../src/components/domain/SimTypeStep';
import { StepFlow, exampleParameters } from './_harness';
import type { Values } from './_harness';
import { CLEAN_ELIGIBILITY, CUSTOMER, SIGNATURE_PNG, SLOW, contactOfCustomer, useLoaded } from './_fixtures';

const SECONDARY_CUSTOMER = 'CUST-3004';
const ESIM: SimTypeValue = { simType: 'eSIM', esimIssued: true, esimActivationCode: 'LPA:1$demo.vodafone.qa$ACTIVATION', simIccid: '8974412009900140101' };

const meta: Meta = {
  title: 'Application Examples/Terms and Signature',
  parameters: exampleParameters({
    purpose: 'The Customer Agreement Form as one scenario: after Order Summary the customer reads back the order the agent just confirmed (the figures Checkout published), the Key Terms and the full Terms & Conditions in English or - in the customer\'s pop-up - Arabic, agrees to them, signs on the pad, and, when a Secondary Contact will use the line, agrees to and signs the Supplementary Form. Built from the production CAF & Signature capability behind the real Order Summary step.',
    source: 'src/capabilities/CafSignature (step.tsx, CafSignature.tsx) over src/components/patterns/CafSignatureCapture.tsx and the business\'s documents in public/config/caf-content',
    variants: [
      'Default (English): agree to the full Terms & Conditions; the signature pad is disabled until you do.',
      'Arabic: the customer\'s pop-up (`?mirror=1`) adds the English / العربية toggle and lays the content out right to left; the wording is the business\'s own document (CAF_postpaid_primary_arabic).',
      'Secondary Contact: the Supplementary Form with its own terms; the primary customer\'s one signature also needs the supplementary consent, then the Secondary Contact signs the form on their own.',
      'Signed: the Signed badge and signature thumbnail replace the pad; the journey locks from here.',
    ],
    states: ['Terms not agreed (pad disabled)', 'Agreed, nothing drawn (Save disabled)', 'Drawn (Save enabled)', 'Signed', 'Secondary Contact to sign (consent first)', 'Secondary Contact signed'],
    events: ['`onChange(caf)` - `{ cafType, termsAccepted, supplementaryAgreed, signatureDataUrl, signedCafDataUrl, secondaryAgreed, secondarySignatureDataUrl, termsLanguage }`; the step is valid once signed (and, with a Secondary Contact, both signed), every mandatory document is attached and the order\'s required documents are attached.'],
    validation: ['The signature pad is disabled until the full Terms (and the supplementary terms, when there is a Secondary Contact) are agreed; withdrawing the consent discards the drawing.', 'Marketing consent is optional.'],
    accessibility: ['The pad is a canvas with `aria-disabled` while it cannot be used; Clear and Save are buttons that stay disabled until something is drawn. In the Arabic view the content has `dir="rtl"` and the language toggle stays left to right.'],
    devices: ['The CAF type follows the device: Digital on the web, Touch Screen on a tablet (set from the device, never picked by hand). Use the toolbar **Device** switch or the `Tablet` story.'],
    restrictions: ['The Arabic story sets `?mirror=1` on the preview frame while it is shown, as the app\'s Customer view pop-up has it, and removes it afterwards. Additional Documents (mandatory documents) are covered in Document Scanning and Uploading.'],
  }, 900, 'padded'),
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The customer's pop-up is a window opened with `?mirror=1`; the app reads that from the address, so the story sets it while it is shown. */
function CustomerPopup({ children }: { children: ReactNode }) {
  useState(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('mirror', '1');
    window.history.replaceState(window.history.state, '', url);
    return true;
  });
  useEffect(
    () => () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('mirror');
      window.history.replaceState(window.history.state, '', url);
    },
    []
  );
  return <>{children}</>;
}

/** Order Summary then CAF & Signature on the values a journey holds by then; the Checkout step publishes the figures the CAF reads back. */
function CafJourney({ secondary = false, caf, popup = false }: { secondary?: boolean; caf?: Values; popup?: boolean }) {
  const contacts = useLoaded(async () => ({ primary: await contactOfCustomer(CUSTOMER.clean), other: await contactOfCustomer(SECONDARY_CUSTOMER) }));
  const steps = useMemo(() => [checkoutSummaryStep(), cafSignatureStep({ variant: 'full' })], []);
  if (!contacts) return <p className="muted-body">Loading the customers from the mock data…</p>;
  const initial: Values = {
    contact: contacts.primary,
    eligibility: CLEAN_ELIGIBILITY,
    productId: 'PROD-107',
    msisdn: '+97477000000',
    numberPriceQAR: 50000,
    simType: ESIM,
    ...(caf ? { caf } : {}),
    ...(secondary ? { actualUser: { choice: 'other', identity: contacts.other } satisfies ActualUserValue } : {}),
  };
  const flow = <StepFlow steps={steps} initial={initial} summary={false} />;
  return popup ? <CustomerPopup>{flow}</CustomerPopup> : flow;
}

/** Moves from Order Summary to CAF & Signature once Checkout has published its figures. */
async function goToCaf(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await canvas.findByText('Upfront Charges', undefined, SLOW);
  const next = canvas.getByRole('button', { name: 'Continue' });
  await waitFor(() => expect(next).toBeEnabled());
  await userEvent.click(next);
}

/** The same, then waits for the terms to be agreed to (an unsigned CAF). */
async function openCaf(canvasElement: HTMLElement) {
  await goToCaf(canvasElement);
  await within(canvasElement).findAllByRole('checkbox', undefined, SLOW);
}

/** Draws a stroke on the signature pad (the app's own canvas: pointer down, move, up). */
async function drawSignature(canvas: HTMLElement) {
  const box = canvas.getBoundingClientRect();
  const at = (x: number, y: number) => ({ clientX: box.left + x, clientY: box.top + y });
  await userEvent.pointer([
    { keys: '[MouseLeft>]', target: canvas, coords: at(20, 40) },
    { target: canvas, coords: at(120, 90) },
    { target: canvas, coords: at(220, 50) },
    { keys: '[/MouseLeft]', target: canvas, coords: at(220, 50) },
  ]);
}

const pads = (root: HTMLElement) => [...root.querySelectorAll<HTMLCanvasElement>('canvas.signature-canvas')];

export const Default: Story = {
  render: () => <CafJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openCaf(canvasElement);
    // The CAF page states the terms the customer agrees to, with a link to the full Terms and Conditions.
    await expect(canvas.getByRole('heading', { name: 'CAF & Signature' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Terms and Conditions' })).toBeVisible();
    const [pad] = pads(canvasElement);
    const save = canvas.getByRole('button', { name: 'Save' });
    await expect(pad).toHaveAttribute('aria-disabled', 'true');
    // Clear is disabled too until something is drawn (Continue lives in the wizard footer, not in this capability).
    await expect(canvas.getByRole('button', { name: 'Clear' })).toBeDisabled();
    // Agreeing to the full terms enables the pad; drawing enables Save; saving signs the CAF.
    await userEvent.click(canvas.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(pads(canvasElement)[0]).not.toHaveAttribute('aria-disabled'));
    await expect(save).toBeDisabled();
    await drawSignature(pads(canvasElement)[0]);
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Save' })).toBeEnabled());
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(await canvas.findByText(/Signed by/)).toBeVisible();
    await expect(canvas.getByAltText('Signature')).toBeVisible();
  },
};

export const SupplementaryTermsWithSecondaryContact: Story = {
  name: 'Secondary Contact: supplementary terms',
  render: () => <CafJourney secondary />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openCaf(canvasElement);
    // Two consents before the primary customer can sign: the full terms and the Supplementary Form's.
    const boxes = canvas.getAllByRole('checkbox');
    await expect(boxes.length).toBeGreaterThanOrEqual(2);
    await userEvent.click(boxes[0]);
    await expect(pads(canvasElement)[0]).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(canvas.getAllByRole('checkbox')[1]);
    await waitFor(() => expect(pads(canvasElement)[0]).not.toHaveAttribute('aria-disabled'));
    await drawSignature(pads(canvasElement)[0]);
    // Save is enabled only once the stroke is registered: wait for it, so a slow run does not click a disabled button.
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Save' })).toBeEnabled());
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    // The Secondary Contact then signs the Supplementary Form on their own, after their own consent.
    const form = (await canvas.findByRole('region', { name: 'Supplementary Form - secondary contact' }, SLOW)) as HTMLElement;
    await expect(within(form).getByRole('heading', { name: 'Supplementary Key Terms & Conditions: Secondary Contact' })).toBeVisible();
    const secondaryPad = form.querySelector<HTMLCanvasElement>('canvas.signature-canvas');
    await expect(secondaryPad).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(within(form).getByRole('checkbox'));
    await waitFor(() => expect(form.querySelector('canvas.signature-canvas')).not.toHaveAttribute('aria-disabled'));
    await drawSignature(form.querySelector('canvas.signature-canvas') as HTMLElement);
    await waitFor(() => expect(within(form).getByRole('button', { name: 'Save' })).toBeEnabled());
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await expect((await within(form).findAllByText(/Signed by/)).length).toBeGreaterThan(0);
  },
};

export const ArabicCustomerView: Story = {
  name: 'Arabic terms (customer view)',
  render: () => <CafJourney popup />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openCaf(canvasElement);
    // The customer chooses their language in the toggle; English is the default.
    const english = await canvas.findByRole('tab', { name: 'English' });
    await expect(english).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(canvas.getByRole('tab', { name: 'العربية' }));
    await expect(canvas.getByRole('tab', { name: 'العربية' })).toHaveAttribute('aria-selected', 'true');
    // The business's Arabic document is laid out right to left.
    await waitFor(() => expect(canvasElement.querySelector('[dir="rtl"][lang="ar"]')).not.toBeNull(), SLOW);
    await userEvent.click(canvas.getByRole('tab', { name: 'English' }));
    await waitFor(() => expect(canvasElement.querySelector('[dir="rtl"][lang="ar"]')).toBeNull());
  },
};

export const Signed: Story = {
  render: () => <CafJourney caf={{ cafType: 'Digital', termsAccepted: true, marketingConsent: true, signatureDataUrl: SIGNATURE_PNG }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await goToCaf(canvasElement);
    // Signed: the badge and the signature thumbnail replace the pad.
    await expect(await canvas.findByText(/Signed by/, undefined, SLOW)).toBeVisible();
    await expect(canvas.getByAltText('Signature')).toBeVisible();
    await expect(pads(canvasElement)).toHaveLength(0);
  },
};

export const Tablet: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  parameters: { viewport: { defaultViewport: 'tablet' } },
  render: () => <CafJourney />,
  play: async ({ canvasElement }) => {
    await openCaf(canvasElement);
    await expect(pads(canvasElement)).toHaveLength(1);
  },
};
