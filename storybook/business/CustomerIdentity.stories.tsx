import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { IdentityDetailsCard, JourneyCustomerBadge, identityFacts } from '../../src/capabilities';
import { customerContextActions } from '../../src/stores/customerContextSlice';
import { store } from '../../src/stores/store';
import { Input } from 'dxp-ui';
import { docsParameters } from '../_shared/docs';
import { Column, Specimen } from '../_shared/layout';

const FIELDS = { firstName: 'Tariq', middleName: 'Mansoor', lastName: 'Al-Hashimi', dob: '14/06/1986', idExpiryDate: '31/12/2030', nationality: 'Omani', gender: 'Male', idTypeLabel: 'Qatar ID (QID)', idNumber: '29287654321' };

const meta = {
  title: 'Business Components/Customer Identity Details Card',
  component: IdentityDetailsCard,
  decorators: [(Story) => <div style={{ maxWidth: 880 }}><Story /></div>],
  parameters: {
    ...docsParameters({
      purpose: 'Registry-sourced identity facts of the customer (Customer Verification result), shown as read-only content - a label above its value beside an icon tile - rather than disabled form controls: nothing can be typed, so nothing looks like it can. `identityFacts()` builds the one list of facts every journey shows.',
      source: 'src/capabilities/CustomerIdentification/IdentityDetailsCard.tsx (+ identityFacts.ts)',
      variants: ['Facts in rows of three; `endsRow` ends a row early.', '`status`: a success note under the heading and a light success wash - "validated with MOI".', '`lastRowExtra`: an editable control placed in the last row\'s first column (or on its own row when the last row is full).', '`identityFacts(fields, { idType })`: the looked-up ID number leads; `showDocumentType: false` drops the Document Type fact.'],
      states: ['Plain', 'Validated (status)', 'A fact with no value shows "-"'],
      accessibility: ['A `section` named "Identity Details" with an `h3`; facts are a description list (`dl`: label `dt`, value `dd`); icon tiles are decorative.'],
      devices: ['An `@container`: the grid goes to three columns by the card\'s own width (so it adapts in a narrow pane or on a tablet).'],
    }),
  },
  argTypes: {
    facts: { control: 'object', description: 'The facts to show: { label, value, icon, endsRow? }.' },
    status: { control: 'text', description: 'A success note under the heading (validated by MOI).' },
    lastRowExtra: { control: false },
  },
  args: { facts: identityFacts(FIELDS, { showDocumentType: true }) },
} satisfies Meta<typeof IdentityDetailsCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole('region', { name: 'Identity Details' });
    await expect(within(card).getByText('Tariq')).toBeVisible();
    await expect(within(card).getByText('Date of Birth')).toBeVisible();
  },
};

export const ValidatedWithMoi: Story = { args: { status: 'Validated with MOI' } };

export const LeadingWithTheLookedUpId: Story = { args: { facts: identityFacts(FIELDS, { idType: 'QID', showDocumentType: false }) } };

export const MissingValues: Story = {
  args: { facts: identityFacts({ firstName: 'Tariq', lastName: 'Al-Hashimi', nationality: 'Omani' }) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText('-').length).toBeGreaterThan(0);
  },
};

export const WithAnEditableControl: Story = {
  args: { lastRowExtra: <Input label="Occupation" placeholder="Enter the occupation" /> },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('textbox', { name: /Occupation/ })).toBeVisible();
  },
};

/** JourneyCustomerBadge: reads the journey's customer from the app store; shown on the dark title band it lives in. */
function BadgeHost({ journey, route }: { journey: boolean; route?: { name?: string; customerId?: string } }) {
  useEffect(() => {
    store.dispatch(customerContextActions.endJourney());
    if (journey) {
      store.dispatch(customerContextActions.beginJourney({ wizardId: 'sb-badge', path: '/mobile/start-connection', journey: 'new-postpaid', customerName: 'Tariq Mansoor Al-Hashimi', idNumber: '29287654321', idType: 'QID', customerId: 'CUST-1001', startedAt: '2026-11-15T09:00:00.000Z' }));
    }
    return () => void store.dispatch(customerContextActions.endJourney());
  }, [journey]);
  return (
    <div className="title-band-pad title-band">
      <JourneyCustomerBadge wizardId="sb-badge" routeCustomer={route} />
    </div>
  );
}

export const JourneyBadge: StoryObj<typeof JourneyCustomerBadge> = {
  parameters: {
    docs: {
      description: {
        story: '`JourneyCustomerBadge` (src/capabilities/JourneyCustomerLock/JourneyCustomerBadge.tsx): the customer a journey is for - name, ID with its type, customer ID - beside the journey title, so the agent confirms the context at a glance. It reads the journey\'s bound customer from the store (`customerContext.journey`, matched by `wizardId`); until identified, an existing-customer journey shows `routeCustomer` (name and customer ID) instead; otherwise nothing. The tooltip says "The customer is fixed for this journey". It is light text made for the dark title band, which is why it is drawn on one here.',
      },
    },
  },
  render: () => (
    <Column>
      <Specimen label="Journey bound to the customer (name - ID type and number - customer ID)">
        <BadgeHost journey />
      </Specimen>
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const badge = await within(canvasElement).findByTitle('The customer is fixed for this journey');
    await expect(badge).toHaveTextContent('Tariq Mansoor Al-Hashimi - QID 29287654321 - CUST-1001');
  },
};

export const JourneyBadgeFromRoute: StoryObj<typeof JourneyCustomerBadge> = {
  render: () => (
    <Specimen label="Existing-customer journey, not yet identified: the route's customer">
      <BadgeHost journey={false} route={{ name: 'Tariq Mansoor Al-Hashimi', customerId: 'CUST-1001' }} />
    </Specimen>
  ),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByTitle('The customer is fixed for this journey')).toHaveTextContent('Tariq Mansoor Al-Hashimi - CUST-1001');
  },
};

export const JourneyBadgeEmpty: StoryObj<typeof JourneyCustomerBadge> = {
  render: () => (
    <Specimen label="No journey customer and no route customer: renders nothing">
      <BadgeHost journey={false} />
    </Specimen>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByTitle('The customer is fixed for this journey')).toBeNull();
  },
};
