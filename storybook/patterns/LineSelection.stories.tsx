import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LineSelection } from '../../src/capabilities';
import type { CustomerLine } from '../../src/capabilities';
import { Lines } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Line Selection',
  component: LineSelection,
  parameters: {
    ...docsParameters({
      purpose: 'Choose which of the identified customer\'s existing mobile lines an order changes (Change Postpaid Plan, Change Prepaid Pack, Add Add-On): postpaid and / or prepaid lines with their current plan and price; a line that is not active, is barred or whose billing profile is in collections is shown with its reason and cannot be chosen. (Capability registry: "Line Selection".)',
      source: 'src/capabilities/LineSelection/LineSelection.tsx (LineSelectionStep)',
      variants: ['`lineType` omitted: all mobile lines.', '`lineType="postpaid"` / `"prepaid"`.', '`requirePlan`.'],
      states: ['Loading', 'No lines', 'Lines listed', 'Line selected', 'A line that cannot be changed (shown with its reason, not selectable)'],
      events: ['`onChange(line | undefined)`. A line chosen for another customer is cleared when the identity changes.'],
      usage: ['The lines come from the customer\'s services through the shared classification (`customerServicesEngine`), never from a name match. CUST-1001 holds postpaid and prepaid lines.'],
    }),
  },
  argTypes: { lineType: { control: 'select', options: [undefined, 'postpaid', 'prepaid'], description: 'Which lines to list.' }, customerId: { control: 'text' }, value: { control: false }, onChange: { control: false } },
  args: { customerId: 'CUST-1001' },
} satisfies Meta<typeof LineSelection>;
export default meta;
type Story = StoryObj<typeof LineSelection>;

function Host({ customerId, lineType }: { customerId?: string; lineType?: 'postpaid' | 'prepaid' }) {
  const [line, setLine] = useState<CustomerLine | undefined>();
  return <LineSelection customerId={customerId} lineType={lineType} value={line} onChange={setLine} />;
}

/** The app's own Capability Library preview, with its All / Postpaid / Prepaid switcher. */
export const Default: Story = { render: () => <Lines /> };
export const PostpaidLines: Story = { render: (args) => <Host customerId={args.customerId} lineType="postpaid" /> };
export const PrepaidLines: Story = { render: (args) => <Host customerId={args.customerId} lineType="prepaid" /> };
export const NoCustomer: Story = { render: () => <Host customerId={undefined} /> };
