import { test, expect, type Page } from '@playwright/test';

// Phase 4 safety net: one pixel snapshot and one accessibility-tree snapshot per representative screen, per viewport and theme.
// Run `--update-snapshots` BEFORE a family's migration (on the tree as it stands) and plain `playwright test` AFTER it: any visible or
// semantic change on these screens fails. The aria snapshot is the semantic baseline (roles, names, states, headings); the pixel snapshot
// the visual one. Tall viewport so the scroll container (`main`) shows more of the screen.
const ROUTES: Array<[string, string]> = [
  ['dashboard', '/'],
  ['customer-search', '/customer-search'],
  ['customer-360', '/customer/CUST-1001'],
  ['orders', '/orders'],
  ['leads', '/leads'],
  ['sales', '/sales'],
  ['support', '/support'],
  ['tasks', '/tasks'],
  ['ticket-history', '/ticket-history'],
  ['profile', '/profile'],
  ['administration', '/administration'],
  ['bill-formatter', '/bill-formatter'],
  ['new-connections', '/new-connections'],
  ['mobile', '/mobile'],
  ['journey-start-connection', '/mobile/start-connection'],
  ['fibre-home', '/fibre-home'],
  ['operations', '/operations'],
  ['enterprise-account-creation', '/enterprise-iot-b2b/account-creation-screen'],
  ['ticket-approval-queue', '/trouble-ticketing-complaints/approval-queue'],
  ['ui-showcase', '/dev/ui-showcase'],
];

async function signIn(page: Page, project: string, theme: 'light' | 'dark', staffId = 'VFQ12343') {
  // The dashboard greets by time of day and shows today's date, so the baselines are taken at a fixed afternoon (timers keep running).
  await page.clock.setFixedTime(new Date(2026, 10, 7, 14, 30));
  await page.addInitScript(([device, th]) => {
    sessionStorage.setItem('dxp-device', device);
    localStorage.setItem('vfq-theme-store', JSON.stringify({ state: { theme: th }, version: 0 }));
  }, [project === 'desktop' ? 'web' : 'tablet', theme]);
  await page.goto('/');
  await page.getByLabel('Staff ID').fill(staffId);
  await page.getByLabel('Password', { exact: true }).fill('Vodafone@123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('main').waitFor();
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' }); // the dev-server badge animates
}

async function go(page: Page, path: string) {
  if (path !== '/') {
    await page.evaluate((to) => (window as unknown as { next: { router: { push(p: string): void } } }).next.router.push(to), path);
    await page.waitForURL((u) => u.pathname + u.search === path);
  }
  await page.getByRole('main').waitFor();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1800); // data hooks settle (mock API); the app has no single "ready" signal
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(theme, () => {
    test(`sweep ${theme}`, async ({ page }, info) => {
      test.setTimeout(180_000);
      const size = page.viewportSize()!;
      await page.setViewportSize({ width: size.width, height: info.project.name === 'desktop' ? 2200 : 2600 });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await signIn(page, info.project.name, theme);
      for (const [name, path] of ROUTES) {
        await go(page, path);
        const main = page.getByRole('main');
        // Support's ticket counts vary from run to run (mock data), so their digits are not part of the semantic baseline.
        const raw = await main.ariaSnapshot();
        const tree = name === 'support' ? raw.replace(/\d+/g, '#') : raw;
        expect.soft(tree, `${name} aria`).toMatchSnapshot(`${name}-${info.project.name}-${theme}.aria.txt`);
        await expect.soft(page, `${name} pixels`).toHaveScreenshot(`${name}-${info.project.name}-${theme}.png`, { fullPage: false, mask: name === 'support' ? [page.locator('main .pair-grid .card')] : [] });
      }
      expect(errors).toEqual([]);
    });
  });
}

// The UI Components Library (Administration, System Administrator): every shared component rendered with its variants and states, one group at a
// time - the widest single view of the primitives the families migrate. Its baseline starts with the checkbox family (labels, cards and checkboxes
// were verified there), so it guards the buttons, inputs and tabs families.
for (const theme of ['light', 'dark'] as const) {
  test(`library ${theme}`, async ({ page }, info) => {
    test.setTimeout(180_000);
    const size = page.viewportSize()!;
    await page.setViewportSize({ width: size.width, height: 2400 });
    await signIn(page, info.project.name, theme, 'VFQ12364');
    await go(page, '/administration');
    await page.getByText('UI Components Library').first().click();
    await page.getByRole('heading', { name: 'UI Components Library' }).waitFor();
    const groups = page.getByRole('complementary', { name: 'Component groups' }).getByRole('button');
    const count = await groups.count();
    expect(count).toBeGreaterThan(10);
    for (let i = 0; i < count; i++) {
      const name = ((await groups.nth(i).innerText()) || `group-${i}`).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await groups.nth(i).click();
      await page.waitForTimeout(500);
      const main = page.getByRole('main');
      expect.soft(await main.ariaSnapshot(), `library ${name} aria`).toMatchSnapshot(`ui-library-${name}-${info.project.name}-${theme}.aria.txt`);
      await expect.soft(page, `library ${name} pixels`).toHaveScreenshot(`ui-library-${name}-${info.project.name}-${theme}.png`);
    }
  });
}
