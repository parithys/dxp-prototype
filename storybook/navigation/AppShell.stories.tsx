import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Sidebar } from '../../src/navigation/Sidebar';
import { PersonaSwitcher } from '../../src/navigation/PersonaSwitcher';
import { NavCollapseButton, NavLogoToggle } from '../../src/navigation/NavLogoToggle';
import { UniversalSearchButton } from '../../src/navigation/UniversalSearchButton';
import { Shell } from '../../src/App';
import { store } from '../../src/stores/store';
import { sidebarActions } from '../../src/stores/sidebarSlice';
import { docsParameters } from '../_shared/docs';
import { Column, Specimen } from '../_shared/layout';
import { withPath } from './_withPath';

const meta = {
  title: 'Navigation/App Shell',
  component: Shell,
  parameters: {
    layout: 'fullscreen',
    // The Shell mounts its own ToastContainer: the preview does not add a second one for this story.
    ownToastContainer: true,
    ...docsParameters({
      purpose:
        'The signed-in frame around every page: a skip link, the sidebar, the top bar (PersonaSwitcher: notifications, help, profile menu with theme and role switch), the breadcrumb bar, the routed page and toasts. The pieces are also shown on their own.',
      source: 'src/App.tsx (Shell), src/navigation/Sidebar.tsx, PersonaSwitcher.tsx, NavLogoToggle.tsx, UniversalSearchButton.tsx',
      variants: ['Sidebar: pinned (docked beside the page on Web) or unpinned (revealed on hover); an off-canvas drawer below md; expanded and collapsed groups; menu search.', 'NavLogoToggle (collapsed navigation: the logo is the expand control) and NavCollapseButton (expanded navigation header).'],
      states: ['Active destination (from the path), expanded / collapsed groups, pinned / unpinned, profile and notification menus open, Dev Mode switch (roles with Administration only).'],
      events: ['Navigation clicks go through the app router; in Storybook they are dispatched as `storybook:navigate` window events and not performed. The active item follows the `?path=` of the preview URL.'],
      usage: ['What the sidebar shows is filtered per role by the navigation engine; the Storybook decorator signs in as Retail Sales (ROLE-01).'],
      accessibility: [
        'Skip link is the first tab stop ("Skip to main content"), visible only while focused, and moves focus to <main id>.',
        'Sidebar is a nav labelled "Main navigation"; group rows are buttons with aria-expanded; the logo link is labelled "Vodafone - home"; "Search menu" filters the menu.',
        'Profile chip: aria-haspopup="menu" with aria-expanded; notification bell announces the unread count; a hidden status region announces route changes.',
      ],
      devices: ['Web docks a pinned sidebar beside the page; Tablet keeps a floating overlay so the page keeps full width (the Device toolbar switch, or ?device=tablet, selects the experience). Below md the sidebar is an off-canvas drawer opened by the top bar\'s "Open navigation" button.'],
      restrictions: ['Shell also mounts DevInfoOverlay and its own ToastContainer; the preview leaves its own out for this story (parameters.ownToastContainer).', 'A real route change cannot happen in Storybook, so the routed page is a placeholder.'],
    }),
  },
  args: { children: <div className="p-8"><h1 className="title title-xl">Page content</h1><p className="body-text">The routed page renders here.</p></div> },
  decorators: [withPath('/mobile/plans-numbers')],
} satisfies Meta<typeof Shell>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Full shell',
};

export const SkipLink: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.tab();
    const skip = c.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvasElement.ownerDocument.getElementById('main-content') ?? canvasElement.ownerDocument.querySelector('main')).toHaveFocus());
  },
};

export const SidebarOnly: Story = {
  name: 'Sidebar',
  render: () => <Sidebar />,
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement.ownerDocument.body).getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toBeInTheDocument();
    await expect(within(nav).getByRole('link', { name: /Vodafone - home/ })).toBeInTheDocument();
  },
};

