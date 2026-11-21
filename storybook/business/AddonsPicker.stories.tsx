import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { AddonsPicker } from '../../src/capabilities/AddonsSelection/AddonsPicker';
import { docsParameters } from '../_shared/docs';

type Props = Parameters<typeof AddonsPicker>[0];

/** Holds the selection the way the Add-ons step does, and reports each change to the Actions panel. */
function Host(args: Props) {
  const [ids, setIds] = useState<string[]>(args.selectedIds);
  return (
    <AddonsPicker
      {...args}
      selectedIds={ids}
      onChange={(next) => {
        setIds(next);
        args.onChange(next);
      }}
    />
  );
}

const meta = {
  title: 'Business Components/Add-ons Picker',
  component: AddonsPicker,
  parameters: {
    ...docsParameters({
      purpose: 'The add-on list of the Add-ons page: eligible add-ons from the catalogue (or a prepaid pack\'s own add-ons) as selectable cards or rows, optionally under category tabs with Paid and Free side by side, a search field, billing-frequency choice, add-on discounts and the Multi-SIM maximum. It is the body of `PostpaidAddonsStep` and `PrepaidAddonsStep`.',
      source: 'src/capabilities/AddonsSelection/AddonsPicker.tsx',
      variants: [
        '`layout="cards"` (default, with its own collapsible "Add-ons" heading) or `layout="rows"` (one full-width row per add-on).',
        '`categorized` - the category tabs (Local Data, Local Minutes, International, Roaming, Combo, Others, Frequently Used) and a Paid / Free column pair; the Add-ons page uses it with `hideHeader` and `layout="rows"`.',
        '`source="catalogue"` (default, postpaid add-on products offered by plan eligibility) or `source="prepaid"` (the add-ons of the pack named by `eligibilityContext.planId`, a one-off charge).',
        '`mandatoryProducts` (prepaid) - the pack\'s mandatory products are selected for the agent and cannot be removed.',
        '`appliedDiscounts` - shows each discounted add-on\'s reduced charge and the discount.',
      ],
      states: ['Loading', 'Load error (alert with Retry)', 'Empty (`emptyMessage`, or nothing rendered when omitted)', 'Nothing selected / add-ons selected', 'Add-on blocked by the Multi-SIM maximum ("Not available ...")', 'Mandatory (cannot be deselected)'],
      events: ['`onChange(ids)` - the new selection.', '`onBillingChange(map)` - add-on id to the chosen billing frequency, for an add-on with several billing options.'],
      usage: ['Eligibility is evaluated before anything renders: an add-on the customer is not eligible for is not listed at all. These stories read the mock catalogue (`products.json`, `addons-discounts.json`); PROD-110 is a Standard Plans plan and PROD-301 the Prepaid Red 25 pack.'],
      accessibility: ['Each add-on card is a `role="button"` with `aria-pressed`; a blocked or mandatory add-on has `aria-disabled`. The collapsible heading is a button with `aria-expanded`; the search field is labelled "Search <category> add-ons". The load-error notice is `role="alert"`.'],
      restrictions: ['It loads its own data through the API layer, so the catalogue must be reachable; Storybook serves `public/` for it.'],
    }),
  },
  argTypes: {
    layout: { control: 'inline-radio', options: ['cards', 'rows'], description: 'A grid of cards or one full-width row per add-on.' },
    source: { control: 'inline-radio', options: ['catalogue', 'prepaid'], description: 'Postpaid catalogue add-ons, or the prepaid pack\'s.' },
    categorized: { control: 'boolean', description: 'Category tabs with Paid and Free columns (rows layout).' },
    hideHeader: { control: 'boolean', description: 'Drop the collapsible "Add-ons" heading when the page already names the section.' },
    mandatoryProducts: { control: 'boolean', description: 'Prepaid: mandatory products are selected and cannot be removed.' },
    emptyMessage: { control: 'text', description: 'Shown when no add-on is available.' },
    selectedIds: { control: false },
    selectedBilling: { control: false },
    eligibilityContext: { control: false },
    multiSimPlan: { control: false },
    appliedDiscounts: { control: false },
    onChange: { control: false },
    onBillingChange: { control: false },
  },
  args: { selectedIds: [], onChange: fn(), onBillingChange: fn(), hideHeader: true, layout: 'rows', categorized: true, eligibilityContext: { planId: 'PROD-110' }, emptyMessage: 'No add-ons available for this plan' },
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof AddonsPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The Add-ons page's configuration: categorised rows for a Standard Plans plan. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll('[role="button"][aria-pressed]').length).toBeGreaterThan(0), { timeout: 5000 });
  },
};

export const SelectAndDeselect: Story = {
  play: async ({ canvasElement, args }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll('[role="button"][aria-pressed="false"]').length).toBeGreaterThan(0), { timeout: 5000 });
    const card = canvasElement.querySelector('[role="button"][aria-pressed="false"]') as HTMLElement;
    await userEvent.click(card);
    await expect(args.onChange).toHaveBeenLastCalledWith([expect.any(String)]);
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(card);
    await expect(args.onChange).toHaveBeenLastCalledWith([]);
  },
};

export const SearchTheCategory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = await canvas.findByRole('textbox', {}, { timeout: 5000 });
    await userEvent.type(search, 'zzzz-no-such-addon');
    await expect(canvasElement.querySelectorAll('[role="button"][aria-pressed]')).toHaveLength(0);
  },
};

export const CardsWithOwnHeading: Story = { args: { layout: 'cards', categorized: false, hideHeader: false } };
export const PrepaidPack: Story = { args: { source: 'prepaid', eligibilityContext: { planId: 'PROD-301' }, emptyMessage: 'No add-ons available for this pack' } };
export const PrepaidMandatoryProducts: Story = { args: { source: 'prepaid', mandatoryProducts: true, eligibilityContext: { planId: 'PROD-301' } } };
export const WithAppliedDiscount: Story = { args: { selectedIds: ['PROD-160'], appliedDiscounts: { 'PROD-160': 'ADD-DSC-001' } } };
export const NoPlanSoNothingEligible: Story = { args: { eligibilityContext: {}, emptyMessage: 'No add-ons available - choose a plan first' } };
export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } };
