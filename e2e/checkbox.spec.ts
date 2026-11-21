import { test, expect, type Page } from '@playwright/test';

// Phase 4, family 2: the Radix checkbox on screens other than the pilot - a table selection column and the component library specimens.
async function signIn(page: Page, project: string, staffId = 'VFQ12343') {
  await page.addInitScript((device) => sessionStorage.setItem('dxp-device', device), project === 'desktop' ? 'web' : 'tablet');
  await page.goto('/');
  await page.getByLabel('Staff ID').fill(staffId);
  await page.getByLabel('Password', { exact: true }).fill('Vodafone@123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('main').waitFor();
}
const go = (page: Page, to: string) => page.evaluate((p) => (window as unknown as { next: { router: { push(p: string): void } } }).next.router.push(p), to);

test('ticket table: a row checkbox selects without opening the row, Space toggles, the bulk bar follows', async ({ page }, info) => {
  await signIn(page, info.project.name);
  await go(page, '/support');
  const box = page.getByRole('checkbox', { name: /^Select ticket / }).first();
  await box.waitFor();
  const url = page.url();
  await expect(box).toHaveAttribute('aria-checked', 'false');
  await box.click();
  await expect(box).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Bulk Close' })).toBeVisible();
  expect(page.url()).toBe(url); // the click did not reach the row
  await box.press('Space');
  await expect(box).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('button', { name: 'Bulk Close' })).toHaveCount(0);
});

test('component library: unchecked, checked and disabled specimens', async ({ page }, info) => {
  await signIn(page, info.project.name, 'VFQ12364'); // System Administrator: the only role family that reaches Administration
  await go(page, '/administration');
  await page.getByText('UI Components Library').first().click();
  await page.getByRole('complementary', { name: 'Component groups' }).getByRole('button', { name: 'Form Controls' }).click();
  await page.getByText('Checkbox', { exact: true }).first().scrollIntoViewIfNeeded();
  const boxes = page.getByRole('checkbox');
  const named = (label: string) => page.locator('label', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).getByRole('checkbox');
  await expect(named('Unchecked')).toHaveAttribute('aria-checked', 'false');
  await expect(named('Checked')).toHaveAttribute('aria-checked', 'true');
  await expect(named('Disabled')).toBeDisabled();
  await named('Unchecked').click();
  await expect(named('Unchecked')).toHaveAttribute('aria-checked', 'true');
  expect(await boxes.count()).toBeGreaterThan(2);
});
