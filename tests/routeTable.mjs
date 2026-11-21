// The route table, read from the Next.js route files: every app/**/page.tsx is one URL (a [param] folder is a :param segment) and
// src/next/routes.tsx holds the screen it shows. `routerSource()` renders them as `<Route path="..." element={...} />` lines, the shape the
// source-guard tests match on, so they read the real wiring rather than a copy of it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function pages(dir, rel = '') {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
    const r = path.posix.join(rel, e.name);
    if (e.isDirectory()) return pages(dir, r);
    return e.name === 'page.tsx' ? [rel] : [];
  });
}

export function routeTable() {
  const routes = fs.readFileSync(path.join(ROOT, 'src/next/routes.tsx'), 'utf8');
  const jsx = new Map([...routes.matchAll(/export const (\w+) = \(\) => \(([\s\S]*?)\);\n/g)].map((m) => [m[1], m[2].trim()]));
  return pages(path.join(ROOT, 'app')).map((dir) => {
    const page = fs.readFileSync(path.join(ROOT, 'app', dir, 'page.tsx'), 'utf8');
    const name = /import \{ (\w+) \} from/.exec(page)[1];
    const urlPath = '/' + dir.split('/').filter(Boolean).map((s) => s.replace(/^\[(\w+)\]$/, ':$1')).join('/');
    return { path: urlPath, name, element: jsx.get(name) };
  });
}

export const routerSource = () => routeTable().map((r) => `<Route path="${r.path}" element={${r.element}} />`).join('\n');
