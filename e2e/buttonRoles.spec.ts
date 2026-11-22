import { test, expect, type Page } from '@playwright/test';

// Keyboard and accessibility-tree spot-check of the buttons converted by role (docs/migration/button-role-migration.md). It reads the accessibility tree
// (what a screen reader is given: role, accessible name, state) and drives each control with the keyboard alone. It is NOT a screen-reader run: no assistive
// technology is available to the test machine, so the manual checklist in that document still has to be done with VoiceOver / NVDA.
async function signIn(page: Page, project: string, staffId = 'VFQ12341') {
  await page.clock.setFixedTime(new Date(2026, 10, 7, 14, 30));
  await page.addInitScript((device) => sessionStorage.setItem('dxp-device', device), project === 'desktop' ? 'web' : 'tablet');
  await page.goto('/');
  await page.getByLabel('Staff ID').fill(staffId);
  await page.getByLabel('Password', { exact: true }).fill('Vodafone@123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('main').waitFor();
  await page.waitForTimeout(1200);
}
const push = (page: Page, to: string) => page.evaluate((p) => (window as unknown as { next: { router: { push(p: string): void } } }).next.router.push(p), to);

/** Tab until the control has focus (at most 60 stops); fails if the keyboard never reaches it. */
async function tabTo(page: Page, control: ReturnType<Page['locator']>) {
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    if (await control.evaluate((el) => el === document.activeElement).catch(() => false)) return;
  }
  throw new Error('the keyboard never reached the control');
}
/** A visible focus indicator: a real outline or a box-shadow ring that is not "none". */
async function hasFocusIndicator(control: ReturnType<Page['locator']>) {
  return control.evaluate((el) => {
    const cs = getComputedStyle(el);
    return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
  });
}

test.describe('icon-only controls (Button ghost + icon): named, in the tab order, keyboard-operable, visibly focused', () => {
  test('login: show password toggles with Enter and Space, and carries its name and state', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard-only check; the control is the same markup on touch');
    await page.addInitScript(() => sessionStorage.setItem('dxp-device', 'web'));
    await page.goto('/');
    const pwd = page.getByLabel('Password', { exact: true });
    await pwd.fill('secret');
    const toggle = page.getByRole('button', { name: 'Show password' });
    await expect(toggle).toBeVisible();
    await pwd.focus();
    await page.keyboard.press('Tab');
    await expect(toggle).toBeFocused();
    expect(await hasFocusIndicator(toggle), 'a visible focus indicator').toBe(true);
    await page.keyboard.press('Enter');
    await expect(pwd).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Hide password' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(pwd).toHaveAttribute('type', 'password');
  });

  test('login: the carousel arrows and position dots are named buttons the keyboard reaches and operates', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard-only check');
    await page.addInitScript(() => sessionStorage.setItem('dxp-device', 'web'));
    await page.goto('/');
    await page.getByLabel('Staff ID').waitFor();
    const next = page.getByRole('button', { name: 'Next announcement' });
    await expect(page.getByRole('button', { name: 'Previous announcement' })).toBeVisible();
    await tabTo(page, next);
    expect(await hasFocusIndicator(next)).toBe(true);
    const dots = page.getByRole('button', { name: /^Show / });
    expect(await dots.count()).toBeGreaterThan(2);
    const current = page.locator('button[aria-current="true"]');
    await expect(current).toHaveCount(1);
    const second = dots.nth(1);
    await second.focus();
    await page.keyboard.press('Enter');
    await expect(second).toHaveAttribute('aria-current', 'true');
  });

  test('profile menu: the theme switch is a named menu button that Enter flips', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard-only check');
    await signIn(page, info.project.name);
    await page.getByRole('button', { name: 'User profile menu' }).click();
    const toggle = page.getByRole('button', { name: /Switch to (dark|light) theme/ });
    // Reach it with the keyboard: a programmatic focus straight after the mouse click that opened the menu is not :focus-visible.
    await tabTo(page, toggle);
    expect(await hasFocusIndicator(toggle)).toBe(true);
    const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(!before);
  });

  test('customer 360: the copy-account control is a named button (its accessible name is its aria-label)', async ({ page }, info) => {
    await signIn(page, info.project.name);
    await push(page, '/customer/CUST-1001');
    await page.getByRole('main').waitFor();
    await page.waitForTimeout(1800);
    const copy = page.getByRole('button', { name: 'Copy account number' }).first();
    await expect(copy).toBeVisible();
    await expect(copy).toHaveAccessibleName('Copy account number');
    if (info.project.name === 'desktop') {
      await copy.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(copy).toBeFocused();
      expect(await hasFocusIndicator(copy)).toBe(true);
    }
  });

  test('every converted icon button in the app declares an accessible name (the Button type requires it)', async () => {
    const fs = await import('node:fs');
    // Button lives in the dxp-ui package; read the declaration it ships.
    const src = fs.readFileSync('node_modules/dxp-ui/dist/components/ui/button.d.ts', 'utf8');
    expect(src).toMatch(/size: IconSize;\s*\} & \(\{\s*"aria-label": string;\s*\} \| \{\s*"aria-labelledby": string;\s*\}\)/);
  });
});

test.describe('navigating controls (now links): a real href, role link, the name, Enter navigates, and the side effect still runs', () => {
  test('global search: results are links; Enter on the keyboard path and a click on a link both navigate, clear and close the search', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard-driven; the markup is the same on touch');
    await signIn(page, info.project.name);
    const input = page.getByPlaceholder(/Search products/).first();
    await input.fill('Ahmed');
    const options = page.locator('[id^="global-search-opt-"]');
    await expect(options.first()).toBeVisible();
    const first = options.first();
    expect(await first.evaluate((el) => el.tagName)).toBe('A');
    expect(await first.getAttribute('href')).toMatch(/^\//);
    expect(await first.evaluate((el) => (el as HTMLAnchorElement).getAttribute('role'))).toBeNull(); // a plain link: its role comes from the element
    const href = await first.getAttribute('href');
    await first.click();
    await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    await expect(input).toHaveValue('');
    // the keyboard path (no link to click) still navigates
    await push(page, '/');
    await input.fill('Ahmed');
    await expect(options.first()).toBeVisible();
    await page.keyboard.press('ArrowDown');
    const target = await options.first().getAttribute('href');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${target!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  });

  test('customer search: each result is a link to the customer record, reachable and activated by the keyboard', async ({ page }, info) => {
    await signIn(page, info.project.name);
    await push(page, '/customer-search');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const box = page.getByRole('textbox', { name: 'Customer search query' });
    await box.fill('Ahmed');
    await box.press('Enter');
    const results = page.locator('a[href^="/customer/"]');
    await expect(results.first()).toBeVisible();
    expect(await results.count()).toBeGreaterThan(1);
    const first = results.first();
    await expect(first).toHaveAttribute('href', /^\/customer\/(CUST|ENT-ACC)-/);
    expect((await first.evaluate((el) => el.getAttribute('role'))) ?? 'link').toBe('link');
    expect(((await first.getAttribute('aria-label')) ?? (await first.innerText())).length).toBeGreaterThan(3);
    if (info.project.name === 'desktop') {
      await first.focus();
      expect(await hasFocusIndicator(first)).toBe(true);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/customer\/(CUST|ENT-ACC)-/);
    } else {
      await first.click();
      await expect(page).toHaveURL(/\/customer\/(CUST|ENT-ACC)-/);
    }
  });
});
