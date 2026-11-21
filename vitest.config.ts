// `npm run test-storybook` (and the "Run tests" button in the Storybook UI, which looks for a project named `storybook:<config dir>` in the root vitest.config.ts): runs every story's play function (and its accessibility checks) in a real browser through Vitest. Separate from the
// application's own `npm test` (node:test), which does not need Storybook installed.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

const dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // The same plugins and aliases as .storybook/main.ts (viteFinal), so a story builds the same in the browser test run.
  plugins: [react(), tailwindcss()],
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${dirname}src/` },
      { find: /^next\/navigation$/, replacement: `${dirname}.storybook/mocks/nextNavigation.ts` },
    ],
    dedupe: ['react', 'react-dom'],
  },
  define: { 'process.env.NEXT_PUBLIC_BASE_PATH': JSON.stringify('/'), 'process.env.NEXT_PUBLIC_SHOW_DEMO': JSON.stringify('true') },
  test: {
    // Two projects over the same stories. The app detects the device once per page (lib/deviceType.ts: touch points => Tablet), so the Tablet
    // experience needs a touch browser: stories tagged `tablet` (their story-level `globals.device` is 'tablet') run only in the touch project,
    // all others in the pointer (Web) project.
    projects: [
      {
        extends: true,
        plugins: [storybookTest({ configDir: `${dirname}.storybook`, tags: { include: ['test'], exclude: ['tablet'], skip: [] } })],
        test: {
          // Desktop-sized: the app's rail is a docked sidebar from the `md` breakpoint up; below it the drawer is off-screen and inert (Vitest's default frame is 414 x 896).
          browser: { enabled: true, headless: true, viewport: { width: 1280, height: 900 }, provider: playwright({}), instances: [{ browser: 'chromium' }] },
          setupFiles: ['.storybook/vitest.setup.ts'],
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: `${dirname}.storybook`, tags: { include: ['tablet'], exclude: [], skip: [] } })],
        test: {
          name: 'storybook-tablet',
          browser: { enabled: true, headless: true, viewport: { width: 768, height: 1024 }, provider: playwright({ contextOptions: { hasTouch: true } }), instances: [{ browser: 'chromium' }] },
          setupFiles: ['.storybook/vitest.setup.ts'],
        },
      },
    ],
  },
});
