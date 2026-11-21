import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { Button } from 'dxp-ui';
import { RechargeCountryDrawer } from '../../src/components/patterns/RechargeCountryDrawer';
import type { PricingRecharge } from '../../src/components/patterns/prepaidCartModel';
import { docsParameters } from '../_shared/docs';
import { RECHARGE_COMBO_40, RECHARGE_COMBO_50 } from './_fixtures';

function Demo({ recharge }: { recharge: PricingRecharge | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {recharge?.countryInfo?.button ?? 'Open countries'}
      </Button>
      <RechargeCountryDrawer recharge={open ? recharge : null} onClose={() => setOpen(false)} />
    </>
  );
}

const meta = {
  title: 'Business Components/Recharge Country Drawer',
  component: RechargeCountryDrawer,
  render: (args) => <Demo recharge={args.recharge} />,
  parameters: {
    ...docsParameters({
      purpose: 'A recharge\'s international reach in the side drawer: the minutes it gives and the countries they cover, and for a "View Country Bonus" recharge the bonus minutes per country. Reference read while choosing a recharge; everything shown is catalogue data (`countryInfo`).',
      source: 'src/components/patterns/RechargeCountryDrawer.tsx',
      variants: ['"View eligible countries": the minutes headline and the country chips.', '"View Country Bonus": the same, plus a Country / Bonus Minutes table (`DataTable`, plain, unpaged).'],
      states: ['Closed (`recharge` null, or a recharge with no `countryInfo`); Open.'],
      events: ['`onClose` - Close button, title-bar control or Escape.'],
      accessibility: ['Radix Dialog drawer (focus trap, Escape, focus returns to the opener). Each section has an `aria-label` ("Eligible Countries", "Country Bonus"); the countries are a list of chips.'],
    }),
  },
  argTypes: {
    recharge: { control: 'object', description: 'The recharge whose `countryInfo` is shown; null closes the drawer.' },
    onClose: { control: false },
  },
  args: { recharge: RECHARGE_COMBO_40 },
} satisfies Meta<typeof RechargeCountryDrawer>;
export default meta;
type Story = StoryObj<typeof RechargeCountryDrawer>;

export const EligibleCountries: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'View eligible countries' }));
    const dialog = await screen.findByRole('dialog');
    await expect(within(dialog).getByRole('region', { name: 'Eligible Countries' })).toBeInTheDocument();
    await expect(within(dialog).queryByRole('region', { name: 'Country Bonus' })).toBeNull();
  },
};

export const CountryBonus: Story = {
  args: { recharge: RECHARGE_COMBO_50 },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'View Country Bonus' }));
    const dialog = await screen.findByRole('dialog');
    await expect(within(dialog).getByRole('region', { name: 'Country Bonus' })).toBeInTheDocument();
    await expect(within(dialog).getByText('45 mins')).toBeInTheDocument();
  },
};

export const CloseWithEscape: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'View eligible countries' }));
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  },
};
