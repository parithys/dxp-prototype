import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within, screen } from 'storybook/test';
import { PlanSelection, numberSelectionStep, postpaidPlanStep } from '../../src/capabilities';
import { listEntities } from '../../src/services/entityOps';
import { starEntitlementQar } from '../../src/engines/postpaidPricing';
import { formatQar } from '../../src/lib/format';
import { StepFlow, exampleParameters } from './_harness';
import type { Values } from './_harness';
import { CLEAN_ELIGIBILITY, SLOW, useLoaded } from './_fixtures';

interface Product {
  productId: string;
  name: string;
  mrcQAR: number;
  starNumberEntitlementQar?: number;
  preBundledOffer?: boolean;
  features?: string[];
  benefits?: string[];
}

const meta: Meta = {
  title: 'Application Examples/Product and Plan Selection',
  parameters: exampleParameters({
    purpose: 'Offers & Plans as one scenario: the plan cards under their tabs (Offers, Standard Plans), search and the plan-type filter, the plan details drawer, the selection summary, and the effect a choice has on the step after it. Built from the production Plan Selection capability and the real plan catalogue (public/mock-data/products.json).',
    source: 'src/capabilities/PlanSelection (postpaidStep.tsx, PlanSelection.tsx) with src/capabilities/NumberSelection for the step that reads the choice',
    variants: [
      'Default: the postpaid plan step, then Number Selection - choosing a plan updates the Journey Summary and changes the Star-number entitlement note of the next step (entitlement = plan monthly charge x the configured multiple, or the plan\'s own `starNumberEntitlementQar`).',
      'Search and select: typing narrows the active tab\'s cards by name, price or benefits; a card selects on click, and clicking it again unselects.',
      'Plan details: "View details" opens the details drawer beside the list; it does not select the plan.',
      'Prepaid packs: the same capability with `kind="prepaid"`.',
    ],
    states: ['Loading the catalogue', 'No plan selected (Continue disabled)', 'Plan selected (card shows the red border and tick, Continue enabled)', 'Details drawer open', 'Search with no match'],
    events: ['`onSelectProduct(id)`, `onDeselectProduct()`, `onPlanTabChange(tab)`, `onSelectionChange({ source, bundled })` - the step stores `productId`, `planTab`, `selectionSource` and `bundledItems`.'],
    usage: ['The step also offers Customise Add-ons and Edit Discount beside Continue once a plan is chosen on a tab that has them; a plan on the Offers tab is pre-bundled and skips the add-ons step.'],
    devices: ['The same cards on both devices; tablet.css scales controls. Use the toolbar **Device** switch or the `Tablet` story.'],
    restrictions: ['The Special Offers tab appears only for a customer whose Special Discount has been validated at Customer Verification (see Patterns / Special Discounts Identification); it is not walked here.'],
  }),
};
export default meta;
type Story = StoryObj<typeof meta>;

/** What the agent reads back while choosing: the plan in the values and what it entitles the customer to. */
function SelectionSummary({ products, values }: { products: Product[]; values: Values }) {
  const plan = products.find((p) => p.productId === values.productId);
  return (
    <section aria-label="Selection summary" className="card pad-panel stack gap-1">
      <h3 className="title title-sm">Selection summary</h3>
      {plan ? (
        <>
          <p className="body-text">
            {plan.name} - {formatQar(plan.mrcQAR)} / month
          </p>
          <p className="caption-secondary">Star Number entitlement: {formatQar(starEntitlementQar(plan))}</p>
          {plan.preBundledOffer && <p className="caption-secondary">Pre-bundled offer: add-ons are skipped.</p>}
        </>
      ) : (
        <p className="caption-muted">No plan selected yet.</p>
      )}
    </section>
  );
}

function PlanFlow() {
  const products = useLoaded(() => listEntities<Product>('products'));
  const steps = useMemo(
    () =>
      products
        ? [
            postpaidPlanStep({ products, customerBenefits: undefined }),
            numberSelectionStep({
              priceField: 'numberPriceQAR',
              refresh: true,
              waiveOff: true,
              plan: (values) => {
                const plan = products.find((p) => p.productId === values.productId);
                return plan ? { mrcQar: plan.mrcQAR, starEntitlementQar: starEntitlementQar(plan) } : undefined;
              },
            }),
          ]
        : [],
    [products]
  );
  if (!products) return <p className="muted-body">Loading the plan catalogue…</p>;
  return <StepFlow steps={steps} initial={{ eligibility: CLEAN_ELIGIBILITY }} extra={(values) => <SelectionSummary products={products} values={values} />} />;
}

