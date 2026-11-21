import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ActivityComments } from '../../src/capabilities';
import { Activity } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Activity Comments',
  component: ActivityComments,
  parameters: {
    ...docsParameters({
      purpose: 'The closing note on the actions performed, with an optional channel. It is logged as an account activity for other advisors; where the journey records how the customer came in, the channel is chosen above the comments. (Capability registry: "Activity Comments".)',
      source: 'src/capabilities/ActivityComments/ActivityComments.tsx',
      variants: ['Comments only (no `channel`).', 'With `channel` - a Select above the comments: `{ value, onChange, options }`.'],
      states: ['Empty (placeholder "Enter comments…").', 'Populated.'],
      events: ['`onChange(value: string)` on every keystroke.', '`channel.onChange(value: string)` when the channel changes.'],
      usage: ['The terminal step of a journey ("Save & Finish"); mounted through `activityStep`. Value shape: a plain string.'],
      accessibility: ['The comments field is a labelled textarea ("Comments") with helper text.'],
    }),
  },
  argTypes: { value: { control: 'text', description: 'The comment text.' }, onChange: { control: false }, channel: { control: false } },
} satisfies Meta<typeof ActivityComments>;
export default meta;
type Story = StoryObj<typeof ActivityComments>;

function Controlled({ withChannel }: { withChannel: boolean }) {
  const [c, setC] = useState('');
  const [ch, setCh] = useState('Appointment');
  return <ActivityComments value={c} onChange={setC} channel={withChannel ? { value: ch, onChange: setCh, options: ['Appointment', 'Walk-in', 'Call Center'] } : undefined} />;
}

/** The app's own Capability Library preview (comments with a channel). */
export const Default: Story = { render: () => <Activity /> };

export const CommentsOnly: Story = { render: () => <Controlled withChannel={false} /> };

export const Populated: Story = { render: () => <ActivityComments value="Activated a new postpaid line and explained the first bill." onChange={() => {}} /> };

export const TypeAComment: Story = {
  render: () => <Controlled withChannel={false} />,
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole('textbox', { name: /comments/i });
    await userEvent.type(box, 'Customer asked for a paper bill');
    await expect(box).toHaveValue('Customer asked for a paper bill');
  },
};
