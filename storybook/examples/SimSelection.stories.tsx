import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { SimType, checkoutSummaryStep, simTypeStep } from '../../src/capabilities';
import type { ActualUserValue } from '../../src/capabilities';
import type { SimTypeValue } from '../../src/components/domain/SimTypeStep';
import { detectDeviceType } from 'dxp-ui';
import { Column, SideBySide, Specimen } from '../_shared/layout';
import { StepFlow, exampleParameters } from './_harness';
import type { Values } from './_harness';
import { CLEAN_ELIGIBILITY, CUSTOMER, SLOW, contactOfCustomer, summaryText, useLoaded } from './_fixtures';

/** Real SIM serials of public/mock-data/sims.json: stock that is Available, and a card already Issued. */
const AVAILABLE_SERIAL = '8974412009900129000';
const ISSUED_SERIAL = '8974412009900123456';
/** The Secondary Contact is another real customer (CUST-3004), identified the way the primary was; the primary is CUST-1001. */
const SECONDARY_CUSTOMER = 'CUST-3004';

const meta: Meta = {
  title: 'Application Examples/SIM Selection',
  parameters: exampleParameters({
    purpose: 'SIM Selection as one scenario: the SIM type (a Physical SIM scanned or typed and validated against stock, or an eSIM generated), the optional Secondary Contact who will use the line, and the Journey Summary - where the Secondary Contact is listed as a step of its own only after the agent has moved on from SIM Selection.',
    source: 'src/capabilities/SimType (step.tsx, SimType.tsx, SimSerial.tsx) with src/capabilities/ActualUser',
    variants: [
      'Physical SIM: the serial is typed or scanned (the barcode icon in the field, on every device) and checked against stock; a valid serial shows the green read-back (SIM Type, SIM Serial Number).',
      'eSIM: "Generate eSIM" issues an activation profile; the page says "eSIM selected" and that the QR code is sent only after payment and submission (or approval).',
      'Secondary Contact: once a SIM is chosen, an "Add Secondary Contact" checkbox opens a section that identifies another person (ID type, scan, MOI, email); Continue then needs that person identified, 18 or over, and not the primary customer.',
    ],
    states: ['Nothing chosen (Continue disabled)', 'Checking stock', 'Serial valid (read-back)', 'Serial not found / already issued / used twice (error under the field)', 'eSIM selected', 'Secondary Contact section open and incomplete (Continue disabled)', 'Secondary Contact identified'],
    events: ['`onChange(simType)` - `{ simType, simSerial, simValid, simIccid, simStockStatus, simKind, esimIssued, esimActivationCode }`; the step stores it under `simType` and the Secondary Contact under `actualUser`.'],
    validation: ['A Physical SIM is valid once its serial is in stock and not Issued; an eSIM once generated. An empty serial shows no message - Continue is simply unavailable.'],
    devices: ['The serial field is scan-led on a tablet (the field says "Scan the SIM barcode, or enter the serial number" and a large scan button sits under it) and type-led on the web. The step takes a `device` prop; the examples pass the detected one, so the toolbar **Device** switch (or `?device=tablet`) selects it. `Web and Tablet` shows both side by side.'],
    restrictions: ['The barcode reader, stock inventory and MOI are simulated by the mock data layer; the scan reads the first Available SIM of sims.json.'],
  }),
};
export default meta;
type Story = StoryObj<typeof meta>;

const eSimIssued: SimTypeValue = { simType: 'eSIM', esimIssued: true, esimActivationCode: 'LPA:1$demo.vodafone.qa$ACTIVATION', simIccid: '8974412009900140101' };

/** SIM Selection and the Order Summary after it, on the values a journey holds by then; `secondary` seeds an identified Secondary Contact. */
function SimJourney({ initialSim, secondary }: { initialSim?: SimTypeValue; secondary?: boolean }) {
  const contacts = useLoaded(async () => ({ primary: await contactOfCustomer(CUSTOMER.clean), other: await contactOfCustomer(SECONDARY_CUSTOMER) }));
  const device = detectDeviceType();
  const steps = useMemo(() => [simTypeStep({ device, approvalRequired: () => false, withActualUser: true }), checkoutSummaryStep()], [device]);
  if (!contacts) return <p className="muted-body">Loading the customers from the mock data…</p>;
  const initial: Values = {
    contact: contacts.primary,
    eligibility: CLEAN_ELIGIBILITY,
    productId: 'PROD-107',
    msisdn: '+97466650005',
    numberPriceQAR: 300,
    ...(initialSim ? { simType: initialSim } : {}),
    ...(secondary ? { actualUser: { choice: 'other', identity: contacts.other } satisfies ActualUserValue } : {}),
  };
  return <StepFlow steps={steps} initial={initial} />;
}

