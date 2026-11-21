import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AddonsSelection } from '../../src/capabilities';
import { Addons } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Add-ons Selection',
  component: AddonsSelection,
  parameters: {
    ...docsParameters({
      purpose: 'The Add-Ons page, its own capability beside Plan Selection and built the same way for postpaid and prepaid: a postpaid plan\'s add-ons under category tabs (Local Data, Local Minutes, International, Roaming, Combo, Others, Frequently Used) with Paid and Free side by side, billing frequency, the Multi-SIM maximum and, where the journey sets them, the Bill Limit and service options; a prepaid pack\'s add-ons. (Capability registry: "Add-Ons".)',
      source: 'src/capabilities/AddonsSelection/AddonsSelection.tsx',
      variants: ['`kind="postpaid"` with `planId`, `bundledPlansTakeNoAddons`, `billLimit`, `serviceOptions`.', '`kind="prepaid"` with `selectedProductId` and `onSelectAddons`.', 'Add Add-On journey: the line\'s own plan, no bill limit or service options, `emptyMessage`.'],
      states: ['No add-ons chosen', 'Add-ons chosen', 'Plan with no add-ons (empty message)', 'A plan on the Offers tab is pre-bundled and lists no add-ons in the activation journey'],
      events: ['`onAddonsChange(ids)`, `onAddonBillingChange(map)`, `billLimit.onChange(amount)`, `serviceOptions.onChange(options)`; prepaid: `onSelectAddons(ids)`.'],
      usage: ['The preview plan is PROD-110 (a Standard Plans plan) and the prepaid pack PROD-301 (Prepaid Red 25), the ones the Capability Library uses.'],
    }),
  },
  argTypes: { kind: { control: 'select', options: ['postpaid', 'prepaid'], description: 'Postpaid plan add-ons or a prepaid pack\'s.' } },
} satisfies Meta<typeof AddonsSelection>;
export default meta;
type Story = StoryObj<typeof AddonsSelection>;

/** The app's own Capability Library preview, with its Postpaid / Prepaid / Add Add-On switcher. */
export const Default: Story = { render: () => <Addons /> };

export const AddAddOnOnly: Story = {
  render: () => {
    const [ids, setIds] = useState<string[]>([]);
    return <AddonsSelection kind="postpaid" planId="PROD-110" addonIds={ids} onAddonsChange={setIds} customerContext={{}} emptyMessage="No add-ons available for this plan" />;
  },
};

export const Prepaid: Story = {
  render: () => {
    const [a, setA] = useState<string[]>([]);
    return <AddonsSelection kind="prepaid" selectedProductId="PROD-301" addonIds={a} onSelectAddons={setA} />;
  },
};
