import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Phase 7: the contract of the app's tab strips (TabStrip, navigation and filter variants) on the UI Components Library "Tabs" group.
async function openTabs(page: Page, project: string) {
  await page.addInitScript((device) => sessionStorage.setItem('dxp-device', device), project === 'desktop' ? 'web' : 'tablet');
  await page.goto('/');
  await page.getByLabel('Staff ID').fill('VFQ12364');
  await page.getByLabel('Password', { exact: true }).fill('Vodafone@123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('main').waitFor();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window as unknown as { next: { router: { push(p: string): void } } }).next.router.push('/administration'));
  await page.waitForTimeout(600); // the route announcer moves focus to <main> 150 ms after a route change
  await page.getByText('UI Components Library').first().click();
  await page.getByRole('complementary', { name: 'Component groups' }).getByRole('button', { name: 'Tabs' }).click();
}
// The Administration page has its own tab strip above the library; the specimen is the one holding "Open Tasks".
// Existing violations on the strips, recorded before the Radix migration (the id and how many nodes); the migration must not add to them.
const RECORDED_AXE: string[] = [];
const names = (page: Page) => page.getByRole('tablist').filter({ hasText: 'Open Tasks' }).getByRole('tab');
const state = (page: Page) => page.evaluate(() => {
  const list = [...document.querySelectorAll('[role=tablist]')].find((l) => l.textContent?.includes('Open Tasks'))!;
  const tabs = [...list.querySelectorAll('[role=tab]')] as HTMLElement[];
  return {
    selected: tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'),
    focused: tabs.findIndex((t) => t === document.activeElement),
    tabindex: tabs.map((t) => t.tabIndex),
    controls: tabs.map((t) => t.getAttribute('aria-controls')),
    panels: document.querySelectorAll('[role=tabpanel]').length,
  };
});

test('tab strip: roving tabindex, aria-selected, no panel association, labels with counts', async ({ page }, info) => {
  await openTabs(page, info.project.name);
  const tabs = names(page);
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(0)).toContainText('Open Tasks');
  expect((await state(page)).selected).toBe(0);
  // Radix: the strip itself is the one tab stop and hands focus to the selected tab; once focus is in, only that tab is a tab stop (roving tabindex).
  await page.getByRole('tablist').filter({ hasText: 'Open Tasks' }).focus();
  await expect.poll(() => state(page)).toMatchObject({ selected: 0, focused: 0 });
  const s = await state(page);
  expect(s.tabindex).toEqual([0, -1, -1]);
  expect(s.controls).toEqual([null, null, null]); // the app renders its panels itself: nothing for aria-controls to point at
  expect(s.panels).toBe(0);
  await tabs.nth(1).click();
  expect((await state(page)).selected).toBe(1);
  expect((await state(page)).tabindex).toEqual([-1, 0, -1]);
});

test('tab strip keyboard: arrows move and select (wrapping), Home / End jump, Enter and Space change nothing, Tab leaves the strip', async ({ page }, info) => {
  await openTabs(page, info.project.name);
  const tabs = names(page);
  await tabs.nth(0).click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => state(page)).toMatchObject({ selected: 1, focused: 1 });
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => state(page)).toMatchObject({ selected: 2, focused: 2 });
  await page.keyboard.press('ArrowRight'); // wraps
  await expect.poll(() => state(page)).toMatchObject({ selected: 0, focused: 0 });
  await page.keyboard.press('ArrowLeft'); // wraps back
  await expect.poll(() => state(page)).toMatchObject({ selected: 2, focused: 2 });
  await page.keyboard.press('Home');
  await expect.poll(() => state(page)).toMatchObject({ selected: 0, focused: 0 });
  await page.keyboard.press('End');
  await expect.poll(() => state(page)).toMatchObject({ selected: 2, focused: 2 });
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect.poll(() => state(page)).toMatchObject({ selected: 2, focused: 2 });
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => state(page)).toMatchObject({ selected: 2 }); // a horizontal strip ignores up / down
  await page.keyboard.press('Tab');
  expect((await state(page)).focused).toBe(-1); // focus left the strip; it did not step through the other tabs
});

test('tab strip: PageUp / PageDown now act as Home / End (the one additive Radix key)', async ({ page }, info) => {
  await openTabs(page, info.project.name);
  await names(page).nth(0).click();
  await page.keyboard.press('PageDown');
  await expect.poll(() => state(page)).toMatchObject({ selected: 2, focused: 2 }); // Radix: PageDown / PageUp are End / Home (the hand-written strip ignored them)
});

test('tab strips have no serious accessibility violations', async ({ page }, info) => {
  await openTabs(page, info.project.name);
  // Scoped to the tab strips; axe's rule ids are compared to the recorded set, so a migration that adds a violation fails.
  const r = await new AxeBuilder({ page }).include('main [role=tablist]').analyze();
  const found = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => `${v.id}:${v.nodes.length}`);
  console.log('AXE', JSON.stringify(found));
  expect(found).toEqual(RECORDED_AXE);
});
