import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Phase 7 (accessibility contracts): field-border contrast, focus rings, skip link, route announcements, radio groups, disabled and validation semantics,
// and axe per library group - measured on the live app, light and dark. Documented in docs/migration/phase7-accessibility.md.
type Theme = 'light' | 'dark';
async function signIn(page: Page, project: string, staffId: string, theme: Theme) {
  await page.addInitScript(CONTRAST_HELPERS);
  await page.addInitScript(([device, th]) => {
    sessionStorage.setItem('dxp-device', device);
    localStorage.setItem('vfq-theme-store', JSON.stringify({ state: { theme: th }, version: 0 }));
  }, [project === 'desktop' ? 'web' : 'tablet', theme]);
  await page.goto('/');
  await page.getByLabel('Staff ID').fill(staffId);
  await page.getByLabel('Password', { exact: true }).fill('Vodafone@123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('main').waitFor();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}
const push = (page: Page, to: string) => page.evaluate((p) => (window as unknown as { next: { router: { push(p: string): void } } }).next.router.push(p), to);
async function openGroup(page: Page, group: string) {
  await push(page, '/administration');
  await page.waitForTimeout(600); // the route announcer moves focus to <main> 150 ms after a route change
  await page.getByText('UI Components Library').first().click();
  await page.getByRole('complementary', { name: 'Component groups' }).getByRole('button', { name: group }).click();
}

/** Page-side helpers: colour parsing (any CSS colour, via a canvas), the WCAG contrast ratio, and the colour a surface really paints. */
const CONTRAST_HELPERS = `window.__h = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const surface = (el) => { let bg = [255, 255, 255]; const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e); for (const e of chain.reverse()) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) bg = bg.map((v, i) => Math.round(c[i] * c[3] + v * (1 - c[3]))); } return bg; };
  return { rgba, ratio, surface };
})();`;
type Helpers = { rgba(css: string): number[]; ratio(a: number[], b: number[]): number; surface(el: Element): number[] };

type Measure = { name: string; ratio: number; border: string; surface: string };
async function borderContrast(loc: Locator, name: string): Promise<Measure> {
  return loc.first().evaluate((el, label) => {
    const h = (window as unknown as { __h: Helpers }).__h;
    const cs = getComputedStyle(el);
    const border = h.rgba(cs.borderTopColor);
    // The surface the field sits on: its own parent's painted colour (a field's edge is judged against what is outside it).
    const surface = h.surface(el.parentElement!);
    return { name: label, ratio: +h.ratio(border, surface).toFixed(2), border: cs.borderTopColor, surface: `rgb(${surface.join(',')})` };
  }, name);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(theme, () => {
    test(`field borders: the default, error, read-only and checkbox edges meet 3:1 (${theme})`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'colour tokens do not vary by viewport');
      await signIn(page, info.project.name, 'VFQ12364', theme);
      await openGroup(page, 'Form Controls');
      const m = [
        await borderContrast(page.getByLabel('Full Name', { exact: true }), 'input default'),
        await borderContrast(page.getByLabel('Filled', { exact: true }), 'input filled'),
        await borderContrast(page.locator('input[aria-invalid=true]'), 'input error'),
        await borderContrast(page.locator('input[readonly]'), 'input read-only'),
        await borderContrast(page.locator('input:disabled').first(), 'input disabled'),
        await borderContrast(page.locator('textarea').first(), 'textarea'),
        await borderContrast(page.getByRole('combobox', { name: 'Plan Type' }), 'select trigger'),
        await borderContrast(page.getByRole('checkbox').first(), 'checkbox'),
      ];
      console.log(`CONTRAST ${theme}`, JSON.stringify(m.map((x) => `${x.name}=${x.ratio}`)));
      const by = Object.fromEntries(m.map((x) => [x.name, x.ratio]));
      if (theme === 'light') {
        for (const k of ['input default', 'input filled', 'input read-only', 'input error', 'textarea', 'select trigger', 'checkbox']) expect(by[k], k).toBeGreaterThanOrEqual(3); // WCAG 1.4.11
      } else {
        // Was an EXISTING ISSUE (1.6 to 1.8:1 in dark); raised to #707a8e in Phase 7 so the edge meets WCAG 1.4.11 on every dark surface.
        for (const k of ['input default', 'input filled', 'input read-only', 'textarea', 'select trigger', 'checkbox']) expect(by[k], k).toBeGreaterThanOrEqual(3);
        expect(by['input error'], 'the error edge stays clearly distinct').toBeGreaterThanOrEqual(3);
      }
    });

    test(`focus indicators: every keyboard-operable control shows one (${theme})`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'the ring is the same on every viewport');
      await signIn(page, info.project.name, 'VFQ12364', theme);
      const rings: string[] = [];
      const check = async (label: string, selector: string) => {
        const el = page.locator(selector).first();
        await el.scrollIntoViewIfNeeded();
        // Keyboard modality, so :focus-visible applies to the programmatic focus. A real key, not a bare Shift: lib/inputModality.ts ignores a
        // modifier on its own, so after a click (opening the library group) html[data-input='pointer'] would stay and hide the tab's ring.
        await page.keyboard.press('Tab');
        await el.focus();
        await page.waitForTimeout(400); // the button's box-shadow transitions in (--motion-fast): measure after it settles
        const r = await el.evaluate((node) => {
          const h = (window as unknown as { __h: Helpers }).__h;
          const cs = getComputedStyle(node);
          const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? `outline ${cs.outlineWidth} ${cs.outlineColor}` : '';
          // Only shadows that actually paint (a non-zero offset, blur or spread) count as a ring.
          const painted = cs.boxShadow === 'none' ? [] : cs.boxShadow.split(/,\s*(?=(?:rgba?|oklab|oklch|color)\()/).filter((part) => /\s(?!0px)\d*\.?\d+px/.test(part.replace(/^(rgba?|oklab|oklch|color)\([^)]*\)/, '')));
          const shadow = painted.length ? `shadow ${painted.join(', ')}` : '';
          const border = `border ${cs.borderTopColor}`;
          const surface = h.surface(node.parentElement!);
          // box-shadow is "colour x y blur spread[, colour ...]": the outermost ring is the last shadow; its colour comes first in the part.
          const last = painted[painted.length - 1] ?? '';
          const colourOf = (part: string) => /^(rgba?\([^)]*\)|oklab\([^)]*\)|oklch\([^)]*\)|color\([^)]*\))/.exec(part)?.[0] ?? '#000';
          const ringColour = shadow ? h.rgba(colourOf(last)) : outline ? h.rgba(cs.outlineColor) : h.rgba(cs.borderTopColor);
          return { visible: Boolean(outline || shadow), outline, shadow, border, ratioToSurface: +h.ratio(ringColour, surface).toFixed(2) };
        });
        rings.push(`${label}: ${JSON.stringify(r)}`);
        return r;
      };
      await openGroup(page, 'Buttons');
      const results: Record<string, Awaited<ReturnType<typeof check>>> = {};
      results.primary = await check('primary button', 'button[data-variant=default]');
      results.secondary = await check('secondary button', 'button[data-variant=secondary]');
      results.tertiary = await check('tertiary button', 'button[data-variant=tertiary]');
      results.icon = await check('icon button', 'button[aria-label="Download"]');
      await openGroup(page, 'Form Controls');
      results.input = await check('input', 'main input[id]:not([aria-invalid]):not([readonly]):not(:disabled)');
      results.textarea = await check('textarea', 'main textarea');
      results.checkbox = await check('checkbox', '[role=checkbox]');
      results.select = await check('select trigger', '[role=combobox].select-field');
      await openGroup(page, 'Tabs');
      results.tab = await check('tab', '[role=tab]');
      await openGroup(page, 'Modals & Drawers');
      await page.getByRole('button', { name: 'Open Modal' }).click();
      await page.getByRole('dialog', { name: 'Confirm Action' }).waitFor();
      await page.waitForTimeout(400);
      results.modalClose = await check('modal close button', '[role=dialog] button[aria-label="Close"]');
      await page.keyboard.press('Escape');
      console.log(`FOCUS ${theme}\n  ${rings.join('\n  ')}`);
      for (const [k, v] of Object.entries(results)) expect(v.visible, `${k} shows a focus indicator`).toBe(true);
      for (const [k, v] of Object.entries(results)) expect(v.ratioToSurface, `${k} ring contrast`).toBeGreaterThanOrEqual(3);
    });
  });
}

