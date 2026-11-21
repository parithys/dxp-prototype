import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NumberSelection } from '../../src/capabilities';
import { Number as NumberDemo } from '../../src/capabilities/previewDemos';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Patterns/Number Selection',
  component: NumberSelection,
  parameters: {
    ...docsParameters({
      purpose: 'Choose a number: search, Free and Star bands, price filter, plan entitlement note, reserve and clear. (Capability registry: "Number Selection".)',
      source: 'src/capabilities/NumberSelection/NumberSelection.tsx',
      variants: ['`variant="journey"` (default): inside a guided journey.', '`variant="portal"`: the standalone Number Management Portal (its own tab order and Reserved tab).', '`plan` - the selected plan\'s MRC / Star entitlement for the "Star Number up to QAR x is free" note.', '`profile` - Mobile Prepaid\'s content-by-role rules.', '`waiverQar` - the additional discount applied to the chosen number\'s upfront charge.'],
      states: ['Nothing chosen', 'Number chosen (card selected; the upfront charge shown on Star numbers)', 'Chosen again to clear', 'Empty search result'],
      events: ['`onChange(msisdn?, priceQAR?)` - a number with its catalogue price, or no arguments when the choice is cleared.', '`onUnreserve(msisdn)` (portal).'],
      usage: ['Mounted through `numberSelectionStep`; the Default story is that step exactly as the New Postpaid journey renders it (Refresh, entitlement note, Waive Off, Continue).'],
    }),
  },
  argTypes: { variant: { control: 'select', options: ['journey', 'portal'], description: 'Journey or Number Management Portal layout.' }, value: { control: false }, onChange: { control: false }, plan: { control: false }, profile: { control: false }, waiverQar: { control: 'number', description: 'Additional discount (QAR) on the chosen number\'s upfront charge.' } },
} satisfies Meta<typeof NumberSelection>;
export default meta;
type Story = StoryObj<typeof NumberSelection>;

/** The Number step as the New Postpaid journey renders it. */
export const Default: Story = { render: () => <NumberDemo /> };

function Plain({ variant, plan }: { variant: 'journey' | 'portal'; plan?: { mrcQar: number; starEntitlementQar: number } }) {
  const [n, setN] = useState<string | undefined>();
  return (
    <div className="stack gap-3">
      <NumberSelection value={n} onChange={(m) => setN(m)} variant={variant} plan={plan} />
      <p className="caption-muted">Chosen: {n ?? 'none'}</p>
    </div>
  );
}
export const JourneyVariant: Story = { render: () => <Plain variant="journey" /> };
export const WithPlanEntitlement: Story = { render: () => <Plain variant="journey" plan={{ mrcQar: 200, starEntitlementQar: 500 }} /> };
export const PortalVariant: Story = { render: () => <Plain variant="portal" /> };
