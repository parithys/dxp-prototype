// Storybook guards that need no Storybook install: the configuration is in place, kept out of the application's own tool chain, and every story
// is a story OF the application (production components, no copied styling, known categories). `node scripts/storybook-coverage.mjs` prints the
// component -> story map; this test fails when a reusable component of the APPLICATION has neither a story nor a reasoned exclusion.
//
// The design system (dxp-ui, folder dxp-ui-library) has its own Storybook and its own guards (dxp-ui-library/tests/storybook*.test.mjs): a story
// of a design-system component, the Primitives Map and the token / icon / typography pages live THERE; this side only checks that none came back.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coverage, storyFiles } from '../scripts/storybook-coverage.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CATEGORIES = ['Foundations', 'Primitives', 'Forms', 'Navigation', 'Feedback & Status', 'Documents', 'Business Components', 'Patterns', 'Application Examples'];

test('Storybook is configured, and its packages are dev dependencies the app does not need', () => {
  const pkg = JSON.parse(read('package.json'));
  for (const s of ['storybook', 'build-storybook', 'test-storybook', 'storybook:typecheck']) assert.ok(pkg.scripts[s], `script ${s}`);
  for (const d of ['storybook', '@storybook/react-vite', '@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest']) assert.ok(pkg.devDependencies[d], `devDependency ${d}`);
  assert.ok(!Object.keys(pkg.dependencies).some((d) => /storybook/.test(d)), 'no Storybook package is a runtime dependency');
  for (const f of ['.storybook/main.ts', '.storybook/preview.tsx', '.storybook/mocks/nextNavigation.ts', 'tsconfig.storybook.json', 'vitest.config.ts', 'storybook/CONVENTIONS.md']) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
});

test('Storybook stays out of the application\'s tsc, lint and build', () => {
  assert.match(read('tsconfig.app.json'), /"include":\s*\["src"\]/);
  const lint = read('.oxlintrc.json');
  assert.match(lint, /"ignorePatterns"[^\]]*\.storybook\/\*\*[^\]]*storybook\/\*\*/);
  assert.match(read('.gitignore'), /^storybook-static$/m);
});

test('the preview uses the application\'s own stylesheet, store and toast container', () => {
  const preview = read('.storybook/preview.tsx');
  assert.match(preview, /import '\.\.\/src\/index\.css'/);
  assert.match(preview, /from '\.\.\/src\/stores\/store'/);
  assert.match(preview, /ToastContainer/);
  assert.match(read('.storybook/main.ts'), /staticDirs: \['\.\.\/public'\]/);
});

test('the design system comes from the dxp-ui package: installed by `npm run lib:install` (its real name configured once in package.json), loaded by the app stylesheet the preview imports', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.dxpUi?.package && pkg.dxpUi?.version, 'the package name and version are configured once, in package.json -> dxpUi');
  assert.equal(pkg.scripts['lib:install'], 'node scripts/install-library.mjs');
  const css = read('src/index.css');
  for (const part of ['dxp-ui/preset.css', 'dxp-ui/components.css', 'dxp-ui/tooltip.css']) assert.ok(css.includes(part), `src/index.css imports ${part}`);
  assert.match(read('.storybook/preview.tsx'), /import '\.\.\/src\/index\.css'/);
  assert.match(read('.storybook/preview.tsx'), /from 'dxp-ui'/);
  assert.match(read('tsconfig.storybook.json'), /"include":\s*\[[^\]]*"storybook"/);
  assert.ok(!/dxp-ui['"]\s*:\s*\{[^}]*alias/.test(read('.storybook/main.ts')), 'the package resolves from node_modules, not through an alias');
});

