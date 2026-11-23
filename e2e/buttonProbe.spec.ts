import { test, expect, type Page } from '@playwright/test';

// Button-role migration probe: a text snapshot of every button, link and role=button on a set of screens - its tag, accessible name, box and the computed
// style that carries its look - taken BEFORE a role's conversions (`--update-snapshots` on the unconverted tree) and compared AFTER, so a converted button
// that renders differently, or loses its name, fails. It complements the pixel sweep, which sees only 20 screens in one state: this one also reaches the
// login page, the open profile menu, search results, the journey and every library group, and reads computed style rather than pixels.
// A conversion that is MEANT to change a property (a button becoming a link changes its tag) updates the snapshot in the same PR, with the reason.
const PROPS = ['display', 'color', 'backgroundColor', 'borderTopLeftRadius', 'borderTopWidth', 'paddingTop', 'paddingRight', 'paddingLeft', 'fontSize', 'fontWeight',
  'textDecorationLine', 'gap', 'opacity', 'cursor', 'justifyContent'] as const;

async function probe(page: Page): Promise<string> {
  return page.evaluate((props) => {
    const lines: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('button, a[href], [role=button]'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const cs = getComputedStyle(el);
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
      const role = el.getAttribute('role') ?? (el.tagName === 'A' ? 'link' : 'button');
      const style = props.map((p) => `${p}=${(cs as unknown as Record<string, string>)[p]}`).join(';');
      lines.push(`${el.tagName.toLowerCase()} | ${role} | "${name}" | ${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10} | ${style}`);
    }
    return lines.join('\n');
  }, PROPS as unknown as string[]);
}

async function signIn(page: Page, project: string, staffId: string) {
  await page.clock.setFixedTime(new Date(2026, 10, 7, 14, 30));
  await page.addInitScript((device) => sessionStorage.setItem('dxp-device', device), project === 'desktop' ? 'web' : 'tablet');
  await page.goto('/');
  await page.getByLabel('Staff ID').fill(staffId);
  await page.getByLabel('Password', { exact: true }).fill('Vodafone@123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('main').waitFor();
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
}
async function go(page: Page, path: string) {
  await page.evaluate((to) => (window as unknown as { next: { router: { push(p: string): void } } }).next.router.push(to), path);
  await page.waitForURL((u) => u.pathname + u.search === path);
  await page.getByRole('main').waitFor();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

test('buttons: the login page, before and after the announcements rotate', async ({ page }, info) => {
  await page.clock.setFixedTime(new Date(2026, 10, 7, 14, 30));
  await page.addInitScript((device) => sessionStorage.setItem('dxp-device', device), info.project.name === 'desktop' ? 'web' : 'tablet');
  await page.goto('/');
  await page.getByLabel('Staff ID').waitFor();
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.getByLabel('Password', { exact: true }).fill('x'); // the show / hide password control appears with a value
  await page.waitForTimeout(500);
  expect(await probe(page)).toMatchSnapshot(`probe-login-${info.project.name}.txt`);
});

test('buttons: the shell (header, profile menu, sidebar) and the main screens', async ({ page }, info) => {
  test.setTimeout(240_000);
  await signIn(page, info.project.name, 'VFQ12341');
  await page.waitForTimeout(1500);
  const out: string[] = ['## dashboard', await probe(page)];
  const chip = page.getByRole('button', { name: /Fatima Al-Kuwari/ });
  if (await chip.count()) {
    await chip.first().click();
    await page.waitForTimeout(400);
    out.push('## profile menu open', await probe(page));
    await page.keyboard.press('Escape');
  }
  const search = page.getByRole('combobox').first();
  if (await search.count()) {
    await search.fill('Ahmed');
    await page.waitForTimeout(900);
    out.push('## global search open', await probe(page));
    await page.keyboard.press('Escape');
  }
  for (const path of ['/customer-search', '/customer/CUST-1001', '/orders', '/leads', '/tasks', '/ticket-history', '/new-connections', '/mobile', '/start-connection']) {
    await go(page, path);
    out.push(`## ${path}`, await probe(page));
  }
  expect(out.join('\n')).toMatchSnapshot(`probe-screens-${info.project.name}.txt`);
});

test('buttons: customer search results and the New Connection journey after the ID is read', async ({ page }, info) => {
  test.setTimeout(240_000);
  await signIn(page, info.project.name, 'VFQ12341');
  await go(page, '/customer-search');
  const input = page.getByRole('textbox').first();
  await input.fill('Ahmed');
  await input.press('Enter');
  await page.waitForTimeout(1500);
  const out: string[] = ['## customer search results', await probe(page)];
  await go(page, '/start-connection');
  await page.getByRole('button', { name: /Qatar ID \(QID\)/ }).first().click();
  if (info.project.name === 'desktop') await page.getByRole('button', { name: 'Initiate scan' }).first().click();
  await page.waitForTimeout(1500);
  out.push('## journey, ID step', await probe(page));
  expect(out.join('\n')).toMatchSnapshot(`probe-flows-${info.project.name}.txt`);
});

test('buttons: every UI Components Library group', async ({ page }, info) => {
  test.setTimeout(240_000);
  await signIn(page, info.project.name, 'VFQ12364');
  await go(page, '/administration');
  await page.getByText('UI Components Library').first().click();
  await page.getByRole('heading', { name: 'UI Components Library' }).waitFor();
  const groups = page.getByRole('complementary', { name: 'Component groups' }).getByRole('button');
  const count = await groups.count();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const label = ((await groups.nth(i).innerText()) || `group-${i}`).trim();
    await groups.nth(i).click();
    await page.waitForTimeout(400);
    out.push(`## ${label}`, await probe(page));
  }
  expect(out.join('\n')).toMatchSnapshot(`probe-library-${info.project.name}.txt`);
});
