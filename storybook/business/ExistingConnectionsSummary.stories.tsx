import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ExistingConnectionsSummary } from '../../src/capabilities/EligibilityGate/ExistingConnectionsSummary';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Business Components/Existing Connections Summary',
  component: ExistingConnectionsSummary,
  parameters: {
    ...docsParameters({
      purpose: 'The customer\'s active connections - in total and by line type (Postpaid, Prepaid, Fixed) - shown on the Contact page, in the right-hand column immediately above the Journey Summary, once the ID is validated. Informational only: it never blocks Continue.',
      source: 'src/capabilities/EligibilityGate/ExistingConnectionsSummary.tsx (data: existingConnectionsSummaryModel.ts)',
      variants: ['Counts only (every check passes)', 'Counts with a Warning panel'],
      states: ['No warnings: the warning panel is not rendered', 'Warnings: connection limit reached or exceeded (told whether or not the customer is blacklisted). Connection warnings only: blacklist, security, outstanding balance and every other eligibility result stay in the eligibility panel'],
      usage: ['Contact page only; the step passes it as `asideAbove`, so it is gone on every later page.', 'Not shown for a new customer or one who holds no connections (`existingConnectionsSummary` returns null).'],
      accessibility: ['A named region; the warning panel is a `role="alert"`.'],
    }),
  },
  args: { summary: { total: 7, postpaid: 4, prepaid: 2, fixed: 1, warnings: [], warningParts: [] } },
} satisfies Meta<typeof ExistingConnectionsSummary>;
export default meta;
type Story = StoryObj<typeof ExistingConnectionsSummary>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText('Total Active Connections')).toBeVisible();
    await expect(c.queryByRole('alert')).toBeNull();
  },
};

export const WithWarnings: Story = {
  args: { summary: { total: 9, postpaid: 6, prepaid: 2, fixed: 1, warnings: ['Mobile Postpaid: Connection limit exceeded. Approval is required for activation.', 'Fixed: Connection limit exceeded. Approval is required for activation.'], warningParts: [{ label: 'Mobile Postpaid', message: 'Connection limit exceeded. Approval is required for activation.' }, { label: 'Fixed', message: 'Connection limit exceeded. Approval is required for activation.' }] } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('Connection limit exceeded');
  },
};
