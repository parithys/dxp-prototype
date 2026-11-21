import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { PlanTabStrip } from '../../src/components/patterns/PlanTabStrip';
import type { TabKey } from '../../src/components/patterns/postpaidPlanModel';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Navigation/Plan Tab Strip',
  component: PlanTabStrip,
  parameters: {
    ...docsParameters({
      purpose: 'The Offers / Plans tab strip of the plan step: the design system\'s TabStrip with the plan groups.',
      source: 'src/components/patterns/PlanTabStrip.tsx',
      accessibility: ['A tablist of two tabs; the selected tab has aria-selected="true".'],
    }),
  },
} satisfies Meta<typeof PlanTabStrip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PlanGroups: Story = {
  name: 'PlanTabStrip (Offers / Plans)',
  args: { planGroupTabs: [{ key: 'for-you', label: 'Offers' }, { key: 'standard', label: 'Plans' }], activeTab: 'for-you', setActiveTab: () => undefined },
  render: (args) => {
    const [tab, setTab] = useState<TabKey>('for-you');
    return <PlanTabStrip {...args} activeTab={tab} setActiveTab={setTab} />;
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('tab', { name: 'Plans' }));
    await expect(c.getByRole('tab', { name: 'Plans' })).toHaveAttribute('aria-selected', 'true');
  },
};
