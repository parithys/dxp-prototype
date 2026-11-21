import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent, within } from 'storybook/test';
import { EligibilityChecksLink, EligibilityChecksList } from '../../src/components/domain/EligibilityRows';
import { buildEligibilityRows } from '../../src/components/domain/eligibilityRowsModel';
import type { EligibilityResult } from '../../src/components/domain/eligibilityTypes';
import { evaluateEligibilityChecks, hasHardStop } from '../../src/engines/eligibilityEngine';
import type { EligibilityCheck, EligibilityContext } from '../../src/engines/eligibilityEngine';
import { docsParameters } from '../_shared/docs';
import { Column, Specimen } from '../_shared/layout';

// Every list below is produced by the real engine (`evaluateEligibilityChecks`) from a context built the way the journey builds it, then turned into rows by the
// real `buildEligibilityRows`. The customers and documents are small literals shaped like customers.json / identity-documents.json records.
const AS_OF = new Date('2026-11-15T09:00:00+03:00');

const BASE: EligibilityContext = {
  customer: { customerId: 'CUST-1001', idType: 'QID', nationality: 'Indian', dob: '1990-04-12', blacklisted: false },
  doc: { documentType: 'QID', documentNumber: '29050612345', expiryDate: '2030-05-01', docStatus: 'Valid' },
  deals: [],
  outstandingQar: 0,
  lineCapReached: false,
  activeLinesDetail: '1/2 postpaid mobile lines used (expat cap)',
};
const run = (over: Partial<EligibilityContext> = {}): EligibilityCheck[] => evaluateEligibilityChecks({ ...BASE, ...over }, AS_OF);
const rowsOf = (checks: EligibilityCheck[], hrn = false, nationality = 'Indian', journey: 'postpaid' | 'prepaid' = 'postpaid', existing = false) => buildEligibilityRows(checks, hrn, nationality, journey, existing);

const ALL_PASS = run();
const EXPIRED_ID = run({ doc: { ...BASE.doc, expiryDate: '2026-03-01' } });
const SECURITY_BLOCK = run({ customer: { ...BASE.customer, blacklisted: true, blacklistReasons: [{ category: 'security', reason: 'Corporate security blacklist' }] } });
const UNDER_18 = run({ customer: { ...BASE.customer, dob: '2012-02-01' } });
const COLLECTIONS_BLOCK = run({ customer: { ...BASE.customer, blacklisted: true, blacklistReasons: [{ category: 'collections', reason: 'Unpaid bills' }] }, outstandingQar: 640 });
const GCC_ID = run({ customer: { ...BASE.customer, idType: 'GCC ID', nationality: 'Kuwaiti' }, doc: { documentType: 'GCC ID', documentNumber: 'GCC-884421', expiryDate: '2029-01-01' } });
const PASSPORT_APPROVAL = run({
  customer: { ...BASE.customer, idType: 'Passport' },
  doc: { documentType: 'Passport', documentNumber: 'P1234567', expiryDate: '2030-05-01', visa: { visaNumber: 'V-1', visaType: 'Residence', expiryDate: '2028-01-01' } },
});
const LINE_CAP_APPROVAL = run({ lineCapReached: true, activeLinesDetail: 'Expat limit of 2 active postpaid lines reached (2 active).' });
const UNDER_18_EXCEPTION = run({ customer: { ...BASE.customer, dob: '2012-02-01' }, under18Exception: 'chosen' });

const meta = {
  title: 'Business Components/Eligibility Rows',
  component: EligibilityChecksList,
  parameters: {
    ...docsParameters({
      purpose: 'The eligibility results as alert cards: each check is one card with a border all round in the outcome\'s colour (no strip on one side), a large icon on a solid rounded-square tile, the check\'s title and the RESULT (not a static description) beneath. The same card wherever results are listed: on the step, in the "View eligibility checks" drawer, the outcome preview and the HRN advance. `EligibilityChecksLink` is the footer-left link that opens every check in a drawer, with a legend of what the outcomes mean.',
      source: 'src/components/domain/EligibilityRows.tsx (+ eligibilityRowsModel.ts: `buildEligibilityRows`, `OUTCOME_LEGEND`; eligibilityTypes.ts; engine: src/engines/eligibilityEngine.ts)',
      variants: [
        'Pass (tick): the check is satisfied.',
        'Hard stop (cross): the journey cannot continue at this counter - security blacklist, expired ID, under 18, no valid visa, an existing deal, the expat 5-line maximum.',
        'Soft stop (warning triangle): this product is unavailable but a fallback exists - an outstanding collections balance (postpaid), a GCC ID on postpaid - the agent can switch to prepaid.',
        'Approval routing (clock): not a failure - the order goes ahead and is held for approval (ID type needing Credit Control approval, the postpaid line limit, an under-18 exception).',
        'Advisory (info): the HRN advance-payment row, a property of the customer rather than an outcome; the "Non-HRN new account" row is a pass and only for NEW accounts. Prepaid journeys carry no HRN row.',
      ],
      states: ['Each card is `role="alert"` with the outcome also carried by an icon shape (tick / cross / triangle / clock / info) so colour is never the only signal (WCAG 1.4.1).'],
      events: ['`EligibilityChecksLink` opens a drawer titled "Eligibility Checks" (`label` overrides link text and title); it renders nothing when `eligibility` is undefined.'],
      usage: ['Build rows with `buildEligibilityRows(checks, requiresHrnAdvance, nationality, journeyType, isExistingCustomer)`; Active Lines uses the cap message as its title and any following line as detail.', 'A clean run renders nothing inline on the step; the link is the way back to what ran.'],
      accessibility: ['Cards are list items in a list labelled "Eligibility results"; each is announced as an alert. The drawer is the app\'s Radix Dialog (focus trap, Escape, focus returns to the link). The outcome legend is a bulleted list.'],
      restrictions: ['Every card is `role="alert"`, so a list of many cards (the drawer shows them all, including passes) announces each one as an alert when it opens.'],
    }),
  },
  argTypes: { rows: { control: 'object', description: 'The rows to show (EligibilityRow[]), from `buildEligibilityRows`.' } },
  args: { rows: rowsOf(ALL_PASS, false, 'Indian') },
  decorators: [(Story) => <div style={{ maxWidth: 640 }}><Story /></div>],
} satisfies Meta<typeof EligibilityChecksList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AllPass: Story = {
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list', { name: 'Eligibility results' });
    await expect(within(list).getAllByRole('alert').length).toBeGreaterThan(3);
    await expect(canvasElement.querySelector('.eligibility-alert-hard-stop')).toBeNull();
  },
};

