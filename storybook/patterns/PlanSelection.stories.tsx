import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { PlanSelection } from '../../src/capabilities';
import { Plan } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Plan Selection',
  component: PlanSelection,
  parameters: {
    ...docsParameters({
      purpose: 'Choose the plan: postpaid plan cards under the Offers / Standard Plans / Special Offers tabs (Special Offers when a Special Discount is validated) with search, the plan-type filter, plan details and Edit Discount; prepaid packs with Customise Add-ons and Edit Discount; or the fixed-line / fibre plan cards with the credit check. (Capability registry: "Plan Selection".)',
      source: 'src/capabilities/PlanSelection/PlanSelection.tsx',
      variants: ['`kind="postpaid"`', '`kind="prepaid"`', '`kind="fixed"`', 'Postpaid with a held Special Discount (Consumer B2B2C, Retiree, MADA): the page opens on Special Offers.'],
      states: ['Nothing selected', 'Plan selected (card takes the selected style, with the tick)', 'Deselected by choosing it again', 'Discount applied', 'Loading / empty catalogue'],
      events: ['`onSelectProduct(productId)` / `onDeselectProduct()`', '`onSelectDiscount(discountId)`', 'Fixed: `values` + `setValue(field, value)` (journey draft).'],
      usage: ['Recommended Offers is its own capability, the step before this one; the plan\'s add-ons are the Add-Ons capability\'s own page. Selectable card visuals are owned by the card primitives.'],
    }),
  },
  argTypes: { kind: { control: 'select', options: ['postpaid', 'prepaid', 'fixed'], description: 'Which catalogue the cards come from.' } },
} satisfies Meta<typeof PlanSelection>;
export default meta;
type Story = StoryObj<typeof PlanSelection>;

/** The app's own Capability Library preview, with its Postpaid / Prepaid / Fixed switcher. */
export const Default: Story = { render: () => <Plan /> };

type Held = 'none' | 'b2b2c' | 'retired' | 'mada';
function Postpaid({ held }: { held: Held }) {
  const [p, setP] = useState<string | undefined>();
  const [d, setD] = useState<string | undefined>();
  return (
    <PlanSelection
      kind="postpaid"
      customerBenefits={undefined}
      specialDiscountType={held}
      customerBenefit={held === 'none' ? undefined : held}
      selectedProductId={p}
      onSelectProduct={setP}
      onDeselectProduct={() => setP(undefined)}
      discountId={d}
      onSelectDiscount={setD}
    />
  );
}
export const Postpaid_NoSpecialDiscount: Story = { name: 'Postpaid', render: () => <Postpaid held="none" /> };
export const PostpaidRetiree: Story = { render: () => <Postpaid held="retired" /> };
export const PostpaidMada: Story = { render: () => <Postpaid held="mada" /> };
export const PostpaidB2b2c: Story = { render: () => <Postpaid held="b2b2c" /> };

export const Prepaid: Story = {
  render: () => {
    const [p, setP] = useState<string | undefined>();
    return <PlanSelection kind="prepaid" selectedProductId={p} onSelectProduct={setP} onDeselectProduct={() => setP(undefined)} />;
  },
};

export const FixedFibre: Story = {
  render: () => {
    const [values, setValues] = useState<Record<string, unknown>>({});
    return <PlanSelection kind="fixed" values={values} setValue={(field, value) => setValues((v) => ({ ...v, [field]: value }))} />;
  },
};

export const SwitchVariant: Story = {
  render: () => <Plan />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('tab', { name: 'Prepaid Pack' }));
    await expect(canvas.getByRole('tab', { name: 'Prepaid Pack', selected: true })).toBeInTheDocument();
  },
};
