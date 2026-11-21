import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Phase 6: the contract of the app's Modal and Drawer, now the Radix Dialog (primitives/Modal.tsx, Drawer.tsx over components/ui/dialog.tsx). The approved
// behaviour changes (body scroll lock, the page behind hidden, aria-labelledby) are asserted; everything else the legacy overlays did is unchanged and
// asserted too. Documented in docs/migration/phase6-overlays-select.md.
async function signIn(page: Page, project: string, staffId: string, theme: 'light' | 'dark' = 'light') {
  // The journey stamps "MOI validated at <time>" and the page behind the leave prompt shows it, so the baselines are taken at a fixed time (timers keep running).
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
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}
const go = async (page: Page, to: string) => {
  await page.evaluate((p) => (window as unknown as { next: { router: { push(p: string): void } } }).next.router.push(p), to);
  await page.waitForTimeout(800);
};
async function openLibrary(page: Page, project: string, theme: 'light' | 'dark' = 'light') {
  await signIn(page, project, 'VFQ12364', theme);
  await go(page, '/administration');
  await page.getByText('UI Components Library').first().click();
  await page.getByRole('complementary', { name: 'Component groups' }).getByRole('button', { name: 'Modals & Drawers' }).click();
}
/** What a user and a screen reader could meet while an overlay is open. */
const state = (page: Page) => page.evaluate(() => {
  const a = document.activeElement as HTMLElement | null;
  const dlg = document.querySelector('[role=dialog]');
  const main = document.querySelector('main');
  return {
    active: a ? `${a.tagName}${a.getAttribute('role') ? `[${a.getAttribute('role')}]` : ''}:${(a.getAttribute('aria-label') ?? a.textContent ?? '').trim().slice(0, 30)}` : 'none',
    activeIsDialog: a === dlg,
    activeInDialog: !!(dlg && a && dlg.contains(a)),
    bodyOverflow: getComputedStyle(document.body).overflow,
    bodyStyle: document.body.getAttribute('style') ?? '',
    scrollLockedAttr: document.body.hasAttribute('data-scroll-locked'),
    mainAriaHidden: main?.closest('[aria-hidden=true]') !== null || main?.getAttribute('aria-hidden') === 'true',
    mainInert: main?.closest('[inert]') !== null,
    ariaLabel: dlg?.getAttribute('aria-label') ?? null,
    labelledby: dlg?.getAttribute('aria-labelledby') ?? null,
    describedby: dlg?.getAttribute('aria-describedby') ?? null,
    ariaModal: dlg?.getAttribute('aria-modal') ?? null,
    portalParent: dlg?.closest('body > *')?.tagName ?? null,
    dialogs: document.querySelectorAll('[role=dialog]').length,
  };
});

test.describe('Modal', () => {
  test('contract: container focus, named by aria-labelledby, body scroll locked, page behind hidden, Escape closes, focus returns, scrim closes, inside click does not', async ({ page }, info) => {
    await openLibrary(page, info.project.name);
    const problems: string[] = [];
    page.on('console', (m) => ['error', 'warning'].includes(m.type()) && /radix|dialog/i.test(m.text()) && problems.push(m.text()));
    const opener = page.getByRole('button', { name: 'Open Modal' });
    await opener.focus();
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Confirm Action' });
    await expect(dialog).toBeVisible();
    const s = await state(page);
    expect(s.activeIsDialog).toBe(true);
    expect(s.ariaModal).toBe('true');
    expect(s.labelledby).not.toBeNull(); // named by its title
    await expect(dialog).toHaveAccessibleName('Confirm Action');
    expect(s.describedby).toBeNull();
    expect(s.scrollLockedAttr).toBe(true); // approved change: the body scroll is locked while it is open
    expect(s.mainAriaHidden).toBe(true); // approved change: the page behind is hidden from assistive tech
    expect(s.portalParent).not.toBeNull();
    expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
    await dialog.getByText('A short confirmation message').click(); // a click inside never closes
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused(); // focus returns to the opener
    await opener.click();
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(400); // Radix arms its outside-click listener a tick after mount; a person is never that fast
    await page.mouse.click(5, 5); // the scrim: a Modal closes on it
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(problems).toEqual([]); // no Radix warnings (missing title / description)
  });

  test('Tab is wrapped inside (last -> first, Shift+Tab first -> last); a keyboard user cannot reach the page behind', async ({ page }, info) => {
    await openLibrary(page, info.project.name);
    await page.getByRole('button', { name: 'Open Modal' }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirm Action' });
    await expect(dialog).toBeVisible();
    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      order.push((await state(page)).active);
      expect((await state(page)).activeInDialog).toBe(true);
    }
    expect(new Set(order).size).toBe(3); // Close, Cancel, Confirm - then round again
    await page.keyboard.press('Shift+Tab');
    expect((await state(page)).activeInDialog).toBe(true);
  });

  test('repeated open and close leaves no scroll lock or pointer-events style behind on the body', async ({ page }, info) => {
    await openLibrary(page, info.project.name);
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Open Modal' }).click();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    expect(await page.evaluate(() => ({ style: document.body.getAttribute('style') ?? '', locked: document.body.hasAttribute('data-scroll-locked'), hidden: document.querySelectorAll('[aria-hidden=true]').length }))).toMatchObject({ locked: false, style: expect.not.stringMatching(/overflow|pointer-events/) });
  });
});

