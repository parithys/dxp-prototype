import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within, screen } from 'storybook/test';
import { numberSelectionStep } from '../../src/capabilities';
import type { AdditionalDocument } from '../../src/capabilities';
import { listEntities } from '../../src/services/entityOps';
import { requiredDocumentsFor } from '../../src/engines/journeyDocuments';
import { starEntitlementQar } from '../../src/engines/postpaidPricing';
import { formatQar } from '../../src/lib/format';
import { detectDeviceType } from 'dxp-ui';
import { store } from '../../src/stores/store';
import { SinglePage, exampleParameters } from './_harness';
import type { Values } from './_harness';
import { SLOW, jpgFile, chooseFile, useLoaded } from './_fixtures';

interface Plan {
  productId: string;
  name: string;
  mrcQAR: number;
  starNumberEntitlementQar?: number;
}

/** The plan the Capability Library's own Number preview uses, so the entitlement is the one a journey on that plan shows. */
const PLAN_ID = 'PROD-107';
/** Real numbers of public/mock-data/numbers.json: a Star number worth more than the entitlement, and Star numbers blocked by Retail Sales (the demo role) and by another team. */
const STAR_NUMBER = '77000000';
const BLOCKED_BY_MY_GROUP = '55559999';
const BLOCKED_BY_OTHER_GROUP = '33009998';

const meta: Meta = {
  title: 'Application Examples/Number Selection',
  parameters: exampleParameters({
    purpose: 'Choosing the line\'s number as one scenario: the MsisdnPicker with its Star / Free / Blocked tabs and search, the Star-number entitlement of the selected plan, the Additional Discount (waive-off) of the upfront charge, and the supporting document that discount makes mandatory. Built from the production Number Selection capability over the real number inventory.',
    source: 'src/capabilities/NumberSelection (step.tsx, NumberSelection.tsx, WaiveOff.tsx) and src/engines/journeyDocuments.ts',
    variants: [
      'Default: the Star Numbers tab with the plan\'s entitlement note ("includes a Star Number worth up to ...").',
      'Search: the box matches by number or tier (Any), starts / ends with, contains, price range or repeating pattern; a number card selects on click and clears on a second click.',
      'Blocked Numbers: lists nothing until searched, and then only the numbers the signed-in role\'s own group blocked (Retail Sales for the demo role), with who blocked them and why.',
      'Additional Discount: for a Star number above the entitlement the agent enters a fixed QAR amount (not more than the amount to pay) and attaches the supporting document; the discount then needs approval and the Star Number Discount Approval document is required.',
    ],
    states: ['Nothing selected (Continue disabled)', 'Number selected (red border and tick; its amount to pay after the entitlement)', 'Waiver applied (the button reads "Additional Discount: QAR n")', 'No numbers match the search'],
    events: ['`onChange(msisdn?, priceQAR?)` - the step stores `msisdn` and `numberPriceQAR`; choosing a different number drops a waiver and its document.'],
    validation: ['The discount cannot exceed the amount to pay; zero means no discount and needs no document; anything above zero needs the supporting document before Apply Discount is enabled.'],
    devices: ['Web: the supporting document is taken with **Initiate Scan** (the desk scanner). Tablet: **Upload Document** only. Use the toolbar **Device** switch or `?device=tablet`; the `Tablet` story selects it for you.'],
    restrictions: ['The number inventory, the desk scanner and approval routing are the app\'s mock data layer; the numbers named in the stories are real records of numbers.json.'],
  }, 900, 'padded'),
};
export default meta;
type Story = StoryObj<typeof meta>;

const personaId = () => store.getState().persona.activePersonaId;

