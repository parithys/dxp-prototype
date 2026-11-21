import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { AutoAllocatedNumber } from '../../src/capabilities/NumberSelection/AutoAllocatedNumber';
import { RefreshNumbersButton } from '../../src/capabilities';
import type { MsisdnSource } from '../../src/capabilities/NumberSelection/prepaidNumberAllocation';
import { docsParameters } from '../_shared/docs';
import { Specimen, Column } from '../_shared/layout';

const meta = {
  title: 'Business Components/Number Selection Parts',
  component: AutoAllocatedNumber,
  parameters: {
    ...docsParameters({
      purpose: 'Two small parts of the Number Selection step. `AutoAllocatedNumber` (New Prepaid) allocates the first available Free number when the order has none and says so; `RefreshNumbersButton` is the step title row\'s Refresh action that reads the number inventory again.',
      source: 'src/capabilities/NumberSelection/AutoAllocatedNumber.tsx and RefreshNumbersButton.tsx',
      variants: ['`AutoAllocatedNumber`: allocating note, "Allocated from the Free pool" note (`source` is `auto`), pool-empty note, or nothing (a number chosen by the agent).', '`RefreshNumbersButton`: one secondary small button with the refresh icon.'],
      states: ['Allocating (reads the `numbers` collection through the API layer)', 'Allocated', 'Pool empty', 'Number already on the order: never replaced, no note unless it was auto-allocated'],
      events: ['`onAllocate(msisdn)` fires once, when the step opens with no number: the lowest available Free number. `onClick` on Refresh.'],
      usage: ['A Star, Reserved or Blocked number is never allocated; a Pre-Paired SIM skips the step.'],
      accessibility: ['The notes are `role="status"` so the allocation is announced; Refresh is a native button named "Refresh".'],
    }),
  },
  argTypes: {
    msisdn: { control: 'text', description: 'The order\'s number; empty triggers the allocation.' },
    source: { control: 'select', options: ['selected', 'auto'], description: 'Where the number came from.' },
    onAllocate: { control: false },
  },
  args: { msisdn: undefined, source: undefined, onAllocate: fn() },
} satisfies Meta<typeof AutoAllocatedNumber>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The step: the order holds no number until the part allocates one. */
function Step({ initial, source: initialSource }: { initial?: string; source?: MsisdnSource }) {
  const [msisdn, setMsisdn] = useState(initial);
  const [source, setSource] = useState(initialSource);
  return (
    <div className="stack gap-2">
      <AutoAllocatedNumber msisdn={msisdn} source={source} onAllocate={(m) => { setMsisdn(m); setSource('auto'); }} />
      <p className="caption-muted">Order number: {msisdn ?? 'none'}</p>
    </div>
  );
}

export const Default: Story = {
  render: () => <Step />,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(within(canvasElement).getByText(/Allocated from the Free pool/)).toBeVisible(), { timeout: 5000 });
    await expect(within(canvasElement).getByText(/Order number: \+?\d+/)).toBeVisible();
  },
};

export const NumberChosenByTheAgent: Story = {
  render: () => <Step initial="+97455500000" source="selected" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('status')).toBeNull();
  },
};

export const KeptAutoAllocatedNumber: Story = {
  render: () => <Step initial="+97455500000" source="auto" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Continue with this number or choose another below');
  },
};

export const Refresh: StoryObj<typeof RefreshNumbersButton> = {
  render: () => {
    const onClick = fn();
    return (
      <Column>
        <Specimen label="RefreshNumbersButton">
          <RefreshNumbersButton onClick={onClick} />
        </Specimen>
      </Column>
    );
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Refresh' });
    await userEvent.click(button);
    await expect(button).toBeEnabled();
  },
};
