import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { Button } from 'dxp-ui';
import { PrepaidPackDetailsDrawer } from '../../src/components/patterns/PrepaidPackDetailsDrawer';
import { docsParameters } from '../_shared/docs';
import { PREPAID_PREMIUM_150, PREPAID_RED_50, PREPAID_STANDARD_SIM } from './_fixtures';

type DrawerProps = Parameters<typeof PrepaidPackDetailsDrawer>[0];

function Demo({ pack, selectedProductId, onSelectProduct }: Pick<DrawerProps, 'pack' | 'selectedProductId' | 'onSelectProduct'>) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(selectedProductId);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open pack details
      </Button>
      <PrepaidPackDetailsDrawer
        pack={open ? pack : null}
        onClose={() => setOpen(false)}
        selectedProductId={selected}
        onSelectProduct={(id) => {
          onSelectProduct(id);
          setSelected(id);
        }}
      />
    </>
  );
}

const meta = {
  title: 'Business Components/Prepaid Pack Details Drawer',
  component: PrepaidPackDetailsDrawer,
  render: (args) => <Demo pack={args.pack} selectedProductId={args.selectedProductId} onSelectProduct={args.onSelectProduct} />,
  parameters: {
    ...docsParameters({
      purpose: 'A prepaid pack\'s details in the side drawer: starter pack charge, data, voice, validity, product code and the segments the pack is available to. Everything shown is catalogue data.',
      source: 'src/components/patterns/PrepaidPackDetailsDrawer.tsx',
      variants: ['A pack with `eligibleSegments` lists them; any other reads "Every customer segment".', 'No data bundle / no validity show "-".'],
      states: ['Closed (`pack` null); Open; Pack already selected (footer button reads "Selected" and is disabled).'],
      events: ['`onSelectProduct(productId)` then the drawer closes; `onClose` from Close, the title-bar close control or Escape.'],
      accessibility: ['The app\'s Radix Dialog drawer: focus trap, Escape, focus returns to the opener; the facts are a `dl`.'],
    }),
  },
  argTypes: {
    pack: { control: 'object', description: 'The pack to show; null closes the drawer.' },
    selectedProductId: { control: 'text', description: 'The selected pack\'s productId.' },
    onClose: { control: false },
    onSelectProduct: { control: false },
  },
  args: { pack: PREPAID_RED_50, selectedProductId: undefined, onSelectProduct: fn(), onClose: fn() },
} satisfies Meta<typeof PrepaidPackDetailsDrawer>;
export default meta;
type Story = StoryObj<typeof meta>;

const open = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open pack details' }));
  return screen.findByRole('dialog');
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await expect(within(dialog).getByText('Prepaid Red 50', { exact: false })).toBeInTheDocument();
    await expect(within(dialog).getByText('Every customer segment')).toBeInTheDocument();
  },
};

export const SegmentRestrictedPack: Story = { args: { pack: PREPAID_PREMIUM_150 }, play: async ({ canvasElement }) => void (await open(canvasElement)) };

export const PayAsYouGoPack: Story = { args: { pack: PREPAID_STANDARD_SIM }, play: async ({ canvasElement }) => void (await open(canvasElement)) };

export const AlreadySelected: Story = {
  args: { selectedProductId: PREPAID_RED_50.productId },
  play: async ({ canvasElement }) => {
    const dialog = await open(canvasElement);
    await expect(within(dialog).getByRole('button', { name: 'Selected' })).toBeDisabled();
  },
};

export const SelectPackClosesDrawer: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await open(canvasElement);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Select pack' }));
    await expect(args.onSelectProduct).toHaveBeenCalledWith('PROD-302');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  },
};
