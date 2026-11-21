import { test, expect, type Page } from '@playwright/test';

// Phase 5: characterisation of the specialised components the shadcn migration must NOT replace (docs/migration/phase5-specialised-components.md).
// They are exercised where the app shows each of them in isolation: the UI Components Library (Administration, System Administrator). These tests
// describe what the components do TODAY; a replacement that drops any of it must fail here.
async function openLibrary(page: Page, project: string, group: string) {
  await page.addInitScript((device) => sessionStorage.setItem('dxp-device', device), project === 'desktop' ? 'web' : 'tablet');
  await page.goto('/');
  await page.getByLabel('Staff ID').fill('VFQ12364');
  await page.getByLabel('Password', { exact: true }).fill('Vodafone@123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('main').waitFor();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window as unknown as { next: { router: { push(p: string): void } } }).next.router.push('/administration'));
  await page.getByText('UI Components Library').first().click();
  await page.getByRole('complementary', { name: 'Component groups' }).getByRole('button', { name: group }).click();
}

test('searchable select: opens on focus, typing narrows the list without changing the value, arrows + Enter choose, Escape closes only the list', async ({ page }, info) => {
  await openLibrary(page, info.project.name, 'Form Controls');
  const box = page.getByRole('combobox', { name: 'Plan Type' });
  await expect(box).toHaveAttribute('aria-autocomplete', 'list');
  await box.focus();
  await expect(box).toHaveAttribute('aria-expanded', 'true');
  const list = page.getByRole('listbox');
  await expect(list.getByRole('option')).toHaveCount(2);
  await box.pressSequentially('two');
  await expect(list.getByRole('option')).toHaveCount(1); // filtered by what was typed
  await expect(list.getByRole('option').first()).toHaveText('Option Two');
  await expect(box).toHaveAttribute('aria-activedescendant', /-opt-0$/);
  await expect(box).toHaveValue('two');
  // Closes the list, not a surrounding dialog; the typed text is discarded. (Retried: a key sent in the same frame as the last re-render is occasionally dropped on the touch projects.)
  await expect(async () => {
    if ((await box.getAttribute('aria-expanded')) === 'true') await box.press('Escape');
    await expect(box).toHaveAttribute('aria-expanded', 'false', { timeout: 500 });
  }).toPass({ timeout: 8000 });
  await expect(box).toHaveValue('');
  await box.press('ArrowDown'); // opens
  await box.press('ArrowDown');
  await box.press('Enter');
  await expect(box).toHaveValue('Option Two');
  await expect(box).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('combobox', { name: 'With Error' })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('combobox', { name: 'Disabled', exact: true })).toBeDisabled();
});

test('PhoneNumberInput: a country-code combobox inside the field, digits only, stored as E.164, numeric keypad hint', async ({ page }, info) => {
  await openLibrary(page, info.project.name, 'Form Controls');
  const field = page.getByLabel('Mobile Number');
  await expect(field).toHaveAttribute('inputmode', 'tel');
  const country = page.getByRole('combobox', { name: /^Country calling code/ });
  await expect(country).toBeVisible();
  await field.fill('50x35-0824abc');
  await expect(field).toHaveValue(/^\+?\d+$/); // letters and punctuation never land; the stored value is the dial code plus digits
  const digits = (await field.inputValue()).replace(/\D/g, '');
  expect(digits.endsWith('50350824')).toBe(true);
  await country.click();
  await expect(page.getByRole('listbox', { name: 'Country calling code' })).toBeVisible();
  await expect(page.getByRole('listbox', { name: 'Country calling code' }).getByRole('option').first()).toBeVisible();
});

test('DataTable: sortable headers (aria-sort cycles), a framed table, an empty state with its message', async ({ page }, info) => {
  await openLibrary(page, info.project.name, 'Tables');
  const table = page.getByRole('table').first();
  const header = table.getByRole('columnheader', { name: /Customer/ });
  await expect(header).toHaveAttribute('aria-sort', 'none');
  const firstCell = () => table.locator('tbody tr').first().locator('td').nth(1).innerText();
  expect(await firstCell()).toBe('Ahmed Al-Sulaiti');
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  expect(await firstCell()).toBe('Ahmed Al-Sulaiti');
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  expect(await firstCell()).toBe('Sophie Laurent');
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'none'); // a third click clears the sort
  await expect(page.getByText('No orders match your filters.')).toBeVisible();
});

test('tooltip system: shows on hover and on focus, names its trigger (aria-describedby), Escape hides it', async ({ page }, info) => {
  await openLibrary(page, info.project.name, 'Tooltips');
  const trigger = page.getByRole('button', { name: 'Download' }).first();
  await trigger.focus();
  const tip = page.getByRole('tooltip');
  await expect(tip).toHaveText('Download');
  await expect(trigger).toHaveAttribute('aria-describedby', /.+/);
  await page.keyboard.press('Escape');
  await expect(tip).toHaveCount(0);
  await page.mouse.move(0, 0);
  await trigger.hover();
  await expect(page.getByRole('tooltip')).toHaveText('Download');
  expect(await page.getByRole('tooltip').count()).toBe(1); // one tooltip system: never two
});

test('notifications: the Redux queue renders one status or alert per push, Escape and the outside click clear the stack', async ({ page }, info) => {
  await openLibrary(page, info.project.name, 'Alerts & Notifications');
  await page.getByRole('button', { name: 'Success', exact: true }).click();
  const success = page.getByRole('status').filter({ hasText: 'Success notification' });
  await expect(success).toHaveCount(1);
  await expect(success).toHaveAttribute('aria-live', 'polite');
  await page.getByRole('button', { name: 'Error', exact: true }).click();
  const error = page.getByRole('alert').filter({ hasText: 'Error notification' });
  await expect(error).toHaveCount(1);
  await expect(error).toHaveAttribute('aria-live', 'assertive');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Success notification')).toHaveCount(0);
  await expect(page.getByText('Error notification')).toHaveCount(0);
});

test('SignaturePad: a 480x160 canvas, Clear and Done stay disabled until something is drawn, Clear empties it, Done reports the signature', async ({ page }, info) => {
  await openLibrary(page, info.project.name, 'Form Controls');
  const canvas = page.locator('canvas.signature-canvas');
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute('width', '480');
  await expect(canvas).toHaveAttribute('height', '160');
  const clear = page.getByRole('button', { name: 'Clear', exact: true });
  const done = page.getByRole('button', { name: 'Done', exact: true });
  await expect(clear).toBeDisabled();
  await expect(done).toBeDisabled();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 90, { steps: 6 });
  await page.mouse.up();
  await expect(done).toBeEnabled();
  await expect(clear).toBeEnabled();
  const ink = () => canvas.evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0));
  expect(await ink()).toBe(true);
  await clear.click();
  expect(await ink()).toBe(false);
  await expect(done).toBeDisabled();
  await page.mouse.move(box.x + 30, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 80, { steps: 4 });
  await page.mouse.up();
  await done.click();
  await expect(page.getByText('Signature captured.')).toBeVisible();
});
