import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { SummaryFieldRow } from '../../src/components/patterns/wizard/SummaryFieldRow';
import { docsParameters } from '../_shared/docs';
import { Column, Row, Specimen } from '../_shared/layout';

const meta = {
  title: 'Primitives/Data Display/Key Value, Chips and Tags',
  component: SummaryFieldRow,
  parameters: {
    ...docsParameters({
      purpose: 'Building blocks for showing data: the wizard\'s label / value row (SummaryFieldRow, with its Show all / Show less expander), the `.data-row` list row, and the chip and tag classes.',
      source: 'src/components/patterns/wizard/SummaryFieldRow.tsx; classes in src/ui-components.css (`.data-row`, `.chip*`, `.tag-*`)',
      variants: ['SummaryFieldRow `value`: `{ text, empty }`, or `{ text, fullList }` for a list cut to its first entries.', 'Chips: `chip`, `chip-plain`, `chip-field`, `chip-card`, `chip-soft`. Tags: `tag-accent`, `tag-warm`.'],
      states: ['Value present, value empty (muted "Not provided"), collapsed list, expanded list.'],
      events: ['The expander toggles in place; it exposes `aria-expanded`.'],
      usage: ['Render SummaryFieldRow inside a `<dl>`. There is no general accordion primitive in the app: expand / collapse exists only as this inline toggle and in feature screens (customer 360 service lists, offer details drawer), which are documented with their own components.', 'For service and status labels prefer Badge / ServiceTypeTag; chips and tags are plain, non-interactive styling classes.'],
      accessibility: ['`dt` / `dd` pair; the expander is a real button with `aria-expanded`.'],
    }),
  },
  decorators: [(Story) => <dl style={{ maxWidth: 420 }}><Story /></dl>],
  args: { label: 'Full name', value: { text: 'Aisha Al-Thani', empty: false } },
} satisfies Meta<typeof SummaryFieldRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { label: 'Email', value: { text: 'Not provided', empty: true } } };
export const ExpandableList: Story = {
  args: { label: 'Add-ons', value: { text: 'Roaming, Data Boost, Netflix +2 more', empty: false, fullList: ['Roaming', 'Data Boost', 'Netflix', 'Music', 'Cloud'] } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const toggle = c.getByRole('button', { name: 'Show all' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(c.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
    await expect(c.getByText(/Roaming, Data Boost, Netflix, Music, Cloud/)).toBeVisible();
    await userEvent.keyboard('{Enter}');
    await expect(c.getByRole('button', { name: 'Show all' })).toBeVisible();
  },
};

export const DataRows: Story = {
  name: 'Data rows (.data-row)',
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
  render: () => (
    <div>
      {[['Plan', 'Postpaid 145'], ['Monthly fee', 'QAR 145'], ['Contract', '24 months']].map(([k, v]) => (
        <div key={k} className="data-row"><span className="text-muted">{k}</span><span>{v}</span></div>
      ))}
    </div>
  ),
};

export const ChipsAndTags: Story = {
  decorators: [(Story) => <div><Story /></div>],
  render: () => (
    <Column>
      <Specimen label="Chips">
        <Row>
          <span className="chip">chip</span>
          <span className="chip-plain">chip-plain</span>
          <span className="chip-field">chip-field</span>
          <span className="chip-card">chip-card</span>
          <span className="chip-soft">chip-soft</span>
        </Row>
      </Specimen>
      <Specimen label="Tags">
        <Row>
          <span className="tag-accent px-2.5">tag-accent</span>
          <span className="tag-warm">tag-warm</span>
        </Row>
      </Specimen>
    </Column>
  ),
};

export const AllVariants: Story = {
  decorators: [(Story) => <div><Story /></div>],
  render: () => (
    <Column>
      <dl style={{ maxWidth: 420 }}>
        <SummaryFieldRow label="Full name" value={{ text: 'Aisha Al-Thani', empty: false }} />
        <SummaryFieldRow label="Email" value={{ text: 'Not provided', empty: true }} />
        <SummaryFieldRow label="Add-ons" value={{ text: 'Roaming, Data Boost +1 more', empty: false, fullList: ['Roaming', 'Data Boost', 'Netflix'] }} />
      </dl>
    </Column>
  ),
};