test.describe('Drawer', () => {
  test('contract: container focus, aria-labelledby, the scrim does NOT close it, Escape does, focus returns, scroll locked, page behind hidden', async ({ page }, info) => {
    await openLibrary(page, info.project.name);
    const opener = page.getByRole('button', { name: 'Open Drawer' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Details' });
    await expect(dialog).toBeVisible();
    const s = await state(page);
    expect(s.activeIsDialog).toBe(true);
    await expect(dialog).toHaveAccessibleName('Details');
    expect(s.labelledby).not.toBeNull();
    expect(s.scrollLockedAttr).toBe(true);
    expect(s.mainAriaHidden).toBe(true);
    await page.waitForTimeout(400);
    expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
    await page.mouse.click(5, 5);
    await expect(dialog).toBeVisible(); // a scrim click does nothing
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('Tab is wrapped inside the drawer', async ({ page }, info) => {
    await openLibrary(page, info.project.name);
    await page.getByRole('button', { name: 'Open Drawer' }).click();
    await expect(page.getByRole('dialog', { name: 'Details' })).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect((await state(page)).activeInDialog).toBe(true);
    }
  });
});

test('a Select inside a Drawer: Escape closes the list only, the next Escape closes the drawer, focus returns to the opener', async ({ page }, info) => {
  await signIn(page, info.project.name, 'VFQ12341');
  await go(page, '/leads');
  await page.getByText('LEAD-20001', { exact: true }).click();
  await page.waitForTimeout(1200);
  const reject = page.getByRole('button', { name: 'Reject', exact: true });
  await reject.waitFor();
  await reject.click();
  const dialog = page.getByRole('dialog', { name: 'Reject Lead' });
  await expect(dialog).toBeVisible();
  const select = dialog.getByRole('combobox', { name: /Reject Reason Code/ });
  await select.focus();
  await expect(select).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(select).toHaveAttribute('aria-expanded', 'false');
  await expect(dialog).toBeVisible(); // only the list closed
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(reject).toBeFocused();
});


// A minimal PDF: the app accepts PDF or JPG and reads only the name, size and type of a simulated identity document.
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');
/** Gives the New Connection journey progress: on the desktop the scanner simulator; on a touch device, which has none, an uploaded front and back followed by the
 * QID number, its expiry date and Fetch (the upload alone identifies nobody). The number and expiry are a seeded customer's (CUST-1001). */
async function makeJourneyDirty(page: Page, project: string) {
  await page.getByRole('button', { name: /Qatar ID \(QID\)/ }).first().click();
  if (project === 'desktop') {
    await page.getByRole('button', { name: 'Initiate scan' }).first().click();
  } else {
    await page.locator('input[type=file]').first().setInputFiles([{ name: 'front.pdf', mimeType: 'application/pdf', buffer: PDF }, { name: 'back.pdf', mimeType: 'application/pdf', buffer: PDF }]);
    await page.locator('#qid-number-input').fill('28456701234');
    await page.getByLabel('Expiry Date').fill('30/11/2029'); // Fetch stays disabled until the expiry is typed
    await page.getByLabel('Expiry Date').blur();
    await page.getByRole('button', { name: 'Fetch' }).click();
  }
  await page.getByRole('button', { name: 'Save as Draft' }).waitFor(); // the journey now has progress
  await page.waitForTimeout(500);
}

test.describe('leave-journey prompt', () => {
  async function dirtyJourney(page: Page, project: string) {
    await signIn(page, project, 'VFQ12341');
    await go(page, '/mobile/start-connection');
    await makeJourneyDirty(page, project);
  }
  test('a clean journey leaves without a prompt; a dirty one asks, Escape stays, Abandon leaves', async ({ page }, info) => {
    await signIn(page, info.project.name, 'VFQ12341');
    await go(page, '/mobile/start-connection');
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });
  test('dirty: the prompt appears once on internal navigation, Escape and the scrim keep the user in the journey', async ({ page }, info) => {
    await dirtyJourney(page, info.project.name);
    const here = page.url();
    const crumb = page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Dashboard' });
    await crumb.click();
    const prompt = page.getByRole('dialog', { name: 'Leave this journey?' });
    await expect(prompt).toBeVisible();
    expect(await page.getByRole('dialog').count()).toBe(1);
    await page.keyboard.press('Escape');
    await expect(prompt).toHaveCount(0);
    expect(page.url()).toBe(here);
    await crumb.click();
    await expect(prompt).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(prompt).toHaveCount(0);
    expect(page.url()).toBe(here);
    await crumb.click();
    await page.getByRole('button', { name: 'Abandon Journey' }).click();
    await expect(page).not.toHaveURL(here);
  });
  test('reload with a dirty journey asks the browser first (beforeunload); Back is not intercepted', async ({ page }, info) => {
    await dirtyJourney(page, info.project.name);
    const types: string[] = [];
    page.on('dialog', async (d) => { types.push(d.type()); await d.accept(); });
    await page.reload();
    expect(types).toContain('beforeunload');
  });
});

// ---- the shared Dialog on the showcase page (the same component Modal and Drawer wrap) -----------------------------------------------------------
test('showcase Dialog: container focus, scroll locked, page behind hidden, named by its title, the scrim closes it', async ({ page }, info) => {
  await signIn(page, info.project.name, 'VFQ12343');
  await go(page, '/dev/ui-showcase');
  const opener = page.getByRole('button', { name: 'Open Dialog' });
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const s = await state(page);
  expect(s.activeIsDialog).toBe(true);
  expect(s.scrollLockedAttr).toBe(true);
  expect(s.mainAriaHidden).toBe(true);
  expect(s.labelledby).not.toBeNull();
  await page.waitForTimeout(400);
  await page.mouse.click(5, 5);
  await expect(dialog).toHaveCount(0);
});

// The app's Modal opened above another dialog (the showcase's nested section): the stack is Radix's, so it behaves.
test('nested: a Modal above a Dialog takes focus, stays clickable, and one Escape closes only the top layer; focus goes back into the outer one', async ({ page }, info) => {
  await signIn(page, info.project.name, 'VFQ12343');
  await go(page, '/dev/ui-showcase');
  await page.getByRole('button', { name: 'Open Radix Dialog Over Legacy Modal' }).click();
  await page.getByRole('dialog', { name: 'Radix Outer' }).waitFor();
  const openInner = page.getByRole('button', { name: 'Open Legacy Modal' });
  await openInner.click();
  const inner = page.getByRole('dialog', { name: 'Legacy Inner' });
  await inner.waitFor();
  await page.waitForTimeout(500); // the inner layer registers with Radix's stack a tick after it mounts
  const owner = await inner.evaluate((el) => ({ inInner: el.contains(document.activeElement), pointer: getComputedStyle(el).pointerEvents }));
  expect(owner.pointer).toBe('auto'); // clickable
  expect(owner.inInner).toBe(true); // and it holds the focus
  await page.keyboard.press('Escape');
  await expect(inner).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Radix Outer' })).toBeVisible(); // only the top layer closed
  await expect(openInner).toBeFocused(); // focus returned to the opener inside the outer dialog
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

// ---- visual baselines of the open overlays (pixel snapshots; compare after any overlay change) -----------------------------------------------
for (const theme of ['light', 'dark'] as const) {
  test(`visual ${theme}: Modal, Drawer, the leave prompt and a Select open inside a Drawer`, async ({ page }, info) => {
    test.setTimeout(150_000);
    const shot = (name: string) => expect.soft(page).toHaveScreenshot(`overlay-${name}-${info.project.name}-${theme}.png`);
    await openLibrary(page, info.project.name, theme);
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.getByRole('button', { name: 'Open Modal' }).click();
    await page.getByRole('dialog', { name: 'Confirm Action' }).waitFor();
    await page.waitForTimeout(400);
    await shot('modal');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open Drawer' }).click();
    await page.getByRole('dialog', { name: 'Details' }).waitFor();
    await page.waitForTimeout(600); // the slide-in
    await shot('drawer');
    await page.keyboard.press('Escape');
    // the leave prompt over a dirty journey
    await page.evaluate(() => (window as unknown as { next: { router: { push(p: string): void } } }).next.router.push('/'));
    await page.getByRole('main').waitFor();
  });
  test(`visual ${theme}: the leave prompt`, async ({ page }, info) => {
    test.setTimeout(150_000);
    await signIn(page, info.project.name, 'VFQ12341', theme);
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await go(page, '/mobile/start-connection');
    await makeJourneyDirty(page, info.project.name);
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Dashboard' }).click();
    await page.getByRole('dialog', { name: 'Leave this journey?' }).waitFor();
    await page.waitForTimeout(400);
    // The uploaded PDF previews behind the dialog are the browser's own viewer (or its fallback text), which differs between runs: mask them, the dialog is what is pinned.
    await expect(page).toHaveScreenshot(`overlay-leave-prompt-${info.project.name}-${theme}.png`, { mask: [page.locator('.id-preview')] });
  });
  test(`visual ${theme}: the Reject Lead drawer, then its Select open`, async ({ page }, info) => {
    test.setTimeout(150_000);
    const shot = (name: string) => expect.soft(page).toHaveScreenshot(`overlay-${name}-${info.project.name}-${theme}.png`);
    await signIn(page, info.project.name, 'VFQ12341', theme);
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await go(page, '/leads');
    await page.getByText('LEAD-20001', { exact: true }).click();
    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Reject Lead' });
    await dialog.waitFor();
    await page.waitForTimeout(600);
    await shot('reject-drawer');
    await dialog.getByRole('combobox', { name: /Reject Reason Code/ }).focus();
    await page.waitForTimeout(300);
    await shot('reject-drawer-select-open');
  });
}