// ---- skip link and route announcements ---------------------------------------------------------------------------------------------------------
for (const theme of ['light', 'dark'] as const) {
  test(`skip link: first in the tab order, named, visible and unclipped on focus, targets the one <main>, moves focus there (${theme})`, async ({ page }, info) => {
    await signIn(page, info.project.name, 'VFQ12343', theme);
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    expect(await page.evaluate(() => {
      const tabbable = [...document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((e) => e.offsetParent !== null || e.classList.contains('skip-link'));
      return tabbable[0]?.textContent?.trim();
    })).toBe('Skip to main content');
    await expect(skip).toHaveAttribute('href', '#main-content');
    expect(await page.locator('#main-content').count()).toBe(1);
    await expect(page.locator('main#main-content')).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('Shift');
    await skip.focus();
    await page.waitForTimeout(300);
    const box = await skip.boundingBox();
    const vp = page.viewportSize()!;
    expect(box && box.width > 20 && box.height > 10 && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width).toBe(true); // on screen, not clipped
    const paint = await skip.evaluate((el) => { const cs = getComputedStyle(el); return { clip: cs.clip, opacity: cs.opacity, position: cs.position, z: cs.zIndex }; });
    expect(paint.opacity).toBe('1');
    expect(paint.clip === 'auto' || paint.clip === '').toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main-content')).toBeFocused();
    expect(new URL(page.url()).hash).toBe(''); // no route change, no #fragment left behind
    await push(page, '/orders'); // and it still works after a client-side navigation
    await page.waitForTimeout(600);
    await skip.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main-content')).toBeFocused();
  });
}

test('route announcements: one polite status per route change, named from the page heading; the title follows; focus moves to <main>', async ({ page }, info) => {
  await signIn(page, info.project.name, 'VFQ12343', 'light');
  const status = page.locator('p.sr-only[role=status]');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await push(page, '/orders');
  await expect(status).toHaveText('Orders page');
  await expect(page).toHaveTitle('Orders - Vodafone Qatar DXP');
  await expect(page.locator('main#main-content')).toBeFocused();
  await push(page, '/leads');
  await expect(status).toHaveText(/Leads|All Leads/);
  await page.goBack();
  await expect(status).toHaveText('Orders page'); // Back announces the page it returns to
  await expect(page).toHaveTitle('Orders - Vodafone Qatar DXP');
  await page.goForward();
  await expect(status).toHaveText(/Leads|All Leads/);
  await push(page, '/no-such-page-xyz');
  await expect(status).toHaveText('Page Not Found page');
  expect(await page.locator('[role=status][aria-live]').filter({ hasText: /page$/ }).count()).toBe(1); // exactly one announcer, never a duplicate
});

// ---- semantics of the migrated controls ---------------------------------------------------------------------------------------------------------
test('radio groups and choice cards keep role=radiogroup, a group name, role=radio and aria-checked (the hand-written ones were not part of the migration)', async ({ page }, info) => {
  await signIn(page, info.project.name, 'VFQ12364', 'light');
  await openGroup(page, 'Form Controls');
  const group = page.getByRole('radiogroup').first();
  await expect(group).toBeVisible();
  const radios = group.getByRole('radio');
  expect(await radios.count()).toBeGreaterThan(1);
  const checked = await radios.evaluateAll((els) => els.map((e) => e.getAttribute('aria-checked') ?? (e as HTMLInputElement).checked));
  expect(checked.filter((v) => v === 'true' || v === true).length).toBe(1);
  expect(await group.evaluate((g) => g.getAttribute('aria-label') || g.getAttribute('aria-labelledby') || g.closest('fieldset')?.querySelector('legend')?.textContent)).toBeTruthy();
  // native radios: real inputs with a group name and a native disabled state
  const native = page.locator('input[type=radio]');
  if (await native.count()) {
    await expect(native.last()).toBeDisabled();
    expect(await native.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).name).filter(Boolean).length)).toBeGreaterThan(0);
  }
});

