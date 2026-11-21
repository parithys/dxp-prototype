import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { FamilyPackageNotice } from '../../src/components/patterns/FamilyPackageNotice';
import { familyStartCheck } from '../../src/engines/familyPackage';
import type { FamilyStartCheck } from '../../src/engines/familyPackage';
import { docsParameters } from '../_shared/docs';
import { Column, Specimen } from '../_shared/layout';
import { AHLI_MEMBER, ESSENTIAL } from './_fixtures';

/** The engine's own answers (familyStartCheck), so the notice shows what the plan page would. */
const FAMILY_PLAN = { productId: AHLI_MEMBER.productId, planClass: AHLI_MEMBER.planClass };
const NOT_FAMILY: FamilyStartCheck = familyStartCheck({ plan: { productId: ESSENTIAL.productId, planClass: ESSENTIAL.planClass }, eligibilityCleared: true, customerLines: [] });
const STARTS_PACKAGE: FamilyStartCheck = familyStartCheck({ plan: FAMILY_PLAN, eligibilityCleared: true, customerLines: [] });
const NOT_ELIGIBLE: FamilyStartCheck = familyStartCheck({ plan: FAMILY_PLAN, eligibilityCleared: false, customerLines: [] });
const HAS_PACKAGE: FamilyStartCheck = familyStartCheck({ plan: FAMILY_PLAN, eligibilityCleared: true, customerLines: [{ lineId: 'LINE-F1', packageId: 'PKG-1', role: 'Primary', sequence: 1, planId: AHLI_MEMBER.productId, orderId: 'ORD-F1' }] });
/** An additional connection with its line decided: joins the existing package as Primary Line 2, included in the package. */
const JOINS_PACKAGE: FamilyStartCheck = { applies: true, ok: true, lineLabel: 'Primary Line 2', planId: AHLI_MEMBER.productId, additional: { packageId: 'PKG-1', role: 'Primary', sequence: 2, type: 'PRIMARY_LINE_2', charge: 'Free' } };
/** An additional connection still to be given a plan: the picker is the prompt, so the notice stays silent. */
const PLAN_PENDING: FamilyStartCheck = { applies: true, ok: true, lineLabel: 'Additional connection', planId: undefined, additional: { packageId: 'PKG-1', pending: true, eligiblePlans: [] } };
/** The ID is not the Family Owner's. */
const NOT_OWNER: FamilyStartCheck = { applies: true, ok: false, kind: 'owner', reason: "This ID is not the Family Owner's. Connections added after the two Primary Lines are registered to the current Family Owner, so their ID must be validated." };

const meta = {
  title: 'Business Components/Family Package Notice',
  component: FamilyPackageNotice,
  parameters: {
    ...docsParameters({
      purpose: 'What a selected Family Plan (or a chosen connection type) means for the order, stated on the plan page: the order joins the customer\'s Family Package as the line named, or it cannot (the reason is the engine\'s own). Many cases are deliberately silent.',
      source: 'src/components/patterns/FamilyPackageNotice.tsx (the check comes from `familyStartCheck` / `familyAdditionalCheck` in src/engines/familyPackage.ts)',
      variants: ['Joins the package (neutral `role="status"` notice): "This connection is Primary Line 2 of the customer\'s Family Package, on <plan>."', 'Cannot continue (danger `role="alert"` notice): not eligible, or the ID is not the Family Owner\'s.'],
      states: [
        'Nothing is rendered when: the plan is not a Family Plan; a new customer starts a package (the activation simply goes on); the customer already has a package (the plan page\'s own dialog says so); an additional line still has to be given a plan.',
      ],
      usage: ['The sibling `FamilyPlanApplier` and `FamilyBillingApplier` in the same file render nothing: they write the package\'s plan and billing account into the order.'],
      accessibility: ['Status and alert roles announce the change; the message is text, with no colour-only meaning.'],
    }),
  },
  argTypes: {
    check: { control: 'object', description: 'The engine\'s FamilyStartCheck.' },
    planName: { control: 'text', description: 'The plan the line takes (falls back to "the package plan").' },
  },
  args: { check: JOINS_PACKAGE, planName: AHLI_MEMBER.name },
} satisfies Meta<typeof FamilyPackageNotice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const JoinsPackage: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Primary Line 2');
  },
};

export const NotEligible: Story = {
  args: { check: NOT_ELIGIBLE },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('has not cleared eligibility');
  },
};

export const NotTheFamilyOwner: Story = { args: { check: NOT_OWNER } };

export const SilentCases: Story = {
  render: () => (
    <Column>
      <Specimen label="Not a Family Plan - renders nothing">
        <FamilyPackageNotice check={NOT_FAMILY} planName={ESSENTIAL.name} />
      </Specimen>
      <Specimen label="Starts a new package - renders nothing">
        <FamilyPackageNotice check={STARTS_PACKAGE} planName={AHLI_MEMBER.name} />
      </Specimen>
      <Specimen label="Customer already has a package - renders nothing (the plan page's dialog says it)">
        <FamilyPackageNotice check={HAS_PACKAGE} planName={AHLI_MEMBER.name} />
      </Specimen>
      <Specimen label="Additional connection, plan still to choose - renders nothing">
        <FamilyPackageNotice check={PLAN_PENDING} planName={undefined} />
      </Specimen>
    </Column>
  ),
};