export const HardStopSecurityBlacklist: Story = {
  args: { rows: rowsOf(SECURITY_BLOCK) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.eligibility-alert-hard-stop')).not.toBeNull();
    await expect(hasHardStop(SECURITY_BLOCK)).toBe(true);
  },
};

export const HardStopExpiredId: Story = { args: { rows: rowsOf(EXPIRED_ID) } };

export const HardStopUnder18: Story = { args: { rows: rowsOf(UNDER_18) } };

export const SoftStopCollections: Story = {
  args: { rows: rowsOf(COLLECTIONS_BLOCK) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.eligibility-alert-soft-stop')).not.toBeNull();
  },
};

export const SoftStopGccIdOnPostpaid: Story = { args: { rows: rowsOf(GCC_ID, false, 'Kuwaiti') } };

export const ApprovalRoutingPassport: Story = {
  args: { rows: rowsOf(PASSPORT_APPROVAL) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.eligibility-alert-approval-routing')).not.toBeNull();
  },
};

export const ApprovalRoutingLineLimit: Story = { args: { rows: rowsOf(LINE_CAP_APPROVAL) } };

export const ApprovalRoutingUnder18Exception: Story = { args: { rows: rowsOf(UNDER_18_EXCEPTION) } };

export const HrnAdvancePaymentRow: Story = {
  args: { rows: rowsOf(run({ customer: { ...BASE.customer, nationality: 'Pakistani' } }), true, 'Pakistani') },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.eligibility-alert-advisory')).not.toBeNull();
    await expect(within(canvasElement).getByText('Upfront Payment Required (HRN)')).toBeInTheDocument();
  },
};

export const NonHrnNewAccountRow: Story = { args: { rows: rowsOf(ALL_PASS, false, 'Indian').filter((r) => r.id === 'hrn') } };

export const PrepaidHasNoHrnRow: Story = {
  args: { rows: rowsOf(run({ journeyType: 'prepaid', activeLinesDetail: '1/5 prepaid mobile lines used' }), true, 'Pakistani', 'prepaid') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText('Upfront Payment Required (HRN)')).toBeNull();
  },
};

export const EveryOutcome: Story = {
  render: () => (
    <Column>
      <Specimen label="Pass">
        <EligibilityChecksList rows={rowsOf(ALL_PASS).filter((r) => r.id === 'age')} />
      </Specimen>
      <Specimen label="Hard stop">
        <EligibilityChecksList rows={rowsOf(SECURITY_BLOCK).filter((r) => r.tone === 'hard-stop')} />
      </Specimen>
      <Specimen label="Soft stop">
        <EligibilityChecksList rows={rowsOf(COLLECTIONS_BLOCK).filter((r) => r.tone === 'soft-stop')} />
      </Specimen>
      <Specimen label="Approval routing">
        <EligibilityChecksList rows={rowsOf(PASSPORT_APPROVAL).filter((r) => r.tone === 'approval-routing')} />
      </Specimen>
      <Specimen label="Advisory (HRN)">
        <EligibilityChecksList rows={rowsOf(ALL_PASS, true, 'Pakistani').filter((r) => r.tone === 'advisory')} />
      </Specimen>
    </Column>
  ),
};

const RESULT: EligibilityResult = {
  pass: true,
  hardStop: false,
  softStop: false,
  checks: COLLECTIONS_BLOCK,
  blacklisted: true,
  lineCapExceeded: false,
  requiresHrnAdvance: true,
  defaultCreditLimitQar: 50,
  nationality: 'Pakistani',
  customerId: 'CUST-1001',
  idNumber: '29050612345',
};

export const ViewEligibilityChecksDrawer: Story = {
  render: () => <EligibilityChecksLink eligibility={{ ...RESULT, pass: false, softStop: true }} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'View eligibility checks' }));
    const dialog = await screen.findByRole('dialog');
    await expect(within(dialog).getByText('What These Outcomes Mean')).toBeInTheDocument();
    await expect(within(dialog).getAllByRole('alert').length).toBeGreaterThan(3);
  },
};

export const LinkWithCustomLabel: Story = {
  render: () => <EligibilityChecksLink eligibility={RESULT} label="Eligibility details" />,
};

export const LinkWithoutResultRendersNothing: Story = {
  render: () => <EligibilityChecksLink eligibility={undefined} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull();
  },
};