export const Default: Story = {
  name: 'Physical SIM (type the serial)',
  render: () => <SimJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const serial = await canvas.findByRole('textbox', { name: /SIM Serial Number/ }, SLOW);
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.type(serial, AVAILABLE_SERIAL);
    await userEvent.tab();
    // Valid stock: the read-back appears and Continue is enabled.
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled(), SLOW);
    await expect(canvas.getAllByText(AVAILABLE_SERIAL).length).toBeGreaterThan(0);
  },
};

export const SerialAlreadyIssued: Story = {
  name: 'Serial not usable',
  render: () => <SimJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const serial = await canvas.findByRole('textbox', { name: /SIM Serial Number/ }, SLOW);
    await userEvent.type(serial, ISSUED_SERIAL);
    await userEvent.tab();
    // An Issued card is refused with a message under the field; Continue stays disabled.
    await expect(await canvas.findByRole('alert', undefined, SLOW)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
  },
};

export const ScanSerial: Story = {
  name: 'Scan the serial',
  render: () => <SimJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scan = (await canvas.findAllByRole('button', { name: 'Scan SIM barcode' }, SLOW))[0];
    await userEvent.click(scan);
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled(), SLOW);
  },
};

export const ESim: Story = {
  name: 'eSIM generation',
  render: () => <SimJourney />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Generate eSIM' }, SLOW));
    await expect(await canvas.findByText('eSIM selected', undefined, SLOW)).toBeVisible();
    await expect(canvas.getByText(/The eSIM activation QR code will be generated only after successful payment/)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled();
  },
};

export const SecondaryContactAddedOnThisPage: Story = {
  name: 'Secondary Contact opened (not in the summary yet)',
  render: () => <SimJourney initialSim={eSimIssued} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('checkbox', { name: 'Add Secondary Contact' }, SLOW));
    await expect(await canvas.findByRole('region', { name: 'Secondary Contact' })).toBeVisible();
    // The section needs a person identified before Continue works, and the summary does not list it while the agent is still on this page.
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await expect(summaryText(canvasElement)).not.toContain('Secondary Contact');
  },
};

export const SecondaryContactInSummary: Story = {
  name: 'Secondary Contact appears after moving on',
  render: () => <SimJourney initialSim={eSimIssued} secondary />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const continueButton = await canvas.findByRole('button', { name: 'Continue' }, SLOW);
    await waitFor(() => expect(continueButton).toBeEnabled());
    // While on SIM Selection the summary does not list the Secondary Contact; once the agent moves on, it is a step of its own after SIM Selection.
    await expect(summaryText(canvasElement)).not.toContain('Secondary Contact');
    await userEvent.click(continueButton);
    await waitFor(() => expect(summaryText(canvasElement)).toContain('Secondary Contact'));
    await expect(summaryText(canvasElement)).toContain('SIM Selection');
  },
};

function BothDevices() {
  const [web, setWeb] = useState<SimTypeValue>({});
  const [tablet, setTablet] = useState<SimTypeValue>({});
  return (
    <Column>
      <SideBySide>
        <Specimen label="Web: type-led, barcode icon inside the field">
          <SimType value={web} onChange={setWeb} customerEmail="sample.customer@example.qa" device="web" autoFocus={false} />
        </Specimen>
        <Specimen label="Tablet: scan-led, the barcode icon is the scan">
          <SimType value={tablet} onChange={setTablet} customerEmail="sample.customer@example.qa" device="tablet" autoFocus={false} />
        </Specimen>
      </SideBySide>
    </Column>
  );
}

export const WebAndTablet: Story = {
  name: 'Web and Tablet side by side',
  parameters: { layout: 'padded', docs: { description: { story: 'The same SIM Type capability with `device` forced to each experience.' } } },
  render: () => <BothDevices />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findAllByRole('textbox', { name: /SIM Serial Number/ })).toHaveLength(2);
    // One scan control per field - the barcode icon - on both devices.
    await expect(canvas.getAllByRole('button', { name: 'Scan SIM barcode' })).toHaveLength(2);
  },
};

export const Tablet: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  parameters: { viewport: { defaultViewport: 'tablet' } },
  render: () => <SimJourney />,
  play: async ({ canvasElement }) => {
    await expect((await within(canvasElement).findAllByRole('button', { name: 'Scan SIM barcode' }, SLOW)).length).toBeGreaterThan(0);
  },
};
