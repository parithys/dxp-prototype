import { defineConfig } from '@playwright/test';

// Browser tests (pilot, sweep, overlays, tabs, accessibility ...). Run with PORT=<dev server port> npx playwright test.
// The app picks its tablet scale from touch points / `?device=tablet`, so each project sets hasTouch and the spec forces `dxp-device`.
const PORT = Number(process.env.PORT ?? 5173);
// SNAP_DIR=<name> keeps snapshots in e2e/<name>/ instead of beside each spec: a second set taken from another build (e.g. the pre-migration commit) to compare with.
export default defineConfig({
  testDir: 'e2e',
  ...(process.env.SNAP_DIR ? { snapshotPathTemplate: `{testDir}/${process.env.SNAP_DIR}/{testFilePath}/{arg}{-projectName}{-snapshotSuffix}{ext}` } : {}),
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/report' }]],
  outputDir: 'e2e/results',
  expect: { toHaveScreenshot: { threshold: 0.1, animations: 'disabled', caret: 'hide' } },
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: `PORT=${PORT} npm run dev`, url: `http://localhost:${PORT}`, reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
});
