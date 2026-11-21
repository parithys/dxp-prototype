import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'Vodafone Qatar DXP - Component Catalogue',
    brandUrl: '/',
    colorPrimary: '#e60000',
    colorSecondary: '#e60000',
    fontBase: '"Figtree", system-ui, sans-serif',
  }),
  // The catalogue's top-level groups stay in the order a reader meets them: foundations first, application examples last.
  sidebar: { showRoots: true },
});
