import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CreditCheckPanel } from '../../src/components/domain/CreditCheckPanel';
import { docsParameters } from '../_shared/docs';

type PanelProps = Parameters<typeof CreditCheckPanel>[0];

function Demo(props: PanelProps) {
  const [ack, setAck] = useState(props.acknowledged);
  return (
    <div style={{ maxWidth: 640 }}>
      <CreditCheckPanel
        {...props}
        acknowledged={ack}
        onAcknowledge={(v) => {
          props.onAcknowledge(v);
          setAck(v);
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Business Components/Credit Check Panel',
  component: CreditCheckPanel,
  render: (args) => <Demo {...args} />,
  parameters: {
    ...docsParameters({
      purpose: 'The fixed-line (fibre) outstanding-dues credit check as a visible decision point, never a silent pass or fail. It judges `outstandingQar` with BR-FIBRE-OUTSTANDING-THRESHOLD: with nothing owed it passes; with a balance the rule reports the threshold is unresolved (the business has not agreed a value), so the agent must tick an explicit acknowledgement to go on.',
      source: 'src/components/domain/CreditCheckPanel.tsx (rule: src/engines/ruleEngine.ts)',
      states: ['Pass: green notice with a "Credit Check" badge and the rule\'s message (nothing outstanding).', 'Unresolved: amber notice with an "Unresolved Policy Conflict" badge, the message naming the balance, and an unchecked acknowledgement.', 'Acknowledged: the same notice with the box ticked (the caller then lets the journey proceed).'],
      events: ['`onAcknowledge(checked)` - the acknowledgement checkbox.'],
      usage: ['The caller owns `acknowledged` and gates Continue on it. This is a UX decision layered on the rule engine; the engine itself does not unblock anything.'],
      accessibility: ['The acknowledgement is a real Checkbox inside its `Label`, so clicking the sentence toggles it. Status is carried by a text badge, not colour alone.'],
      restrictions: ['The acknowledgement wording cites the internal "conflict-report.md Conflict 1", which is a project document, not agent-facing language.'],
    }),
  },
  argTypes: {
    outstandingQar: { control: { type: 'number', min: 0 }, description: 'What the customer owes (QAR); the rule only judges above zero.' },
    acknowledged: { control: 'boolean', description: 'Whether the agent ticked the acknowledgement.' },
    onAcknowledge: { control: false },
  },
  args: { outstandingQar: 0, acknowledged: false, onAcknowledge: fn() },
} satisfies Meta<typeof CreditCheckPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NothingOutstanding: Story = {};

export const UnresolvedPolicy: Story = { args: { outstandingQar: 450 } };

export const Acknowledged: Story = { args: { outstandingQar: 450, acknowledged: true } };

export const Acknowledge: Story = {
  args: { outstandingQar: 450 },
  play: async ({ canvasElement, args }) => {
    const box = within(canvasElement).getByRole('checkbox');
    await expect(box).not.toBeChecked();
    await userEvent.click(box);
    await expect(args.onAcknowledge).toHaveBeenCalledWith(true);
    await expect(box).toBeChecked();
  },
};

export const KeyboardAcknowledge: Story = {
  args: { outstandingQar: 450 },
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole('checkbox');
    await userEvent.tab();
    await expect(box).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect(box).toBeChecked();
  },
};
