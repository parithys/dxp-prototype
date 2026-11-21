// Next.js owns routing: no react-router anywhere, every route file shows a screen that exists, and every navigation destination has a page.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { routeTable } from './routeTable.mjs';

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

test('react-router is gone: no import, no dependency', () => {
  const offenders = [...walk('src'), ...walk('app')].filter((f) => /\.tsx?$/.test(f) && /react-router/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.dependencies['react-router-dom'] ?? pkg.devDependencies['react-router-dom'], undefined);
});

test('every route file shows a screen that src/next/routes.tsx defines', () => {
  const rows = routeTable();
  assert.ok(rows.length >= 30);
  assert.deepEqual(rows.filter((r) => !r.element), []);
  assert.equal(new Set(rows.map((r) => r.path)).size, rows.length, 'one page per URL');
});

test('every navigation destination resolves to a route file that is not the module catch-all', () => {
  const rows = routeTable();
  const manifest = fs.readFileSync('src/navigation/navManifest.ts', 'utf8');
  const dests = [...new Set([...manifest.matchAll(/to:\s*'(\/[\w./-]*)'/g)].map((m) => m[1]))];
  const regexes = rows.filter((r) => r.path !== '/:moduleSlug' && r.path !== '/:moduleSlug/:screenSlug')
    .map((r) => new RegExp('^' + r.path.replace(/:[^/]+/g, '[^/]+') + '$'));
  assert.deepEqual(dests.filter((d) => !regexes.some((rx) => rx.test(d))), []);
});
