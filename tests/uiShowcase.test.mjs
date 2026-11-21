// The app's use of the library's shadcn/ui components: its stylesheet takes the library preset (no second palette), no class of the app's own
// collides with a mapped colour name, the showcase is development-only, and nothing brought a router or a second toaster in. The components
// themselves (install set, cn, rendering, token aliases) are tested in dxp-ui-library/tests/uiShowcase.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { load, close } from './harness.mjs';
import { storeApi } from './storeTesting.mjs';
import { routeTable } from './routeTable.mjs';
import { presetCss, uiComponentsCss } from './libPaths.mjs';

const h = React.createElement;
const read = (f) => fs.readFileSync(f, 'utf8');
// tsconfig files carry comments, which JSON.parse rejects: read them the way TypeScript does.
const readJsonc = (f) => ts.parseConfigFileTextToJson(f, read(f)).config;
const pkg = JSON.parse(read('package.json'));

let wrap;
before(async () => {
  ({ wrap } = await storeApi());
});
after(close);

test('components.json describes this project: the app\'s stylesheet, Tailwind v4 (no config file), the @/ aliases', () => {
  const c = JSON.parse(read('components.json'));
  assert.equal(c.tailwind.css, 'src/index.css');
  assert.equal(c.tailwind.config, '', 'Tailwind 4 is configured in CSS');
  assert.equal(c.tailwind.cssVariables, true);
  assert.ok(fs.existsSync('src/index.css'));
  for (const tsconfig of ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.next.json']) assert.deepEqual(readJsonc(tsconfig).compilerOptions.paths['@/*'], ['./src/*'], tsconfig);
  assert.match(read('vite.config.ts'), /alias: \{ '@': /, 'the test harness resolves @/ too');
});

test('dependencies: the library is the one source of the design system; no router, no stray class-merging or animation packages', () => {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(pkg.dxpUi?.package, 'the design-system package is configured (package.json -> dxpUi) and installed by npm run lib:install');
  assert.ok(fs.existsSync(new URL('../node_modules/dxp-ui/package.json', import.meta.url)), 'dxp-ui is installed');
  for (const d of ['cn', 'next-themes', 'react-router-dom', 'tailwindcss-animate']) assert.equal(deps[d], undefined, `${d} must not be a dependency`);
  assert.equal(Object.keys(deps).filter((d) => /^@radix-ui\//.test(d)).length, 0, 'the single radix-ui package, not one package per primitive');
});

test('the showcase compares each themed component with the app\'s own, and can switch to the tablet scale', () => {
  const src = read('src/dev/UiShowcase.tsx');
  for (const needle of ["Input as AppInput", 'IconButton', 'dataset.device = \'tablet\'', 'Existing Versus Themed']) assert.ok(src.includes(needle), needle);
});

test('the showcase renders every installed component on one page', async () => {
  const { UiShowcase } = await load('/src/dev/UiShowcase.tsx');
  const out = renderToStaticMarkup(wrap(h(UiShowcase)));
  for (const needle of ['data-slot="button"', 'data-slot="input"', 'data-slot="label"', 'data-slot="card"', 'role="tablist"', 'role="checkbox"', 'Open Dialog', 'Menu', 'Existing Versus Themed']) assert.ok(out.includes(needle), needle);
});

test('the app\'s stylesheet takes the shadcn colour aliases from the library preset: no second raw palette, no global reset', () => {
  const css = read('src/index.css');
  assert.match(css, /@import "dxp-ui\/preset\.css"/);
  assert.doesNotMatch(css, /--(?:primary|background|foreground|card|secondary|destructive|input|ring)\s*:\s*(?:#|oklch|hsl|rgb)/, 'no second raw palette');
  const preset = presetCss();
  for (const [name, token] of [['background', '--bg'], ['foreground', '--fg'], ['destructive', '--danger']]) assert.match(preset, new RegExp(`--color-${name}: var\\(${token}\\);`), `${name} -> ${token}`);
  assert.doesNotMatch(css, /^\s*\*\s*\{[^}]*border-color/m, 'no universal border reset: it would change every existing element');
});

test('no shadcn colour name overrides a class the library or the app already has (a mapped `secondary` once turned every .text-secondary near-white)', () => {
  const css = presetCss();
  const mapped = [...css.matchAll(/--color-([a-z-]+): var\(/g)].map((m) => m[1]);
  const own = new Set([...uiComponentsCss().matchAll(/^\s*\.([a-z][\w-]*)/gm)].map((m) => m[1]));
  const clash = [];
  for (const name of ['background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground', 'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted-foreground', 'destructive', 'input', 'ring', 'ui-accent', 'ui-muted']) {
    if (!mapped.includes(name)) continue;
    for (const prefix of ['text', 'bg', 'border', 'ring', 'fill', 'stroke']) if (own.has(`${prefix}-${name}`)) clash.push(`${prefix}-${name}`);
  }
  assert.deepEqual(clash, []);
  assert.ok(!mapped.includes('secondary') && !mapped.includes('primary'), 'secondary / primary are used by the app\'s own classes and are not mapped');
});

test('the showcase is development only: a route file, shown only outside production, in no navigation', () => {
  assert.ok(routeTable().some((r) => r.path === '/dev/ui-showcase' && r.name === 'UiShowcaseRoute'));
  assert.match(read('src/next/routes.tsx'), /UiShowcaseRoute = \(\) => \(IS_DEV \? <UiShowcase \/> : <NotFound \/>\)/);
  assert.doesNotMatch(read('src/navigation/navManifest.ts'), /ui-showcase/);
});

test('no router package or second toaster was brought in: the app\'s Redux notifications are the only toast system (Phase 5 removed the unused shadcn Toaster)', () => {
  const offenders = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p) && /react-router/.test(read(p))) offenders.push(p);
    }
  })('src');
  assert.deepEqual(offenders, []);
  const users = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p) && /<Toaster\b/.test(read(p))) users.push(p);
    }
  })('src');
  assert.deepEqual(users, []);
});
