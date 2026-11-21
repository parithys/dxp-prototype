import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { WizardFooter } from '../../src/components/patterns/wizard/WizardFooter';
import { WizardTitleBand } from '../../src/components/patterns/wizard/WizardTitleBand';
import { CustomerViewButton } from '../../src/components/patterns/wizard/CustomerViewButton';
import { PageHeader } from '../../src/components/patterns/PageHeader';
import { JourneyCardButton, NewJourneyButtons } from '../../src/capabilities/CrossSellOffers/JourneyActions';
import { Button, MOBILE_ALT, ICON_CARD } from 'dxp-ui';
import type { ServiceJourney } from '../../src/capabilities/CrossSellOffers/serviceJourneys';
import type { WizardStep } from '../../src/components/patterns/wizard/guidedWizardTypes';
import { docsParameters } from '../_shared/docs';
import { Column, Row, Specimen } from '../_shared/layout';

const STEP: WizardStep = { key: 'plan', label: 'Plan & Add-ons', render: () => null };

const meta = {
  title: 'Navigation/Journey Buttons and Footer',
  component: WizardFooter,
  parameters: {
    ...docsParameters({
      purpose:
        'The controls that move an agent through a journey: the footer (Back / Continue / Save & Finish), the title band (Save as Draft, Abandon Order), the Customer view toggle, the floating journey buttons on the Offers step (New Postpaid, New MNP, New Prepaid, New Fixed Line) and the page header band.',
      source: 'src/components/patterns/wizard/WizardFooter.tsx, WizardTitleBand.tsx, CustomerViewButton.tsx, src/capabilities/CrossSellOffers/JourneyActions.tsx, src/components/patterns/PageHeader.tsx',
      variants: [
        'WizardFooter: inline (default) or `fixedToViewport` (a bar fixed to the bottom; `avoidBottomTray` lifts it above the mobile tray).',
        'NewJourneyButtons: buttons (default) or `variant="cards"` (compact cards for Recommended Offers\' floating bar). The journey\'s own button is last and primary.',
        'PageHeader level 1 (h1) or 2 (inside a page that already has its h1); `bleed` or not.',
      ],
      states: [
        'Footer: first step (no Back), last step ("Save & Finish"), cannot proceed (Continue disabled), submitting ("Submitting..."), locked (Back removed once the journey is locked).',
        'Customer view: off / sharing (aria-pressed, "Showing to customer" and a "Visible to customer" tag).',
        'Title band: Save as Draft hidden by `saveHidden`; Abandon Order hidden by `abandonHidden`; a pop-up-blocked alert.',
      ],
      events: ['goBack, goNext (async), onAbandonStep; onSaveExit / onAbandon with onRequestSaveExit / onRequestAbandon; onDecline, goNext and onHandOff(route) for the journey buttons; onToggle for Customer view.'],
      usage: ['Continue is the single primary action; Back, Save as Draft and Abandon Order are secondary so they never compete with it.', 'Which journey buttons appear follows the role\'s grants through `allowed`; the journey\'s own button always stays.'],
      accessibility: ['All are native buttons with visible text; Customer view exposes aria-pressed; the Back and Continue icons are decorative.', 'The pop-up blocked message has role="alert".'],
      devices: ['The fixed footer pins to the viewport bottom on Web and Tablet; on small screens the journey summary accordion sits above it.'],
    }),
  },
  argTypes: {
    fixedToViewport: { control: 'boolean', description: 'Pin the footer to the bottom of the viewport.' },
    avoidBottomTray: { control: 'boolean', description: 'Lift the fixed footer above the bottom tray (small screens).' },
    currentIndex: { control: { type: 'number', min: 0 }, description: 'Zero-based index of the current step (0 hides Back).' },
    stepCount: { control: { type: 'number', min: 1 }, description: 'Number of steps; the last one shows "Save & Finish".' },
    isLocked: { control: 'boolean', description: 'Locked journey: Back is removed.' },
    canProceed: { control: 'boolean', description: 'False disables Continue.' },
    submitting: { control: 'boolean', description: 'Shows "Submitting..." and disables Continue.' },
    currentStep: { control: false },
    values: { control: false },
    goBack: { control: false },
    goNext: { control: false },
    setValue: { control: false },
    onAbandonStep: { control: false },
  },
  args: {
    currentStep: STEP,
    currentIndex: 1,
    stepCount: 4,
    values: {},
    isLocked: false,
    canProceed: true,
    submitting: false,
    goBack: fn(),
    goNext: fn(() => Promise.resolve()),
    setValue: fn(),
    onAbandonStep: fn(),
  },
} satisfies Meta<typeof WizardFooter>;
export default meta;
type Story = StoryObj<typeof WizardFooter>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Back' }));
    await expect(args.goBack).toHaveBeenCalled();
    await userEvent.click(c.getByRole('button', { name: 'Continue' }));
    await expect(args.goNext).toHaveBeenCalled();
  },
};

export const FirstStep: Story = {
  args: { currentIndex: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: 'Back' })).toBeNull();
  },
};

export const LastStep: Story = {
  args: { currentIndex: 3 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /Save & Finish/ })).toBeInTheDocument();
  },
};

export const ContinueDisabled: Story = {
  args: { canProceed: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /Continue/ })).toBeDisabled();
  },
};

export const Submitting: Story = {
  args: { submitting: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /Submitting/ })).toBeDisabled();
  },
};

