import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { Button } from 'dxp-ui';
import { HandOff, OfferDetailsDrawer } from '../../src/capabilities';
import type { OfferDetails } from '../../src/capabilities';
import { INCLUDED_INTERNATIONAL_MINUTES } from '../../src/data/planPolicy';
import { docsParameters } from '../_shared/docs';
import { Column, Specimen } from '../_shared/layout';

type DrawerProps = Parameters<typeof OfferDetailsDrawer>[0];

/** A small literal offer in the shape the drawer reads (OfferDetails): the step's own Offer type satisfies it. */
const OFFER: OfferDetails = {
  offerName: 'Postpaid Voice 150',
  offerDescription: 'Unlimited local calls with 30GB of 5G data and a free Star Number.',
  monthlyRental: 150,
  campaignCode: 'CMP-2026-0417',
  status: 'Available',
  offerType: 'New Postpaid',
  priorityCode: 'P1',
  treatmentCode: 'TRT-22',
  channel: 'Retail',
  promotionId: 'PROMO-VOICE-150',
  addOnMonthly: 25,
};

const POLICY_OFFER: OfferDetails = {
  ...OFFER,
  offerName: 'Postpaid Essential',
  codeLabel: 'Product code',
  campaignCode: 'PROD-107',
  policy: {
    title: 'Fair Usage Policy',
    bullets: ['First 15 GB is at full 5G speed and then unlimited data at 128 Kbps.', 'Offer valid for new postpaid connections only.'],
    tables: [INCLUDED_INTERNATIONAL_MINUTES],
    links: [{ text: 'Read the full terms and conditions.', label: 'Terms and Conditions' }],
  },
};

/** The drawer as the offer card opens it: a button opens it; Select closes it and marks the card selected. */
function Demo(props: Omit<DrawerProps, 'onClose' | 'onSelect' | 'selected'> & { onSelect: () => void; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        View details
      </Button>
      <OfferDetailsDrawer
        {...props}
        offer={open ? props.offer : null}
        selected={selected}
        onSelect={() => {
          props.onSelect();
          setSelected(true);
        }}
        onClose={() => {
          props.onClose();
          setOpen(false);
        }}
      />
    </>
  );
}

const meta = {
  title: 'Business Components/Offer Details Drawer',
  component: OfferDetailsDrawer,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'The "View details" side drawer of a Recommended Offer card: summary, what the linked plan includes, the offer\'s facts and included plans/add-ons, and related documents. Every value comes from the offer and its linked plans.',
      source: 'src/capabilities/CrossSellOffers/OfferDetailsDrawer.tsx',
      variants: [
        'Offer (default): Offer Information and Included Plans and Add-Ons sections, then "Need more information?" (omit with `showRelatedDocuments={false}`).',
        '`offer.policy`: shows the policy (bullets, tables, links) in place of Offer Information and Included items - a plan\'s Fair Usage Policy.',
        '`prepaid`: the rental is a once-only price (no "/mo"). `fixedService`: house artwork for the home services instead of the handset.',
        '`highlight`: the "what the plan includes" banner; `planDetails`: a Plan Details list; `hideStatusTags`: no status pills under the title.',
      ],
      states: ['Closed (`offer` null; the last offer stays rendered while it slides out)', 'Open', 'Selected (the footer button reads "Selected")', 'Sections collapse and expand (chevron buttons with `aria-expanded`)'],
      events: ['`onSelect()` - "Select this offer" (not called if already selected); the drawer then closes.', '`onClose()` - Close, the X, Escape.', 'View documents and a policy link raise an informational toast: no documents or pages exist behind them yet.'],
      accessibility: ['The app\'s one Radix Dialog drawer: focus trapped, page behind hidden, Escape closes, focus returns to the opener; a click outside does not close a drawer. Section headers are buttons with `aria-expanded`.'],
      devices: ['`.drawer-panel` is wider on tablet (tablet.css).'],
    }),
  },
  argTypes: {
    offer: { control: 'object', description: 'The offer whose details are open; null keeps the drawer closed.' },
    serviceLabel: { control: 'text', description: 'The Service row\'s value.' },
    prepaid: { control: 'boolean', description: 'A prepaid pack: priced once, no "/mo".' },
    fixedService: { control: 'boolean', description: 'Home service artwork.' },
    highlight: { control: 'object', description: '{ title, subtitle } of the plan banner; null hides it.' },
    includedNames: { control: 'object', description: 'Names of the included plans and add-ons.' },
    showRelatedDocuments: { control: 'boolean', description: 'The "Need more information?" block.' },
    planDetails: { control: 'object', description: 'The plan\'s own facts, listed as Plan Details.' },
    hideStatusTags: { control: 'boolean', description: 'Leaves out the status pills under the title.' },
    selected: { control: false },
    onSelect: { control: false },
    onClose: { control: false },
  },
  args: {
    offer: OFFER,
    serviceLabel: 'Mobile Postpaid',
    prepaid: false,
    fixedService: false,
    highlight: { title: 'Free Star Number', subtitle: 'Worth QAR 1,500 with this plan' },
    includedNames: ['Postpaid Voice 150', 'International Calling Add-On'],
    showRelatedDocuments: true,
    selected: false,
    onSelect: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof OfferDetailsDrawer>;
export default meta;
type Story = StoryObj<typeof meta>;

const openIt = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'View details' }));
  return screen.findByRole('dialog');
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    await expect(dialog).toHaveAccessibleName('Offer Details');
    await expect(within(dialog).getByText('Offer Information')).toBeVisible();
  },
};

