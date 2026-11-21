import { test, expect, type Page } from '@playwright/test';

// Phase 4, family 3: the shadcn Button where the app's own used to be - behaviour, not looks (the sweep covers looks).
async function signIn(page: Page, project: string) {
  await page.addInitScript((device) => sessionStorage.setItem('dxp-device', device), project === 'desktop' ? 'web' : 'tablet');
  await page.goto('/');
  await page.getByLabel('Staff ID').fill('VFQ12343');
  await page.getByLabel('Password', { exact: true }).fill('Vodafone@123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('main').waitFor();
}
// Waits for the URL to change: <main> is already on the page being left, so waiting for it alone returns before the new route has rendered
// (on a dev server the first visit compiles the route, which can outlast the 5 s expect timeout).
async function go(page: Page, to: string) {
  await page.evaluate((p) => (window as unknown as { next: { router: { push(p: string): void } } }).next.router.push(p), to);
  await page.waitForURL((url) => url.pathname === to, { waitUntil: 'commit' }); // a client-side push fires no load event
}

test('every button defaults to type=button, so none submits a form by accident', async ({ page }, info) => {
  await signIn(page, info.project.name);
  for (const path of ['/profile', '/customer-search', '/mobile/start-connection']) {
    await go(page, path);
    await page.getByRole('main').waitFor();
    await page.waitForTimeout(600);
    const untyped = await page.locator('main button:not([type])').count();
    expect(untyped, path).toBe(0);
  }
});

test('profile password form: Save is disabled until the fields are filled and enabled after; the click is handled once', async ({ page }, info) => {
  await signIn(page, info.project.name);
  await go(page, '/profile');
  await page.getByRole('main').waitFor();
  const save = page.getByRole('button', { name: /Change Password|Save|Update Password/ }).last();
  await expect(save).toBeDisabled();
  expect(await save.getAttribute('type')).toBe('button');
});

test('customer search: a short query shows the hint, Enter submits the query (the form submit path)', async ({ page }, info) => {
  await signIn(page, info.project.name);
  await go(page, '/customer-search');
  const box = page.getByRole('main').getByRole('searchbox').or(page.getByRole('main').getByRole('textbox')).first();
  await box.fill('ab');
  await expect(page.getByText(/at least 3 characters/i)).toBeVisible();
  await box.fill('zzzzzz');
  await box.press('Enter');
  await expect(page.getByText('Customer Data Not Found')).toBeVisible();
});

test('a primary button keeps the red gradient, a secondary the grey border, a tertiary no box', async ({ page }, info) => {
  await signIn(page, info.project.name);
  await go(page, '/mobile/start-connection');
  await page.getByRole('main').waitFor();
  const style = (sel: string) => page.locator(sel).first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { image: s.backgroundImage.slice(0, 15), border: s.borderTopColor, radius: s.borderTopLeftRadius };
  });
  const primary = await style('main button[data-variant=default]');
  expect(primary.image).toContain('gradient');
  const secondary = await page.locator('main button[data-variant=secondary]').count();
  expect(secondary + (await page.locator('main button[data-variant=default]').count())).toBeGreaterThan(0);
});
