import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pilot: the credit-limit approval card on Enterprise Account Creation (shadcn Card + Label + Checkbox).
const PATH = '/enterprise-iot-b2b/account-creation-screen';

async function open(page: Page, project: string, theme: 'light' | 'dark') {
  await page.addInitScript(([device, th]) => {
    sessionStorage.setItem('dxp-device', device);
    localStorage.setItem('vfq-theme-store', JSON.stringify({ state: { theme: th }, version: 0 }));
  }, [project === 'desktop' ? 'web' : 'tablet', theme]);
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.getByLabel('Staff ID').fill('VFQ12343');
  await page.getByLabel('Password', { exact: true }).fill('Vodafone@123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/');
  // A full page load signs the user out (the session lives in memory), so move within the app instead.
  await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor();
  await page.evaluate((to) => (window as unknown as { next: { router: { push(p: string): void } } }).next.router.push(to), PATH);
  await page.getByRole('heading', { name: 'Enterprise Account Creation' }).waitFor();
  await page.getByLabel('Credit Limit (QAR) - no default for enterprise').fill('5000');
  return errors;
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(theme, () => {
    test('label, checkbox, validation message and no route change', async ({ page }, info) => {
      const errors = await open(page, info.project.name, theme);
      const box = page.getByRole('checkbox', { name: 'Business Finance has approved this credit limit' });
      const msg = page.getByText(/Business Finance approval is required/);
      await expect(box).not.toBeChecked();
      await expect(msg).toBeVisible();
      await page.getByText('Business Finance has approved this credit limit').click(); // the label reaches the control
      await expect(box).toBeChecked();
      await expect(box).toBeFocused();
      await expect(msg).toHaveCount(0);
      await box.press('Space');
      await expect(box).not.toBeChecked();
      await box.press('Enter');
      await expect(box).not.toBeChecked(); // Enter does not toggle a checkbox
      await expect(page).toHaveURL(new RegExp(`${PATH}$`));
      expect(errors).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(overflow).toBe(false);
    });

    test('axe: default and checked', async ({ page }, info) => {
      await open(page, info.project.name, theme);
      const scan = () => new AxeBuilder({ page }).include('main').analyze();
      expect((await scan()).violations).toEqual([]);
      await page.getByRole('checkbox').click();
      expect((await scan()).violations).toEqual([]);
    });

    test('card geometry screenshot', async ({ page }, info) => {
      await open(page, info.project.name, theme);
      // The card that holds the approval checkbox, found by the Card's stable data-slot marker (not by a CSS class).
      const card = page.locator('[data-slot=card]', { has: page.getByRole('checkbox') });
      await expect(card).toHaveScreenshot(`approval-card-${info.project.name}-${theme}.png`, { animations: 'disabled' });
    });
  });
}