export const Locked: Story = {
  name: 'Locked (Back removed)',
  args: { isLocked: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: 'Back' })).toBeNull();
  },
};

export const FixedToViewport: Story = {
  args: { fixedToViewport: true },
  parameters: { layout: 'fullscreen' },
};

export const KeyboardOrder: Story = {
  name: 'Keyboard focus order',
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.tab();
    await expect(c.getByRole('button', { name: 'Back' })).toHaveFocus();
    await userEvent.tab();
    await expect(c.getByRole('button', { name: /Continue/ })).toHaveFocus();
  },
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('button', { name: /Continue/ }));
  },
};

export const Tablet: Story = {
  parameters: { viewport: { defaultViewport: 'tablet' } },
};

export const Mobile: Story = {
  args: { fixedToViewport: true, avoidBottomTray: true },
  parameters: { viewport: { defaultViewport: 'mobile' }, layout: 'fullscreen' },
};

export const TitleBand: Story = {
  name: 'Title band (Save as Draft, Abandon Order)',
  render: () => (
    <WizardTitleBand title="New Postpaid" onSaveExit={fn()} onAbandon={fn()} onRequestSaveExit={fn()} onRequestAbandon={fn()} titleAside={<span className="text-on-dark-2">Customer: Aisha Al-Thani</span>} />
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('heading', { name: 'New Postpaid', level: 1 })).toBeInTheDocument();
    await expect(c.getByRole('button', { name: 'Save as Draft' })).toBeEnabled();
    await expect(c.getByRole('button', { name: 'Abandon Order' })).toBeEnabled();
  },
};

export const TitleBandPopupBlocked: Story = {
  name: 'Title band: pop-up blocked alert',
  render: () => <WizardTitleBand title="New Postpaid" popupBlocked onSaveExit={fn()} onAbandon={fn()} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument();
  },
};

export const TitleBandHiddenActions: Story = {
  name: 'Title band: actions hidden',
  render: () => <WizardTitleBand title="Number Management Portal" onSaveExit={fn()} onAbandon={fn()} saveHidden abandonHidden />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: 'Save as Draft' })).toBeNull();
  },
};

export const CustomerView: Story = {
  name: 'Customer view toggle',
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <Row>
        <CustomerViewButton viewOpen={open} onToggle={() => setOpen((v) => !v)} />
      </Row>
    );
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const btn = c.getByRole('button', { name: /Customer view/ });
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btn);
    await expect(c.getByRole('button', { name: /Showing to customer/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(c.getByText('Visible to customer')).toBeInTheDocument();
  },
};

const allow = (journey: ServiceJourney) => journey !== 'new-fixed-line';

export const JourneyButtons: Story = {
  name: 'Floating journey buttons (New Postpaid ...)',
  render: () => (
    <Column>
      <Specimen label="Buttons: the journey's own button last and primary">
        <NewJourneyButtons onDecline={fn()} goNext={fn()} onHandOff={fn()} />
      </Specimen>
      <Specimen label="Cards (Recommended Offers floating bar)">
        <NewJourneyButtons variant="cards" onDecline={fn()} goNext={fn()} onHandOff={fn()} />
      </Specimen>
      <Specimen label="Role without New Fixed Line (allowed)">
        <NewJourneyButtons onDecline={fn()} goNext={fn()} onHandOff={fn()} allowed={allow} />
      </Specimen>
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getAllByRole('button', { name: 'New Postpaid' }).length).toBeGreaterThan(0);
  },
};

export const JourneyButtonsHandOff: Story = {
  name: 'Journey buttons: hand off and decline',
  args: {},
  render: () => {
    const [last, setLast] = useState('none');
    return (
      <div className="stack gap-3">
        <NewJourneyButtons onDecline={() => setLast('declined')} goNext={() => setLast((l) => `${l}, advanced`)} onHandOff={(route) => setLast(`hand off to ${route}`)} />
        <p className="caption-muted" role="status">Last action: {last}</p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'New Prepaid' }));
    await expect(c.getByRole('status')).toHaveTextContent('hand off to /mobile-prepaid/new-prepaid');
    await userEvent.click(c.getByRole('button', { name: 'New Postpaid' }));
    await expect(c.getByRole('status')).toHaveTextContent('declined');
  },
};

export const JourneyCard: Story = {
  name: 'JourneyCardButton',
  render: () => (
    <Row>
      <JourneyCardButton label="New Prepaid" icon={MOBILE_ALT} onClick={fn()} />
      <JourneyCardButton label="New Postpaid" icon={ICON_CARD} tone="blue" onClick={fn()} />
    </Row>
  ),
};

export const PageHeaderBand: Story = {
  name: 'Page header',
  render: () => (
    <Column>
      <Specimen label="Title, badge, description and action">
        <PageHeader bleed={false} title="Orders" badges={<span className="badge badge-success">Live</span>} description="Orders raised in the last 30 days." actions={<Button variant="secondary" size="sm">Export</Button>} />
      </Specimen>
      <Specimen label="Level 2 (h2) inside a page that already has its h1">
        <PageHeader bleed={false} level={2} title="Sub section" />
      </Specimen>
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('heading', { name: 'Orders', level: 1 })).toBeInTheDocument();
    await expect(c.getByRole('heading', { name: 'Sub section', level: 2 })).toBeInTheDocument();
  },
};
