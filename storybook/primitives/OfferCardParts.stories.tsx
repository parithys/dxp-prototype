import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from 'dxp-ui';
import { CARD_HIGHLIGHT, CARD_IDLE, CARD_SELECTED, SelectedCardTexture, SelectedPlanFigure, SelectedTick } from '../../src/components/primitives/offerCardParts';
import { docsParameters } from '../_shared/docs';
import { Row, Specimen } from '../_shared/layout';

/** A bare card carrying only the shared state class, so the state itself is what is shown. */
function StateCard({ state, label, tick = false, texture = false }: { state: string; label: string; tick?: boolean; texture?: boolean }) {
  return (
    <div className={`option-card isolate gap-1 p-4 ${state}`} style={{ width: 240 }}>
      {texture && <SelectedCardTexture />}
      {tick && <SelectedTick />}
      <p className="title title-lg">{label}</p>
      <p className="caption-secondary">The same state classes every selectable card uses.</p>
    </div>
  );
}

const meta = {
  title: 'Business Components/Offer Card Parts',
  parameters: {
    ...docsParameters({
      purpose: 'The pieces shared by every selectable plan, offer, add-on, discount and number card: the three state classes, the selected tick, the selected-card texture and the chosen-plan price figure. One definition, so the cards stay alike.',
      source: 'src/components/primitives/offerCardParts.tsx',
      variants: [
        '`CARD_IDLE` (`card-idle`) - the unselected card.',
        '`CARD_SELECTED` (`card-selected`) - red border and warm fill.',
        '`CARD_HIGHLIGHT` (`card-highlight`) - a card the app singles out (the Recommended offer): blue border and soft blue wash; red stays for the selected card.',
        '`SelectedTick` - the red circle with a tick on a `relative` card\'s top-right corner, only while selected. `SelectedCardTexture` - faint concentric circles behind the content (the card needs `isolate`).',
        '`SelectedPlanFigure` - a card in the selected look holding a label and the chosen plan\'s or pack\'s price.',
      ],
      usage: ['Hover changes the background only, never a border or ring. The whole card is the control; no card has its own Select button.'],
      accessibility: ['The tick and texture are `aria-hidden`; selection must also be exposed by the card itself (`aria-pressed` on buttons, `aria-checked` on radios).'],
    }),
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <Row>
      <Specimen label="Idle">
        <StateCard state={CARD_IDLE} label="Idle" />
      </Specimen>
      <Specimen label="Highlight (Recommended)">
        <StateCard state={CARD_HIGHLIGHT} label="Highlight" />
      </Specimen>
      <Specimen label="Selected (tick + texture)">
        <StateCard state={CARD_SELECTED} label="Selected" tick texture />
      </Specimen>
    </Row>
  ),
};

export const ChosenPlanFigure: Story = {
  render: () => (
    <Row>
      <SelectedPlanFigure label="Monthly plan">QAR 145</SelectedPlanFigure>
      <SelectedPlanFigure label="Starter pack">QAR 50</SelectedPlanFigure>
    </Row>
  ),
};

export const TickOnly: Story = {
  render: () => (
    <Card className={`relative p-4 ${CARD_SELECTED}`} style={{ width: 160, height: 80 }}>
      <SelectedTick />
    </Card>
  ),
};