test('every story belongs to a known category and uses the application\'s components, not copies', () => {
  const files = storyFiles().filter((f) => /\.stories\.tsx$/.test(f));
  assert.ok(files.length > 100, `${files.length} story files`);
  const problems = [];
  for (const f of files) {
    const text = read(f);
    const title = /(?:const meta\b[^=]*=|export default)\s*\{\s*title: '([^']+)'/.exec(text)?.[1];
    if (!title || !CATEGORIES.includes(title.split('/')[0])) problems.push(`${f}: title ${title}`);
    // Foundations pages may only demonstrate the app's own classes and tokens (or read them through ./tokenSource); everything else imports a production component.
    if (!f.startsWith('storybook/foundations/') && !/from '(\.\.\/)+src\/|from '@\//.test(text)) problems.push(`${f}: imports nothing from src/`);
    if (/console\.log/.test(text)) problems.push(`${f}: console.log`);
    if (/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(/.test(text.replace(/href=['"]#[^'"]*['"]/g, ''))) problems.push(`${f}: literal colour`);
    if (/@storybook\/react['"]/.test(text)) problems.push(`${f}: import from @storybook/react-vite`);
  }
  assert.deepEqual(problems, []);
});

test('Storybook has no stylesheet of its own: no CSS files, no <style> or injected rules', () => {
  const all = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else all.push(p);
    }
  })(path.join(ROOT, 'storybook'));
  assert.deepEqual(all.filter((f) => /\.css$/.test(f)).map((f) => path.relative(ROOT, f)), []);
  const offenders = all.filter((f) => /\.(tsx?|mdx)$/.test(f) && /<style[ >]|insertRule|createElement\('style'\)/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
  assert.deepEqual(offenders, []);
});

test('every reusable component has a story, or an excluded reason - and exclusions are not stale', () => {
  const { map, exclusions } = coverage();
  const missing = Object.entries(map).filter(([, v]) => !v.stories.length && !v.excluded).map(([k]) => k);
  const stale = Object.keys(exclusions).filter((k) => !map[k] || map[k].stories.length);
  assert.deepEqual(missing, [], 'components with no story and no exclusion');
  assert.deepEqual(stale, [], 'exclusions that are covered now or no longer exist');
  for (const [k, reason] of Object.entries(exclusions)) assert.ok(String(reason).length > 20, `${k}: give a reason`);
});

test('no design-system story lives here: none documents a dxp-ui component, and the Primitives Map and token pages are gone', () => {
  const problems = [];
  for (const f of storyFiles().filter((f) => /\.stories\.tsx$/.test(f))) {
    const text = read(f);
    const component = /\n\s*component:\s*([A-Z]\w*)/.exec(text)?.[1];
    const fromLibrary = component && new RegExp(`import\\s*\\{[^}]*\\b${component}\\b[^}]*\\}\\s*from\\s*'dxp-ui'`).test(text);
    if (fromLibrary) problems.push(`${f}: documents ${component}, a design-system component (its story belongs in dxp-ui-library/stories)`);
  }
  assert.deepEqual(problems, []);
  for (const f of ['storybook/foundations/primitivesMap.json', 'storybook/foundations/tokenSource.tsx', 'storybook/foundations/Colors.stories.tsx', 'storybook/foundations/Typography.stories.tsx', 'storybook/foundations/Icons.stories.tsx']) assert.ok(!fs.existsSync(path.join(ROOT, f)), `${f} moved to the library`);
});

test('every relative import of a story and of the Storybook config resolves (a story must not point at a file that moved to the library)', () => {
  const problems = [];
  const files = [...storyFiles(), '.storybook/preview.tsx', '.storybook/main.ts'].filter((f) => /\.(tsx?|mdx)$/.test(f));
  for (const f of files) {
    for (const m of read(f).matchAll(/from '(\.\.?\/[^']+)'/g)) {
      const target = path.resolve(path.dirname(path.join(ROOT, f)), m[1].replace(/\?raw$/, ''));
      const found = ['', '.ts', '.tsx', '.json', '.mdx', '/index.ts', '/index.tsx'].some((ext) => fs.existsSync(target + ext) && fs.statSync(target + ext).isFile());
      if (!found) problems.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('the application\'s own coverage map names no design-system file (src/components/ui and the field primitives are in the library)', () => {
  const { map } = coverage();
  assert.deepEqual(Object.keys(map).filter((k) => k.startsWith('src/components/ui/')), []);
  assert.ok(!fs.existsSync(path.join(ROOT, 'src/components/ui')), 'src/components/ui moved to dxp-ui');
});