export const SidebarGroupToggle: Story = {
  name: 'Sidebar: expand a group (keyboard)',
  render: () => <Sidebar />,
  decorators: [withPath('/')],
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement.ownerDocument.body).getByRole('navigation', { name: 'Main navigation' });
    // The rail is only operable when it is on screen (not `inert`). Its pinned state is persisted and shared by every story, so set it through the app's
    // own actions instead of relying on what an earlier story left: pinned (docked beside the page); below the md breakpoint the drawer is opened instead.
    if (!store.getState().sidebar.pinned) store.dispatch(sidebarActions.togglePinned());
    if (nav.hasAttribute('inert') && !store.getState().sidebar.mobileOpen) store.dispatch(sidebarActions.toggleMobileOpen());
    await waitFor(() => expect(nav).not.toHaveAttribute('inert'));
    // Re-read the row each time: the rail re-renders when the role's navigation resolves, so an earlier reference can be stale.
    const findGroup = () => within(nav).getAllByRole('button').find((b: HTMLElement) => b.hasAttribute('aria-expanded') && /Mobile/.test(b.textContent ?? ''));
    await waitFor(() => expect(findGroup()).toBeDefined());
    const expanded = () => findGroup()?.getAttribute('aria-expanded');
    // Whatever state the group starts in, the keyboard flips it, and flips it back.
    const start = expanded();
    const other = start === 'true' ? 'false' : 'true';
    const group = findGroup() as HTMLElement;
    group.focus();
    await expect(group).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(expanded()).toBe(other));
    (findGroup() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(expanded()).toBe(start));
  },
};

export const SidebarMenuSearch: Story = {
  name: 'Sidebar: menu search',
  render: () => <Sidebar />,
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement.ownerDocument.body).getByRole('navigation', { name: 'Main navigation' });
    const box = within(nav).getByLabelText('Search menu');
    await userEvent.type(box, 'Plans');
    await expect(box).toHaveValue('Plans');
  },
};

export const SidebarTablet: Story = {
  name: 'Sidebar (Tablet)',
  render: () => <Sidebar />,
  parameters: { viewport: { defaultViewport: 'tablet' } },
};

export const TopBar: Story = {
  name: 'Top bar (PersonaSwitcher)',
  render: () => <PersonaSwitcher />,
};

export const ProfileMenu: Story = {
  name: 'Top bar: profile menu',
  render: () => <PersonaSwitcher />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const trigger = c.getByRole('button', { name: 'User profile menu' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
  },
};

export const Notifications: Story = {
  name: 'Top bar: notifications menu',
  render: () => <PersonaSwitcher />,
  play: async ({ canvasElement }) => {
    const bell = within(canvasElement).getByRole('button', { name: /^Notifications/ });
    await userEvent.click(bell);
    await expect(bell).toHaveAttribute('aria-expanded', 'true');
  },
};

export const MobileTopBar: Story = {
  name: 'Top bar (Mobile: opens the navigation drawer)',
  render: () => <PersonaSwitcher />,
  parameters: { viewport: { defaultViewport: 'mobile' } },
};

export const NavButtons: Story = {
  name: 'Navigation toggles and Universal Search',
  render: () => (
    <Column>
      <Specimen label="NavLogoToggle, navigation collapsed (the logo expands it)"><NavLogoToggle expanded={false} onToggle={() => undefined} /></Specimen>
      <Specimen label="NavLogoToggle, navigation expanded (the logo collapses it)"><NavLogoToggle expanded onToggle={() => undefined} /></Specimen>
      <Specimen label="NavCollapseButton (expanded navigation header)"><NavCollapseButton onToggle={() => undefined} /></Specimen>
      <Specimen label="UniversalSearchButton (only for roles allowed Customer Search)"><UniversalSearchButton /></Specimen>
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute('aria-expanded', 'false');
    await expect(c.getAllByRole('button', { name: 'Collapse navigation' })).toHaveLength(2);
  },
};
