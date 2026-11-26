// The installed design system (dxp-ui) must style itself: a class its components use, or a token its CSS and code read, may not be defined only in
// this application. (An app-only definition makes the component look right here and unstyled in every other consumer and in the library's Storybook.)
// Read from the package's build (dist), so a library change that depends on app CSS fails here as soon as it is installed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LIB_DIR, libCss, appComponentsCss, APP_ROOT } from './libPaths.mjs';

const code = fs.readFileSync(path.join(LIB_DIR, 'dist/index.js'), 'utf8');
const classDefs = (css) => new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.([a-zA-Z][\w-]*)(?=[\s,.:{>[~+)])/g)].map((m) => m[1]));
const appCss = ['src/app-components.css', 'src/tablet.css', 'src/app-base.css'].map((f) => fs.readFileSync(path.join(APP_ROOT, f), 'utf8')).join('\n');
const libClasses = new Set(['components', 'preset', 'tooltip'].flatMap((n) => [...classDefs(libCss(n))]));
const appClasses = classDefs(appCss);

test('every class the library\'s components use is defined by the library, not only by this application', () => {
  const used = new Set();
  for (const q of ["'", '"', '`']) {
    for (const m of code.matchAll(new RegExp(`${q}([^${q}\\n]*)${q}`, 'g'))) for (const w of m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) used.add(w);
  }
  const appOnly = [...used].filter((w) => appClasses.has(w) && !libClasses.has(w)).sort();
  assert.deepEqual(appOnly, [], 'move these classes into dxp-ui-library/src/styles/components.css (see its README, "Promote a component")');
});

test('every token the library\'s CSS and code read is defined by the library, not only by this application', () => {
  const read = (s) => new Set([...s.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  const used = new Set([...read(code), ...['tokens', 'preset', 'components', 'tooltip'].flatMap((n) => [...read(libCss(n))])]);
  const defined = (css) => new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const libDefined = new Set(['tokens', 'preset', 'components', 'tooltip'].flatMap((n) => [...defined(libCss(n))]));
  const appDefined = defined(fs.readFileSync(path.join(APP_ROOT, 'src/app-tokens.css'), 'utf8'));
  const appOnly = [...used].filter((t) => appDefined.has(t) && !libDefined.has(t)).sort();
  assert.deepEqual(appOnly, [], 'move these tokens into dxp-ui-library/src/styles/tokens.css');
});

test('the guard sees the library\'s own definitions (it is not passing because it reads nothing)', () => {
  assert.ok(libClasses.has('btn') && libClasses.size > 200);
  assert.ok(appClasses.size > 100 && appComponentsCss().length > 1000);
});
