import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { SelectedCardTexture, SelectedTick, CARD_HIGHLIGHT, CARD_IDLE, CARD_SELECTED } from '../../src/capabilities';
import { Card } from 'dxp-ui';
import { ServiceTypeTag } from '../../src/components/primitives/ServiceTypeTag';
import { docsParameters } from '../_shared/docs';
import { Column, Row, Specimen } from '../_shared/layout';

const meta = {
  title: 'Primitives/Selectable Card',
  parameters: {
    ...docsParameters({
      purpose: 'How a selectable card grid (offers, plans, numbers) looks in each state, using the shared state classes. Each journey composes its own card; there is no single SelectableCard component. The parts themselves (tick, texture, plan figure) are documented on Business Components / Offer Card Parts.',
      source: 'src/ui-components.css (.card-idle, .card-selected, .card-highlight); state constants from src/components/primitives/offerCardParts.tsx',
      variants: ['`CARD_IDLE` (`card-idle`), `CARD_SELECTED` (`card-selected`: red border, warm fill), `CARD_HIGHLIGHT` (`card-highlight`: blue border, soft blue wash, for a Recommended / Popular card).'],
      states: ['Idle, hover (fill only), focus-visible ring (`card-option`), selected, highlighted.'],
      usage: ['The whole card is the control: render it as a `<button>` or role="radio" element; no separate Select button.'],
      accessibility: ['Selection must be exposed by the control (`aria-pressed` or `aria-checked`); the tick and texture are `aria-hidden`.'],
      restrictions: ['`.card-tick` is currently `display: none` in ui-components.css, so the selected tick renders in the DOM but is hidden by design; the selected state reads from the border, fill and ring.'],
    }),
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <Row>
      <Specimen label="CARD_IDLE"><Card className={`card-option p-4 ${CARD_IDLE}`} style={{ width: 220 }}>Postpaid 145</Card></Specimen>
      <Specimen label="CARD_SELECTED + tick + texture">
        <Card className={`card-option relative isolate p-4 ${CARD_SELECTED}`} style={{ width: 220 }}>
          <SelectedCardTexture /><SelectedTick />Postpaid 145
        </Card>
      </Specimen>
      <Specimen label="CARD_HIGHLIGHT"><Card className={`card-option p-4 ${CARD_HIGHLIGHT}`} style={{ width: 220 }}>Recommended</Card></Specimen>
    </Row>
  ),
};

export const InteractiveGrid: Story = {
  render: () => {
    const plans = [{ id: 'p1', name: 'Postpaid 145', price: 145 }, { id: 'p2', name: 'Postpaid 245', price: 245 }, { id: 'p3', name: 'Postpaid 345', price: 345 }];
    const [selected, setSelected] = useState<string | null>(null);
    const chosen = plans.find((p) => p.id === selected);
    return (
      <Column>
        <Row>
          {plans.map((p) => {
            const on = selected === p.id;
            return (
              <Card key={p.id} className={`card-option relative isolate ${on ? CARD_SELECTED : CARD_IDLE}`} style={{ width: 220 }}>
                {on && <SelectedCardTexture />}
                {on && <SelectedTick />}
                <button type="button" aria-pressed={on} className="card-block" onClick={() => setSelected(on ? null : p.id)}>
                  <ServiceTypeTag type="postpaid-voice" />
                  <p className="body-text">{p.name}</p>
                  <p className="caption-muted">QAR {p.price} / month</p>
                </button>
              </Card>
            );
          })}
        </Row>
        {chosen && <p className="caption-muted">Chosen: {chosen.name}</p>}
      </Column>
    );
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const b = c.getByRole('button', { name: /Postpaid 245/ });
    await userEvent.click(b);
    await expect(b).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(b);
    await expect(b).toHaveAttribute('aria-pressed', 'false');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
  },
};
