import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { Button } from 'dxp-ui';
import { PlanDetailsDrawer } from '../../src/components/patterns/PlanDetailsDrawer';
import type { PostpaidPlan } from '../../src/components/patterns/postpaidPlanModel';
import { docsParameters } from '../_shared/docs';
import { ESSENTIAL, PLATINUM, PRE_BUNDLED } from './_fixtures';

type DrawerProps = Parameters<typeof PlanDetailsDrawer>[0];

/** The drawer as a plan step opens it from a card's "View details". */
function Demo({ plan, ...props }: Omit<DrawerProps, 'detailPlan' | 'onClose'> & { plan: PostpaidPlan; startOpen?: boolean }) {
  const [open, setOpen] = useState(props.startOpen ?? false);
  const [selected, setSelected] = useState<string | undefined>(props.selectedProductId);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        View details for {plan.name}
      </Button>
      <PlanDetailsDrawer
        detailPlan={open ? plan : null}
        onClose={() => setOpen(false)}
        selectedProductId={selected}
        onSelectProduct={(id) => {
          props.onSelectProduct?.(id);
          setSelected(id);
        }}
        showPlanDetails={props.showPlanDetails}
      />
    </>
  );
}

const meta = {
  title: 'Business Components/Plan Details Drawer',
  component: PlanDetailsDrawer,
  render: (args) => <Demo plan={args.detailPlan ?? ESSENTIAL} selectedProductId={args.selectedProductId} onSelectProduct={args.onSelectProduct} showPlanDetails={args.showPlanDetails} />,
  parameters: {
    ...docsParameters({
      purpose: 'A postpaid plan\'s details on demand, in the same side drawer as a Recommended Offer (`OfferDetailsDrawer`): summary, the plan\'s free extra, a facts panel, and the plan\'s own Fair Usage Policy. Reference material read while choosing, so it slides in beside the list.',
      source: 'src/components/patterns/PlanDetailsDrawer.tsx',
      variants: ['`showPlanDetails`: lists the plan\'s own facts and its bill limit in the drawer (the Offers tab).', 'A plan with no `fup` shows just its facts; a plan with no `benefits` shows no highlight banner.'],
      states: ['Closed (`detailPlan` null); Open; Plan already selected (the footer action reads as selected).'],
      events: ['`onClose` - close control, Escape.', '`onSelectProduct(productId)` - the footer button selects the plan.'],
      accessibility: ['It is the app\'s one Radix Dialog drawer: focus is trapped, the page behind is hidden, Escape closes, focus returns to the opener; a click outside does NOT close a drawer.'],
      devices: ['tablet.css widens `.drawer-panel` to at least 50vw (up to 36rem on a portrait tablet) so its form-like content is not cramped; on Web it is half the viewport.'],
    }),
  },
  argTypes: {
    detailPlan: { control: 'object', description: 'The plan to show; null closes the drawer.' },
    selectedProductId: { control: 'text', description: 'The productId selected in the step.' },
    showPlanDetails: { control: 'boolean', description: 'List the plan\'s facts and bill limit.' },
    onClose: { control: false },
    onSelectProduct: { control: false },
  },
  args: { detailPlan: ESSENTIAL, showPlanDetails: true, onSelectProduct: fn(), onClose: fn() },
} satisfies Meta<typeof PlanDetailsDrawer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /View details for/ }));
    await expect(await screen.findByRole('dialog')).toBeInTheDocument();
  },
};

export const WithoutPlanFacts: Story = { args: { showPlanDetails: false } };

export const PlanWithoutPolicy: Story = { args: { detailPlan: PRE_BUNDLED } };

export const HighValuePlan: Story = { args: { detailPlan: PLATINUM } };

export const SelectFromDrawer: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /View details for/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Select this offer' }));
    await expect(args.onSelectProduct).toHaveBeenCalledWith('PROD-107');
  },
};

export const EscapeClosesAndReturnsFocus: Story = {
  play: async ({ canvasElement }) => {
    const opener = within(canvasElement).getByRole('button', { name: /View details for/ });
    await userEvent.click(opener);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expect(opener).toHaveFocus();
  },
};
