import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ConnectionTypeTag } from '../../src/components/primitives/ConnectionTypeTag';
import { CONNECTION_TAG } from '../../src/lib/connectionType';
import { docsParameters } from '../_shared/docs';
import { Column, Row, Specimen } from '../_shared/layout';

const CATEGORIES = Object.keys(CONNECTION_TAG);

const meta = {
  title: 'Primitives/Connection Type Tag',
  component: ConnectionTypeTag,
  parameters: {
    ...docsParameters({
      purpose: 'The tag for a connection\'s service category (Postpaid, Prepaid, Fixed Line, Home Internet ...). Postpaid, Prepaid and Fixed Line reuse the shared service-type colours; other categories use their own badge colour.',
      source: 'src/components/primitives/ConnectionTypeTag.tsx, src/lib/connectionType.ts',
      variants: ['By `category`, resolved by `connectionTag()`; an unknown category shows a neutral badge under its own name.', '`label` overrides the wording and keeps the colour.'],
      states: ['Static label; no hover or selection state.'],
      usage: ['Use this, not a hand-coloured pill, wherever a connection\'s category is shown.'],
      accessibility: ['A plain badge: the label carries the meaning, colour is never the only cue.'],
    }),
  },
  argTypes: {
    category: { control: 'select', options: CATEGORIES, description: 'Service category of the connection.' },
    label: { control: 'text', description: 'Overrides the default wording, keeping the colour.' },
  },
  args: { category: CATEGORIES[0] },
} satisfies Meta<typeof ConnectionTypeTag>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllCategories: Story = {
  render: () => (
    <Column>
      <Row>
        {CATEGORIES.map((c) => (
          <Specimen key={c} label={c}><ConnectionTypeTag category={c} /></Specimen>
        ))}
      </Row>
    </Column>
  ),
};

export const UnknownCategory: Story = {
  name: 'Unknown category (neutral, own name)',
  args: { category: 'Roaming Pack' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Roaming Pack')).toBeVisible();
  },
};

export const LabelOverride: Story = {
  args: { category: 'Postpaid', label: 'Postpaid line' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Postpaid line')).toBeVisible();
  },
};