export const PolicyInsteadOfOfferInformation: Story = {
  args: { offer: POLICY_OFFER, showRelatedDocuments: false, includedNames: [] },
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    await expect(within(dialog).getByText('Fair Usage Policy')).toBeVisible();
    await expect(within(dialog).queryByText('Offer Information')).toBeNull();
  },
};

export const PrepaidPack: Story = { args: { prepaid: true, serviceLabel: 'Mobile Prepaid', offer: { ...OFFER, offerName: 'Prepaid Starter Pack', monthlyRental: 50, addOnMonthly: undefined } } };

export const HomeService: Story = { args: { fixedService: true, serviceLabel: 'Fixed Wireless Access', offer: { ...OFFER, offerName: 'Home 5G 300' } } };

export const WithPlanDetails: Story = { args: { planDetails: ['30 GB 5G data', 'Unlimited local minutes', '300 SMS'], hideStatusTags: true } };

export const SelectClosesTheDrawer: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await openIt(canvasElement);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Select this offer' }));
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const SectionCollapses: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    const header = within(dialog).getByRole('button', { name: 'Offer Information' });
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(header);
    await expect(header).toHaveAttribute('aria-expanded', 'false');
  },
};

export const DocumentsToast: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    // "Need more information?" is open by default.
    await userEvent.click(await within(dialog).findByRole('button', { name: /View documents/ }));
    await waitFor(() => expect(screen.getByText('No documents are attached to this offer yet')).toBeVisible());
  },
};

export const EscapeClosesAndReturnsFocus: Story = {
  play: async ({ canvasElement }) => {
    const opener = within(canvasElement).getByRole('button', { name: 'View details' });
    await userEvent.click(opener);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expect(opener).toHaveFocus();
  },
};

/** HandOff: the notice shown when an offer's journey continues elsewhere. It is documented here with the drawer, as part of the same Recommended Offers family. */
export const JourneyHandOff: StoryObj<typeof HandOff> = {
  parameters: {
    docs: {
      description: {
        story: '`HandOff` (src/capabilities/CrossSellOffers/HandOff.tsx): a card that says an offer\'s journey continues in its own wizard - the customer is already identified and validated - with one "Continue in {journey}" button. `journey` is a `ServiceJourney` key; a journey with no route renders nothing. `onGo(route)` receives the journey\'s route.',
      },
    },
  },
  render: () => {
    const onGo = fn();
    return (
      <Column>
        <Specimen label="New Postpaid">
          <HandOff journey="new-postpaid" onGo={onGo} />
        </Specimen>
        <Specimen label="MNP Prepaid">
          <HandOff journey="mnp-prepaid" onGo={onGo} />
        </Specimen>
        <Specimen label="New FWA">
          <HandOff journey="new-fwa" onGo={onGo} />
        </Specimen>
      </Column>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Continue in New Postpaid' })).toBeVisible();
    await expect(canvas.getAllByRole('button')).toHaveLength(3);
  },
};