const planCard = (root: HTMLElement, productId: string) => root.querySelector<HTMLElement>(`#plan-card-${productId}`);

export const Default: Story = {
  render: () => <PlanFlow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Nothing chosen: Continue is disabled and the summary says so.
    await canvas.findAllByRole('button', { name: /View details for/ }, SLOW);
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await expect(canvas.getByText('No plan selected yet.')).toBeVisible();
    // Choosing a plan card selects it, shows it in the selection summary and enables Continue.
    const card = planCard(canvasElement, 'PROD-107');
    await expect(card).not.toBeNull();
    await userEvent.click(card as HTMLElement);
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(await canvas.findByText(/Postpaid Essential - QAR/)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled();
    // Continue: Number Selection states the entitlement the chosen plan gives.
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await expect(await canvas.findByText(/includes a Star Number worth up to/, undefined, SLOW)).toBeVisible();
  },
};

export const SearchAndSelect: Story = {
  render: () => <PlanFlow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByRole('button', { name: /View details for/ }, SLOW);
    // The Offers tab (the first) has no search; Standard Plans does, scoped to that tab's cards.
    await userEvent.click(canvas.getByRole('tab', { name: /Standard Plans/ }));
    const search = await canvas.findByRole('combobox', { name: /Search .* by name, price or benefits/ }, SLOW);
    const cards = () => canvasElement.querySelectorAll<HTMLElement>('[id^="plan-card-"]');
    await waitFor(() => expect(cards().length).toBeGreaterThan(0));
    const before = cards().length;
    const target = cards()[0];
    const targetName = target.querySelector('[aria-label^="View details for"]')?.getAttribute('aria-label')?.replace('View details for ', '') ?? '';
    await expect(targetName).not.toBe('');
    await userEvent.type(search, 'zzzz-no-such-plan');
    await waitFor(() => expect(cards().length).toBe(0));
    await userEvent.clear(search);
    await waitFor(() => expect(cards().length).toBe(before));
    // A search narrows the tab's cards; the plan can then be chosen from what is left.
    await userEvent.type(search, targetName);
    await waitFor(() => expect(document.getElementById(target.id)).not.toBeNull());
    await userEvent.click(document.getElementById(target.id) as HTMLElement);
    await expect(document.getElementById(target.id)).toHaveAttribute('aria-pressed', 'true');
  },
};

export const PlanDetailsDrawer: Story = {
  name: 'Selected offer details drawer',
  render: () => <PlanFlow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'View details for Postpaid Essential' }, SLOW));
    // The drawer is a dialog in a portal, so it is read from the page, not the canvas.
    const drawer = await screen.findByRole('dialog');
    await expect(drawer).toBeVisible();
    // Opening the details does not select the plan.
    await expect(planCard(canvasElement, 'PROD-107')).toHaveAttribute('aria-pressed', 'false');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  },
};

function PrepaidPacks() {
  const [pack, setPack] = useState<string | undefined>();
  return (
    <div className="stack gap-4">
      <PlanSelection kind="prepaid" selectedProductId={pack} onSelectProduct={setPack} onDeselectProduct={() => setPack(undefined)} />
      <p className="caption-secondary" role="status">
        {pack ? `Selected pack: ${pack}` : 'No pack selected.'}
      </p>
    </div>
  );
}

export const PrepaidPacksVariant: Story = {
  name: 'Prepaid packs',
  render: () => <PrepaidPacks />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No pack selected.')).toBeVisible();
    const cards = await waitFor(() => {
      const found = canvasElement.querySelectorAll<HTMLElement>('[role="button"][aria-pressed]');
      if (found.length === 0) throw new Error('no pack cards yet');
      return found;
    }, SLOW);
    await userEvent.click(cards[0]);
    await expect(await canvas.findByText(/Selected pack: PROD-/)).toBeVisible();
  },
};

export const Tablet: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  parameters: { viewport: { defaultViewport: 'tablet' } },
  render: () => <PlanFlow />,
  play: async ({ canvasElement }) => {
    await expect((await within(canvasElement).findAllByRole('button', { name: /View details for/ }, SLOW)).length).toBeGreaterThan(0);
  },
};
