// The UI Components Library tab: the second tab on Administration, every group present, each component shown once, rendered from the real components.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { boot, load, close } from './harness.mjs';
import { parse, byRole } from './helpers/dom.mjs';

let out;
before(async () => {
  await boot();
  globalThis.addEventListener ??= () => {};
  globalThis.removeEventListener ??= () => {};
  const { UiComponentsLibrarySection } = await load('/src/workspace/administration/UiComponentsLibrarySection.tsx');
  const { UI_LIBRARY_GROUPS } = await load('/src/workspace/administration/uiLibraryCoverage.ts');
  // One group is shown at a time (left-hand navigation), so render each in turn and join them.
  out = UI_LIBRARY_GROUPS.map(([id]) => html(React.createElement(UiComponentsLibrarySection, { initialGroup: id }))).join('\n');
});
after(close);

test('Administration lists the UI Components Library as the second tab', () => {
  const ws = fs.readFileSync('src/workspace/administration/AdministrationWorkspace.tsx', 'utf8');
  const keys = [...ws.matchAll(/\{ key: '([\w-]+)', label: '([^']+)'/g)].map((m) => m[2]);
  assert.deepEqual(keys.slice(0, 3), ['Capability Library', 'UI Components Library', 'Bell Notifications']);
});

test('every component group is present, and each component name appears once', () => {
  for (const g of ['Buttons', 'Form Controls', 'Cards', 'Tabs', 'Modals &amp; Drawers', 'Alerts &amp; Notifications', 'Tags &amp; Badges', 'Tables', 'Navigation', 'Pagination', 'Tooltips', 'Empty States &amp; Loading']) {
    assert.match(out, new RegExp(`<h3 id="[\\w-]+-title"[^>]*>${g}</h3>`), g);
  }
  const names = [...out.matchAll(/<figcaption[^>]*><span[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.ok(names.length >= 40, `${names.length} specimens`);
  assert.equal(new Set(names).size, names.length, 'no component is shown twice');
});

test('the specimens are the real components: their own markup and states', () => {
  assert.ok(byRole(parse(out), 'button').length > 10, 'the real buttons');
  assert.match(out, /role="tablist"/);
  assert.match(out, /role="radiogroup"/);
  assert.match(out, /disabled=""/);
  assert.match(out, /readonly|aria-readonly/i);
  assert.match(out, /Page 3 of 10/);
  assert.match(out, /This ID type is not supported\./);
});

// Every variant the app uses must be shown. The app's screens are scanned for a string-literal `variant`, `size`, `tone` or `placement` on a Primitive-layer component
// or a shadcn/ui one (and the `type` of an Input); each value needs a specimen in the library, so a variant cannot be used in the app and go unshown.
test('every variant, size, tone, placement and Input type the app uses has a specimen, and so does Label', () => {
  const catalogue = JSON.parse(fs.readFileSync('src/workspace/administration/componentCatalogue.generated.json', 'utf8'));
  const components = new Set([...catalogue.filter((c) => c.layer === 'Primitive').map((c) => c.name), 'Button', 'Card', 'Checkbox', 'Label', 'Input', 'Textarea']);
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  // The app's screens: not the library itself, the stock components, the dev showcase or the capability previews.
  const files = walk('src').filter((p) => /\.tsx$/.test(p) && !/components\/ui\/|UiComponentsLibrarySection|dev\/UiShowcase|previewDemos|capabilities\/previews/.test(p));
  const used = new Map();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const tag of src.matchAll(/<([A-Z]\w+)\b((?:[^<>]|=>|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*?)\/?>/gs)) {
      const [, comp, attrs] = tag;
      if (!components.has(comp)) continue;
      for (const m of attrs.matchAll(/\b(variant|size|tone|placement|type)="([\w -]+)"/g)) {
        // `type` is a variant only of an Input (a Button's is button / submit, an attribute of the control, not a look).
        if (m[1] === 'type' && comp !== 'Input') continue;
        // A Drawer / Modal / EmptyState / Select receive a Button's props inside their own attributes: the scan reads the tag's attributes, not its children's.
        if (m[1] === 'variant' && !['Button', 'Badge', 'TabStrip', 'DataTable'].includes(comp)) continue;
        used.set(`${comp} ${m[1]}="${m[2]}"`, f);
      }
    }
  }
  assert.ok(used.has('Button variant="link"') && used.has('Button variant="ghost"') && used.has('Badge variant="success"'), 'the scan finds the variants');
  const lib = fs.readFileSync('src/workspace/administration/UiComponentsLibrarySection.tsx', 'utf8');
  const missing = [...used.keys()].filter((k) => {
    const [comp, attr] = [k.split(' ')[0], k.slice(k.indexOf(' ') + 1)];
    // Shown as a literal prop on the component, or as an entry of the list the library maps over (Badge variants).
    return !new RegExp(`<${comp}\\b[^>]*${attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 's').test(lib) && !lib.includes(`'${attr.split('"')[1]}'`);
  });
  assert.deepEqual(missing, [], 'used in the app but with no specimen in the UI Components Library');
  // The stock icon-sm size, and Label by name.
  assert.match(lib, /size="icon-sm"/);
  assert.match(out, />Label<\/span>/, 'a named Label specimen');
});