test('disabled controls use native disabled (button, input, checkbox), leave the tab order and do not activate', async ({ page }, info) => {
  await signIn(page, info.project.name, 'VFQ12364', 'light');
  await openGroup(page, 'Form Controls');
  const dc = page.getByRole('checkbox', { name: /Disabled/ }).or(page.locator('label', { hasText: /^\s*Disabled\s*$/ }).getByRole('checkbox')).first();
  await expect(dc).toBeDisabled();
  expect(await dc.evaluate((e) => ({ native: e.hasAttribute('disabled'), tabindex: e.getAttribute('tabindex'), state: e.getAttribute('data-disabled') !== null, checked: e.getAttribute('aria-checked') }))).toMatchObject({ native: true, state: true, checked: 'false' });
  await dc.click({ force: true }).catch(() => undefined);
  await expect(dc).toHaveAttribute('aria-checked', 'false'); // a disabled checkbox does not toggle
  await expect(page.getByLabel('Disabled', { exact: true }).first()).toBeDisabled(); // input
  await openGroup(page, 'Buttons');
  await expect(page.locator('button[data-variant=default]:disabled').first()).toBeDisabled();
});

// ---- axe on every component group --------------------------------------------------------------------------------------------------------------
const GROUPS = ['Buttons', 'Form Controls', 'Cards', 'Tabs', 'Modals & Drawers', 'Alerts & Notifications', 'Tags & Badges', 'Tables', 'Navigation', 'Pagination', 'Tooltips', 'Empty States & Loading', 'Other'];
// Violations found on the library groups (rule id : nodes) - existing issues, none in a migrated component, recorded so a migration cannot add one.
// Empty since Phase 7 fixed the three marginal colour-contrast tokens (error text, green tag, dark danger text); add to it only with a documented reason.
const RECORDED_AXE: Record<Theme, Record<string, string[]>> = { light: {}, dark: {} };
for (const theme of ['light', 'dark'] as const) {
  test(`axe: every component group, serious and critical only (${theme})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the markup does not vary by viewport');
    test.setTimeout(180_000);
    await signIn(page, info.project.name, 'VFQ12364', theme);
    const found: Record<string, string[]> = {};
    for (const group of GROUPS) {
      await openGroup(page, group);
      await page.waitForTimeout(300);
      const r = await new AxeBuilder({ page }).include('main').analyze();
      const bad = r.violations.filter((x) => ['serious', 'critical'].includes(x.impact ?? ''));
      const v = bad.map((x) => `${x.id}:${x.nodes.length}`);
      if (v.length) found[group] = v;
      for (const x of bad) for (const n of x.nodes) console.log(`AXEDETAIL ${theme} ${group} ${x.id}`, n.target.join(' '), (n.any[0]?.message ?? '').slice(0, 160), n.html.slice(0, 140));
    }
    console.log(`AXE ${theme}`, JSON.stringify(found));
    expect(found).toEqual(RECORDED_AXE[theme]);
  });
}

test('profile password errors belong to their field: aria-invalid, aria-describedby and a role=alert message', async ({ page }, info) => {
  await signIn(page, info.project.name, 'VFQ12341', 'light');
  await push(page, '/profile');
  await page.getByLabel('Current Password').waitFor();
  await page.getByLabel('Current Password').fill('wrong-password');
  await page.getByLabel('New Password', { exact: true }).fill('Whatever@123');
  await page.getByLabel('Confirm New Password').fill('Whatever@123');
  await page.getByLabel('Verification Code').first().fill('000000');
  await page.getByRole('button', { name: 'Save Password' }).click();
  const field = page.getByLabel('Current Password');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  const errorId = await field.getAttribute('aria-describedby');
  expect(errorId).toBeTruthy();
  await expect(page.locator(`[id="${errorId}"]`)).toHaveText('Current password is incorrect.');
  await expect(page.locator(`[id="${errorId}"]`)).toHaveAttribute('role', 'alert');
  await expect(page.getByLabel('New Password', { exact: true })).not.toHaveAttribute('aria-invalid', 'true');
});
