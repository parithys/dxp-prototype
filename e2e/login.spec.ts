import { test, expect } from '@playwright/test';

// The login page is not part of the signed-in sweep, so its pixels are pinned here: the announcement carousel (arrows, position dots), the show-password
// control and the links, light and dark. The announcement rotation is paused by the fixed clock and by pressing Pause.
for (const theme of ['light', 'dark'] as const) {
  test(`login page ${theme}`, async ({ page }, info) => {
    await page.clock.setFixedTime(new Date(2026, 10, 7, 14, 30));
    await page.addInitScript(([device, th]) => {
      sessionStorage.setItem('dxp-device', device);
      localStorage.setItem('vfq-theme-store', JSON.stringify({ state: { theme: th }, version: 0 }));
    }, [info.project.name === 'desktop' ? 'web' : 'tablet', theme]);
    await page.goto('/');
    await page.getByLabel('Staff ID').waitFor();
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.getByLabel('Password', { exact: true }).fill('secret');
    const pause = page.getByRole('button', { name: 'Pause' });
    if (await pause.count()) await pause.click();
    await page.waitForTimeout(600);
    await expect(page).toHaveScreenshot(`login-${info.project.name}-${theme}.png`);
  });
}
