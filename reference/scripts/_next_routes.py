"""The route table, read from the Next.js route files.

Every app/**/page.tsx is one URL (a [param] folder is a :param segment) and src/next/routes.tsx holds the screen it shows. The generators
used to parse `<Route path=... element=...>` out of src/router.tsx; `route_source()` renders the same lines from the real route files, so
they keep reading the wiring rather than a copy of it. A route file whose screen is missing from routes.tsx aborts.
"""
import os
import re
import sys


def route_source(app_root):
    routes = open(os.path.join(app_root, 'src', 'next', 'routes.tsx'), encoding='utf-8').read()
    jsx = {m.group(1): m.group(2).strip() for m in re.finditer(r'export const (\w+) = \(\) => \(([\s\S]*?)\);\n', routes)}
    app_dir = os.path.join(app_root, 'app')
    lines = []
    for dirpath, _dirs, files in sorted(os.walk(app_dir)):
        if 'page.tsx' not in files:
            continue
        rel = os.path.relpath(dirpath, app_dir)
        segs = [] if rel == '.' else rel.split(os.sep)
        url = '/' + '/'.join(re.sub(r'^\[(\w+)\]$', r':\1', s) for s in segs)
        page = open(os.path.join(dirpath, 'page.tsx'), encoding='utf-8').read()
        name = re.search(r'import \{ (\w+) \} from', page).group(1)
        if name not in jsx:
            sys.exit(f"app/{rel}/page.tsx shows '{name}', which src/next/routes.tsx does not export")
        lines.append(f'<Route path="{url}" element={{{jsx[name]}}} />')
    return '\n'.join(lines)