/** What the order will require because of the number: read from the engine with the values the step wrote, never typed here. */
function RequiredDocuments({ values }: { values: Values }) {
  const required = requiredDocumentsFor({ values, personaId: personaId(), journey: 'new-connection' });
  const attached = ((values.caf as { additionalDocuments?: AdditionalDocument[] } | undefined)?.additionalDocuments ?? []);
  return (
    <section aria-label="Documents this order requires" className="card pad-panel stack gap-2">
      <h3 className="title title-sm">Documents this order requires</h3>
      {required.length === 0 ? (
        <p className="caption-muted">None for the number chosen so far.</p>
      ) : (
        <ul className="stack gap-1">
          {required.map((r) => {
            const doc = attached.find((d) => d.requirementId === r.id);
            return (
              <li key={r.id} className="caption-secondary">
                {r.label}: {doc ? `attached (${doc.fileName})` : 'not attached yet'}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function NumberStep({ initial }: { initial?: Values }) {
  const plan = useLoaded(async () => (await listEntities<Plan>('products')).find((p) => p.productId === PLAN_ID));
  const step = useMemo(
    () =>
      numberSelectionStep({
        priceField: 'numberPriceQAR',
        refresh: true,
        waiveOff: true,
        plan: () => (plan ? { mrcQar: plan.mrcQAR, starEntitlementQar: starEntitlementQar(plan) } : undefined),
      }),
    [plan]
  );
  if (!plan) return <p className="muted-body">Loading the plan catalogue…</p>;
  return (
    <div className="stack gap-4">
      <p className="caption-secondary">
        Plan {plan.name} ({formatQar(plan.mrcQAR)} / month) - Star Number entitlement {formatQar(starEntitlementQar(plan))}; a Star number above it is paid for the difference.
      </p>
      <SinglePage step={step} initial={{ productId: PLAN_ID, ...initial }} extra={(values) => <RequiredDocuments values={values} />} />
    </div>
  );
}

const searchBox = (canvas: ReturnType<typeof within>) => canvas.findByRole('textbox', { name: 'Search numbers' }, SLOW);

export const Default: Story = {
  render: () => <NumberStep />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/includes a Star Number worth up to/, undefined, SLOW)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
    // Pick the first number on the list; choosing it enables Continue, choosing it again clears the choice.
    const cards = await waitFor(() => {
      const found = canvasElement.querySelectorAll<HTMLElement>('[role="button"][aria-pressed]');
      if (found.length === 0) throw new Error('no number cards yet');
      return found;
    }, SLOW);
    await userEvent.click(cards[0]);
    await expect(cards[0]).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled();
    await userEvent.click(cards[0]);
    await expect(cards[0]).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeDisabled();
  },
};

export const SearchStarNumbers: Story = {
  name: 'Search Star numbers',
  render: () => <NumberStep />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await searchBox(canvas), STAR_NUMBER);
    const card = await canvas.findByRole('button', { name: new RegExp(STAR_NUMBER) }, SLOW);
    await userEvent.click(card);
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    // The card states what the customer pays after the entitlement.
    await expect(within(card).getByText(/Amount to Pay/)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled();
  },
};

export const BlockedNumbers: Story = {
  render: () => <NumberStep />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('tab', { name: 'Blocked Numbers' }, SLOW));
    // Nothing is listed until the agent searches.
    await expect(await canvas.findByText(/Search by number, tier or price to find the numbers your group has blocked/)).toBeVisible();
    const search = await searchBox(canvas);
    await userEvent.type(search, BLOCKED_BY_MY_GROUP);
    const card = await canvas.findByRole('button', { name: `Blocked number ${BLOCKED_BY_MY_GROUP}` }, SLOW);
    await expect(within(card).getByText('Retail Sales')).toBeVisible();
    // A number another team blocked is never listed, and nothing says it exists.
    await userEvent.clear(search);
    await userEvent.type(search, BLOCKED_BY_OTHER_GROUP);
    await waitFor(() => expect(canvas.queryByRole('button', { name: `Blocked number ${BLOCKED_BY_OTHER_GROUP}` })).toBeNull(), SLOW);
  },
};

export const WaiveOffWithDocument: Story = {
  name: 'Additional Discount with the required document',
  render: () => <NumberStep />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await searchBox(canvas), STAR_NUMBER);
    await userEvent.click(await canvas.findByRole('button', { name: new RegExp(STAR_NUMBER) }, SLOW));
    await expect(canvas.getByText('None for the number chosen so far.')).toBeVisible();
    await userEvent.click(await canvas.findByRole('button', { name: 'Additional Discount' }));
    // The dialog is a portal: read it from the page.
    const dialog = await screen.findByRole('dialog');
    const dialogScope = within(dialog);
    await userEvent.type(dialogScope.getByRole('textbox', { name: /Discount Amount/ }), '1000');
    // The document is mandatory: Apply Discount stays disabled until it is attached.
    await expect(dialogScope.getByRole('button', { name: 'Apply Discount' })).toBeDisabled();
    if (detectDeviceType() === 'tablet') {
      await chooseFile(dialog, 'Choose the supporting document', jpgFile('star-approval.jpg'));
    } else {
      await userEvent.click(dialogScope.getByRole('button', { name: 'Initiate Scan' }));
    }
    await waitFor(() => expect(dialogScope.getByRole('button', { name: 'Apply Discount' })).toBeEnabled(), SLOW);
    await userEvent.click(dialogScope.getByRole('button', { name: 'Apply Discount' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expect(await canvas.findByRole('button', { name: /Additional Discount: / })).toBeVisible();
    // The order now carries the Star Number Discount Approval, attached from this dialog.
    await expect(await canvas.findByText(/Star Number Discount Approval: attached/)).toBeVisible();
  },
};

export const Tablet: Story = {
  tags: ['tablet'], globals: { device: 'tablet' },
  parameters: { viewport: { defaultViewport: 'tablet' } },
  render: () => <NumberStep />,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('textbox', { name: 'Search numbers' }, SLOW)).toBeVisible();
  },
};
