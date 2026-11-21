import { test, expect, type Locator, type Page } from '@playwright/test';

// Phase 4, family 4: the standard field (label + input/textarea + helper + error) on the shadcn Input, Textarea and Label: association, state and keypad.
async function signIn(page: Page, project: string, staffId: string) {
  await page.addInitScript((device) => sessionStorage.setItem('dxp-device', device), project === 'desktop' ? 'web' : 'tablet');
  await page.goto('/');
  await page.getByLabel('Staff ID').fill(staffId);
  await page.getByLabel('Password', { exact: true }).fill('Vodafone@123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('main').waitFor();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500); // the app has no single ready signal; a push before its config has loaded renders Not Found
}
/** The colour a design token resolves to as a border (computed in the page, so it needs no class and no hard-coded value). */
const tokenBorder = (page: Page, token: string) => page.evaluate((t) => { const el = document.createElement('i'); el.style.cssText = `border: 1px solid var(${t}); position: absolute`; document.body.append(el); const c = getComputedStyle(el).borderTopColor; el.remove(); return c; }, token);
const borderOf = (loc: Locator) => loc.evaluate((el) => getComputedStyle(el).borderTopColor);
const go = (page: Page, to: string) => page.evaluate((p) => (window as unknown as { next: { router: { push(p: string): void } } }).next.router.push(p), to);

test('enterprise account form: labels name their fields, typing is controlled, a number field asks for the numeric keypad', async ({ page }, info) => {
  await signIn(page, info.project.name, 'VFQ12343');
  await go(page, '/enterprise-iot-b2b/account-creation-screen');
  await page.getByRole('heading', { name: 'Enterprise Account Creation' }).waitFor();
  const name = page.getByLabel('Account/Company Name');
  await name.fill('Pilot Co');
  await expect(name).toHaveValue('Pilot Co');
  await name.blur(); // a focused field wears the focus edge
  expect(await borderOf(name)).toBe(await tokenBorder(page, '--field-border-filled')); // the filled edge
  const credit = page.getByLabel('Credit Limit (QAR) - no default for enterprise');
  await expect(credit).toHaveAttribute('type', 'number');
  await expect(credit).toHaveAttribute('inputmode', 'numeric');
  expect(await borderOf(credit)).toBe(await tokenBorder(page, '--field-border')); // an empty field has the default edge
  await page.getByText('Account/Company Name').click(); // the label focuses its field
  await expect(name).toBeFocused();
});

test('library: error, read-only and disabled fields keep their ARIA and keyboard contract', async ({ page }, info) => {
  await signIn(page, info.project.name, 'VFQ12364');
  await go(page, '/administration');
  await page.getByText('UI Components Library').first().click();
  await page.getByRole('complementary', { name: 'Component groups' }).getByRole('button', { name: 'Form Controls' }).click();
  const error = page.getByLabel('Error', { exact: true });
  await expect(error).toHaveAttribute('aria-invalid', 'true');
  expect(await borderOf(error)).toBe(await tokenBorder(page, '--field-border-error')); // the error edge
  const describedBy = await error.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveText('Enter a valid value.');
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveAttribute('role', 'alert');
  const readOnly = page.getByLabel('Read-Only');
  await expect(readOnly).toHaveAttribute('readonly', '');
  await expect(readOnly).toHaveAttribute('tabindex', '-1');
  expect(await readOnly.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(await error.evaluate((el) => getComputedStyle(el).backgroundColor)); // a read-only field is recessed (its own fill)
  await expect(page.getByLabel('Disabled', { exact: true }).first()).toBeDisabled();
  // The helper-text specimen's field: the "Input - Types" specimen has an Email field of its own.
  const helper = page.getByRole('textbox', { name: 'Email', description: 'We send the receipt here.' });
  const helperId = await helper.getAttribute('aria-describedby');
  await expect(page.locator(`[id="${helperId}"]`)).toHaveText('We send the receipt here.');
  await expect(page.getByLabel('Comments')).toHaveJSProperty('tagName', 'TEXTAREA');
});
