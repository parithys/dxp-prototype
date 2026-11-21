// Storybook for the DXP application: the catalogue of its patterns, capabilities, business components and screens (the design system has its own).
//
// It is a separate tool chain on purpose - `npm run storybook` / `npm run build-storybook` - and does not take part in the app's `tsc -b`, `oxlint`,
// `npm test` or `next build`. It consumes the application's own source: the same components (src/components, src/capabilities), the same styles
// (src/index.css, which imports the design system's CSS from the installed dxp-ui package), the same assets and config (public/ is served at the root,
// as in the app). Nothing is copied into Storybook. The design system itself (the package's components, tokens and icons) has its own Storybook in
// dxp-ui-library; `dxp-ui` resolves from node_modules here, like any dependency.
import type { StorybookConfig } from '@storybook/react-vite';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

const src = fileURLToPath(new URL('../src', import.meta.url));
const storybookTsconfig = fileURLToPath(new URL('../tsconfig.storybook.json', import.meta.url));
const nextNavigationMock = fileURLToPath(new URL('./mocks/nextNavigation.ts', import.meta.url));

const config: StorybookConfig = {
  framework: { name: '@storybook/react-vite', options: {} },
  stories: ['../storybook/**/*.mdx', '../storybook/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  // public/ at the root: the app reads /config/*.json, /mock-data/*.json and /brand/* from there.
  staticDirs: ['../public'],
  typescript: {
    // Props tables come from the components' own TypeScript types and JSDoc.
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      // Absolute: the docgen plugin resolves a relative path from the working directory, not from .storybook/.
      tsconfigPath: storybookTsconfig,
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  core: { disableTelemetry: true },
  async viteFinal(viteConfig) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(viteConfig, {
      // Tailwind v4 through its Vite plugin, as the app's own Vite config does (postcss.config.mjs is for Next only). The React plugin is NOT added here:
      // @storybook/react-vite already includes it, and a second copy declares React's refresh runtime twice ("Identifier 'RefreshRuntime' has already been declared"), which blanks the preview.
      plugins: [tailwindcss()],
      css: { postcss: { plugins: [] } },
      resolve: {
        alias: [
          // `@/...` is `src/...`, as in tsconfig.
          { find: /^@\//, replacement: `${src}/` },
          // The app's router layer (src/lib/routerHooks.ts) sits on Next's App Router, which does not exist in Storybook: this stands in for
          // `next/navigation` only (see .storybook/mocks/nextNavigation.ts). No component is replaced.
          { find: /^next\/navigation$/, replacement: nextNavigationMock },
        ],
        dedupe: ['react', 'react-dom'],
      },
      // The app reads its build flags from `import.meta.env` (lib/buildEnv.ts): demo-only UI is shown, as in the default app build.
      define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'), 'process.env.NEXT_PUBLIC_BASE_PATH': JSON.stringify('/'), 'process.env.NEXT_PUBLIC_SHOW_DEMO': JSON.stringify('true') },
      optimizeDeps: { include: ['dxp-ui', 'react', 'react-dom', 'react-redux', '@reduxjs/toolkit', 'radix-ui', 'lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge', 'qrcode.react'] },
    });
  },
};

export default config;
