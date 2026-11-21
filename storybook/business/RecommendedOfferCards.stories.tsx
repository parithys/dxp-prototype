import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { CrossSalesStep } from '../../src/capabilities';
import type { CrossSalesValue, OfferJourneys } from '../../src/capabilities';
import { docsParameters } from '../_shared/docs';

type StepProps = Parameters<typeof CrossSalesStep>[0];

/** Every journey whose offers the six-card demo set draws on (New Postpaid, Fixed Line / FWA, MNP, New Prepaid): the wizard that holds several products passes them all. */
const ALL_JOURNEYS: OfferJourneys = ['new-postpaid', 'new-fixed-line', 'new-fwa', 'mnp-postpaid', 'mnp-prepaid', 'new-prepaid'];

/** The step as the wizard holds it: the decision is local state; hand-off and Interested are the real callbacks the wizard passes. */
function Demo(props: StepProps) {
  const [value, setValue] = useState<CrossSalesValue>(props.value);
  return (
    <CrossSalesStep
      {...props}
      value={value}
      onChange={(v) => {
        props.onChange(v);
        setValue(v);
      }}
    />
  );
}

const meta = {
  title: 'Business Components/Recommended Offer Cards',
  component: CrossSalesStep,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'The Recommended Offers step of the new-connection journeys: one card per offer, in a radio group. Each card is coloured by the kind of connection it opens (postpaid blue, home amber, MNP pink, prepaid green), says what kind of offer it is in its top-right tag, and shows the plan the offer opens - price (a promotion price struck through), and its facts. The best (lowest priority code) offer is flagged Recommended.',
      source: 'src/capabilities/CrossSellOffers/CrossSalesStep.tsx (+ crossSalesModel.ts: `offerToneOf`, `offerTagLabel`, `demoOfferSet`, `oneOfEachPlanClass`)',
      variants: [
        'Customer\'s own open offers (`customerId`): sorted Recommended first, then lowest monthly fee.',
        '`showAllOfferTypes`: the six-card demonstration set - New Postpaid\'s three (Voice, Broadband, Family; the customer\'s own offer takes its class\'s place, else the standard offer), then one New Fixed Line, one New MNP and one New Prepaid - topped up from the standard catalogue (`data/standardOffers`).',
        '`onInterestedOffer`: each card carries its own Interested (raise a lead) and Select Offer (take it and go on) buttons in place of the presentational "Select offer" label.',
      ],
      states: [
        'Unselected (idle tinted card), Recommended (blue highlight border), Selected (red border + corner tick; the label reads "Selected").',
        'Loading ("Checking for cross-sales offers..."). None: a customer with no open offer gets the "No Cross-Sales Offer Available" banner and the decision `none` is reported.',
        'Disabled: with `onInterestedOffer`, Select Offer is disabled (with an explanatory title) for an offer whose journey has no destination; Interested is disabled while its lead is being created.',
      ],
      events: ['`onChange(value)` - `{decision:"accepted", offerId, offerName, journey, linkedProductIds}` on select, `{}` on deselecting the selected card.', '`onHandOff(route, customer?)` - an accepted offer for a journey that continues elsewhere (shows the hand-off banner, and Select Offer opens it).', '`onContinue()` - Select Offer on a card whose journey continues here, once the selection has reached the values.', '`onInterestedOffer(offer)` - raise a lead.'],
      usage: ['The wizard wraps it in `offersStep` (step.tsx); `journey` says which offers continue in this wizard.'],
      accessibility: ['The list is `role="radiogroup"` ("Offers"); each card is a `role="radio"` list item with `aria-checked` and `tabIndex=0`; Enter / Space select it. View details has an `aria-label` naming the offer and opens the offer drawer without selecting. The Recommended and tag labels are text, not colour alone.'],
      devices: ['The grid is auto-fill, three columns at desktop width; tablet.css adds no card sizing; it gives `.btn-tertiary` a 44px minimum height and sets `touch-action: manipulation` on buttons. The card layout is the same on Web and Tablet.'],
      restrictions: ['The offers come from `cross-sales-offers.json` through the customer\'s contact records, so a story needs a customer that has them (CUST-3021, CUST-1001).'],
    }),
  },
  argTypes: {
    customerId: { control: 'select', options: ['CUST-3021', 'CUST-1001', 'CUST-1002'], description: 'The identified customer whose open offers are listed (CUST-1002 has none).' },
    journey: { control: 'select', options: ['new-postpaid', 'new-prepaid'], description: 'The journey this step belongs to: its offers continue here, every other journey\'s hand off.' },
    showAllOfferTypes: { control: 'boolean', description: 'Show every offer type, topped up with standard offers (the six-card set).' },
    value: { control: false },
    onChange: { control: false },
    onHandOff: { control: false },
    onContinue: { control: false },
    onInterestedOffer: { control: false },
  },
  args: { customerId: 'CUST-1001', value: {}, journey: 'new-postpaid', showAllOfferTypes: false, onChange: fn(), onHandOff: fn() },
} satisfies Meta<typeof CrossSalesStep>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SixCardSet: Story = { args: { customerId: 'CUST-3021', journey: ALL_JOURNEYS, showAllOfferTypes: true } };

export const WithInterestedAndSelectOffer: Story = { args: { customerId: 'CUST-1001', journey: ALL_JOURNEYS, onInterestedOffer: fn(async () => undefined), onContinue: fn() } };

export const NoOffersForCustomer: Story = {
  args: { customerId: 'CUST-1002' },
  play: async ({ canvasElement, args }) => {
    await expect(await within(canvasElement).findByText('No Cross-Sales Offer Available')).toBeInTheDocument();
    await waitFor(() => expect(args.onChange).toHaveBeenCalledWith({ decision: 'none' }));
  },
};

export const SelectedOffer: Story = {
  play: async ({ canvasElement }) => {
    const radios = await within(canvasElement).findAllByRole('radio');
    await userEvent.click(radios[1]);
    await expect(radios[1]).toHaveAttribute('aria-checked', 'true');
  },
};

export const SelectAndDeselect: Story = {
  play: async ({ canvasElement, args }) => {
    const radios = await within(canvasElement).findAllByRole('radio');
    await expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(radios[0]);
    await expect(args.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ decision: 'accepted' }));
    await expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(radios[0]);
    await expect(args.onChange).toHaveBeenLastCalledWith({});
    await expect(radios[0]).toHaveAttribute('aria-checked', 'false');
  },
};

export const KeyboardSelect: Story = {
  play: async ({ canvasElement }) => {
    const radios = await within(canvasElement).findAllByRole('radio');
    radios[0].focus();
    await expect(radios[0]).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(radios[0]).toHaveAttribute('aria-checked', 'true');
  },
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const radios = await within(canvasElement).findAllByRole('radio');
    await userEvent.hover(radios[1]);
  },
};

export const ViewDetailsDoesNotSelect: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const radios = await canvas.findAllByRole('radio');
    const link = within(radios[0]).getByRole('button', { name: /View details for/ });
    await userEvent.click(link);
    await expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await expect(radios[0]).toHaveAttribute('aria-checked', 'false');
  },
};

export const Tablet: Story = { args: { customerId: 'CUST-3021', journey: ALL_JOURNEYS, showAllOfferTypes: true }, parameters: { viewport: { defaultViewport: 'tablet' } } };
