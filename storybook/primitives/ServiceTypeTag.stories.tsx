import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ServiceTypeTag } from '../../src/components/primitives/ServiceTypeTag';
import { SERVICE_TYPE_TAGS, type ServiceTypeTagKey } from '../../src/lib/serviceTypeTag';
import { docsParameters } from '../_shared/docs';
import { Row, Specimen } from '../_shared/layout';

const KEYS = Object.keys(SERVICE_TYPE_TAGS) as ServiceTypeTagKey[];

const meta = {
  title: 'Primitives/Service Type Tag',
  component: ServiceTypeTag,
  parameters: {
    ...docsParameters({
      purpose: 'The tag naming a kind of service (Postpaid, Prepaid, New MNP ...). Wording and colour come from `lib/serviceTypeTag`, so every screen shows the same kind in the same colour.',
      source: 'src/components/primitives/ServiceTypeTag.tsx, src/lib/serviceTypeTag.ts',
      variants: [`\`type\`: ${KEYS.map((k) => `\`${k}\``).join(', ')}.`],
      states: ['Static label; no hover or selection state.'],
      usage: ['Use this, never a hand-coloured pill. For a service category string (Postpaid, Fixed Line ...) use Connection Type Tag, which resolves to this tag where one exists.'],
      accessibility: ['A plain span: the label carries the meaning, colour is never the only cue.'],
    }),
  },
  argTypes: {
    type: { control: 'select', options: KEYS, description: 'Which service type to show.' },
    className: { control: false },
  },
  args: { type: KEYS[0] },
} satisfies Meta<typeof ServiceTypeTag>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    await expect(within(canvasElement).getByText(SERVICE_TYPE_TAGS[args.type].label)).toBeVisible();
  },
};

export const AllTypes: Story = {
  render: () => (
    <Row>
      {KEYS.map((k) => (
        <Specimen key={k} label={k}><ServiceTypeTag type={k} /></Specimen>
      ))}
    </Row>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    for (const k of KEYS) await expect(c.getAllByText(SERVICE_TYPE_TAGS[k].label).length).toBeGreaterThan(0);
  },
};
