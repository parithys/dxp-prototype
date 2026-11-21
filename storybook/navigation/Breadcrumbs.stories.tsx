import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Breadcrumbs } from '../../src/navigation/Breadcrumbs';
import { Link, NavLink } from '../../src/lib/routerLinks';
import { docsParameters } from '../_shared/docs';
import { Column, Specimen } from '../_shared/layout';
import { listenNavigate, withPath } from './_withPath';

const meta = {
  title: 'Navigation/Breadcrumbs',
  component: Breadcrumbs,
  parameters: {
    layout: 'fullscreen',
    ...docsParameters({
      purpose:
        'The breadcrumb bar mounted above every routed page: a global Back button, then a trail derived from the current route (nav manifest destination, journey place, module / screen, or Customer 360), with the Universal Search button at the right.',
      source: 'src/navigation/Breadcrumbs.tsx (+ src/lib/routerLinks.tsx for Link / NavLink)',
      variants: [
        'Nav destination: Dashboard > Parent > Item (e.g. /mobile/plans-numbers).',
        'Customer 360: Dashboard > Customers > customer name (or "Business 360" for an ENT-ACC- record).',
        'Module screen: Dashboard > Module > Screen name, from routes.json.',
        'Journey page: Dashboard > line > category > journey title, following the menu the journey was opened from.',
        'Dashboard (`/`): the component renders nothing.',
      ],
      states: ['Link crumbs (quiet link style) vs the current page (plain, medium weight, no link).', 'Back button (history back) and Universal Search button (shown only to roles allowed Customer Search).'],
      events: ['Back calls the router\'s navigate(-1); crumb links navigate through the app router. In Storybook both are dispatched as `storybook:navigate` window events (Actions panel) and not performed.'],
      usage: ['The trail is derived, never authored per screen. These stories set the route with the preview URL\'s `path` query (the mocked `usePathname`).'],
      accessibility: ['A <nav aria-label="Breadcrumb">; Back has aria-label "Go back"; separators are decorative icons; Universal Search has aria-label and a tooltip with its shortcut.', 'The current page is plain text rather than a link; it does not carry aria-current in production (noted as a gap).'],
      devices: ['The bar sits inside the page column on Web and Tablet; the sidebar offset comes from the shell, so stories show it on its own.'],
      restrictions: ['Crumb text depends on the signed-in persona\'s routes and mock data; the Storybook decorator signs in as Retail Sales (ROLE-01).', 'The journey-place trail needs router location state (`navJourney`), which Storybook cannot set; those pages fall back to the module trail.'],
    }),
  },
} satisfies Meta<typeof Breadcrumbs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {
  name: 'Dashboard (renders nothing)',
  decorators: [withPath('/')],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  },
};

export const NavDestination: Story = {
  name: 'Nav destination (two levels)',
  decorators: [withPath('/mobile/plans-numbers')],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const nav = c.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(within(nav).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    await expect(within(nav).getByText('Plans & Numbers')).toBeInTheDocument();
  },
};

export const TopLevelDestination: Story = {
  decorators: [withPath('/customer-search')],
};

export const Customer360: Story = {
  name: 'Customer 360',
  decorators: [withPath('/customer/CUST-1001')],
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Breadcrumb' });
    await expect(within(nav).getByRole('link', { name: 'Customers' })).toHaveAttribute('href', '/customer-search');
  },
};

export const Business360: Story = {
  decorators: [withPath('/customer/ENT-ACC-1001')],
};

export const BackAndLinks: Story = {
  name: 'Back and crumb links (navigation is logged, not performed)',
  decorators: [withPath('/mobile/plans-numbers')],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const seen: { kind: string; url?: string; delta?: number }[] = [];
    const stop = listenNavigate((d) => seen.push(d));
    await userEvent.click(c.getByRole('button', { name: 'Go back' }));
    await userEvent.click(c.getByRole('link', { name: 'Dashboard' }));
    stop();
    // Back is history.go(-1) (lib/routerHooks.ts).
    await expect(seen.some((s) => s.kind === 'go' && s.delta === -1)).toBe(true);
    await expect(seen.some((s) => s.kind === 'push' && s.url === '/')).toBe(true);
  },
};

export const KeyboardOrder: Story = {
  name: 'Keyboard focus order',
  decorators: [withPath('/mobile/plans-numbers')],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.tab();
    await expect(c.getByRole('button', { name: 'Go back' })).toHaveFocus();
    await userEvent.tab();
    await expect(c.getByRole('link', { name: 'Dashboard' })).toHaveFocus();
  },
};

export const Tablet: Story = {
  decorators: [withPath('/mobile/plans-numbers')],
  parameters: { viewport: { defaultViewport: 'tablet' } },
};

export const Mobile: Story = {
  decorators: [withPath('/mobile/plans-numbers')],
  parameters: { viewport: { defaultViewport: 'mobile' } },
};

export const LinkAndNavLink: Story = {
  name: 'Link and NavLink',
  decorators: [withPath('/mobile/plans-numbers')],
  render: () => (
    <Column>
      <Specimen label="Link: a real anchor; a plain click navigates through the app router, a modified click opens normally">
        <Link to="/customer-search" className="link">Customer Search</Link>
      </Specimen>
      <Specimen label="NavLink: className receives isActive (path equals `to` or sits under it; `end` requires an exact match). The current path is /mobile/plans-numbers.">
        <div className="cluster gap-4">
          <NavLink to="/mobile" className={({ isActive }) => (isActive ? 'link font-semibold' : 'link')}>Mobile (active: ancestor)</NavLink>
          <NavLink to="/mobile" end className={({ isActive }) => (isActive ? 'link font-semibold' : 'link')}>Mobile, end (inactive)</NavLink>
          <NavLink to="/mobile/plans-numbers" className={({ isActive }) => (isActive ? 'link font-semibold' : 'link')}>Plans &amp; Numbers (active)</NavLink>
        </div>
      </Specimen>
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('link', { name: 'Customer Search' })).toHaveAttribute('href', '/customer-search');
    await expect(c.getByRole('link', { name: /Mobile, end/ })).not.toHaveClass('font-semibold');
    await expect(c.getByRole('link', { name: /Plans & Numbers/ })).toHaveClass('font-semibold');
  },
};
