import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CustomerActionsMenu } from '../../src/workspace/customer360/CustomerActionsMenu';
import { docsParameters } from '../_shared/docs';
import { listenNavigate } from './_withPath';

const meta = {
  title: 'Navigation/Customer Actions Menu',
  component: CustomerActionsMenu,
  parameters: {
    ...docsParameters({
      purpose: 'The "Actions" menu in the Customer 360 header: starts a new connection or opens a product-line action (journey) for the customer in view, carrying the customer into it.',
      source: 'src/workspace/customer360/CustomerActionsMenu.tsx',
      variants: ['Groups follow the signed-in role\'s navigation: Start a New Connection first, then each product line (Mobile, Fibre & Home) with the actions that apply to this customer\'s services.'],
      states: ['Closed / open; an action that applies but is not open yet is shown dimmed with its hint; services undefined (still loading) hides nothing.'],
      events: ['Picking an action runs a wired journey directly or navigates (here: logged as `storybook:navigate`); onSupport opens the customer\'s Tickets & Support tab.'],
      accessibility: ['The trigger has aria-haspopup="menu", aria-expanded and aria-controls; Escape closes the menu and returns focus to the trigger; an outside click closes it.'],
      restrictions: ['Renders nothing when the role has no groups or `customerId` is undefined.', 'Which groups appear depends on the signed-in persona (Retail Sales in Storybook).'],
    }),
  },
  argTypes: {
    customerId: { control: 'text', description: 'The customer the actions apply to; undefined renders nothing.' },
    customerName: { control: 'text', description: 'Shown to the journey it launches.' },
    services: { control: false, description: 'The customer\'s services; undefined until loaded.' },
    onSupport: { control: false },
  },
  args: { customerId: 'CUST-1001', customerName: 'Aisha Al-Thani', services: undefined, onSupport: fn() },
} satisfies Meta<typeof CustomerActionsMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: /Actions/ });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: /Actions/ });
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(within(canvasElement.ownerDocument.body).getAllByRole('menu').length).toBeGreaterThan(0);
  },
};

export const EscapeClosesAndRefocuses: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: /Actions/ });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveFocus();
  },
};

export const PickAction: Story = {
  name: 'Pick an action (navigation is logged)',
  play: async ({ canvasElement }) => {
    const seen: string[] = [];
    const stop = listenNavigate((d) => seen.push(d.kind));
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Actions/ }));
    const items = within(canvasElement.ownerDocument.body).queryAllByRole('menuitem');
    if (items[0]) await userEvent.click(items[0]);
    stop();
  },
};

export const NoCustomer: Story = {
  name: 'No customer (renders nothing)',
  args: { customerId: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: /Actions/ })).toBeNull();
  },
};
