// Installs the packaged design-system library into node_modules under the alias the app imports (`dxp-ui`).
//
// The package's real name (its npm scope) is set ONCE, in package.json -> "dxpUi" ({ "package": "@vfq/dxp-ui", "version": "^0.1.0" }); no source file
// names it: the app imports the alias `dxp-ui`. To change the scope, edit that one value (and the library's own package.json).
//
// Where it comes from, in order: the first argument, the DXP_UI_SOURCE environment variable, else the registry (`npm:<package>@<version>`).
// A source can be a tarball on disk (the library's `npm pack` output), a tarball URL (a release asset or CI artifact), or an npm spec.
//   npm run lib:install                                   # from the registry
//   npm run lib:install -- ../some/vfq-dxp-ui-0.1.0.tgz   # a packed tarball
//   DXP_UI_SOURCE=https://.../vfq-dxp-ui-0.1.0.tgz npm run lib:install
// It installs with --no-save (the library is not a dependency listed in package.json), so run it after every `npm install` / `npm ci`.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const cfg = pkg.dxpUi;
if (!cfg?.package) throw new Error('package.json has no "dxpUi": { "package": ..., "version": ... }');

const given = process.argv[2] ?? process.env.DXP_UI_SOURCE;
let spec;
if (!given) spec = `npm:${cfg.package}@${cfg.version ?? 'latest'}`;
else if (/^(npm:|https?:|file:|git)/.test(given)) spec = given;
else if (existsSync(given)) spec = `file:${path.resolve(given)}`;
else spec = `npm:${given}`;

console.log(`Installing the design-system library as "dxp-ui" from ${spec}`);
execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', `dxp-ui@${spec}`], { cwd: root, stdio: 'inherit' });

const installed = JSON.parse(readFileSync(path.join(root, 'node_modules/dxp-ui/package.json'), 'utf8'));
if (installed.name !== cfg.package) throw new Error(`installed ${installed.name}, expected ${cfg.package} (see package.json "dxpUi")`);
console.log(`dxp-ui -> ${installed.name}@${installed.version}`);
