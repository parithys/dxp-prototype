// Where the prototype's tests find the design-system library (dxp-ui). The library is consumed as an installed package, so its CSS is read
// from its dist/css (copies of the library's style partials) and its compiled code from dist/. The prototype's own classes live in
// src/app-components.css. The library's SOURCE is not part of the prototype: tests of design-system behaviour live in dxp-ui-library/tests.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LIB_DIR = path.join(APP_ROOT, 'node_modules/dxp-ui');
export const LIB_CSS_DIR = path.join(LIB_DIR, 'dist/css');
const read = (f) => fs.readFileSync(f, 'utf8');

/** The library's style partials: 'tokens' | 'preset' | 'components' | 'tooltip'. */
export const libCss = (name) => read(path.join(LIB_CSS_DIR, `${name}.css`));
/** The design tokens: the library's, then the application's own (src/app-tokens.css). */
export const tokensCss = () => `${libCss('tokens')}\n${read(path.join(APP_ROOT, 'src/app-tokens.css'))}`;
export const presetCss = () => libCss('preset');
export const tooltipCss = () => libCss('tooltip');
/** The prototype's own component classes (the app, not the design system). */
export const appComponentsCss = () => read(path.join(APP_ROOT, 'src/app-components.css'));
/** What used to be src/ui-components.css: the design-system component classes followed by the app's own. */
export const uiComponentsCss = () => `${libCss('components')}\n${appComponentsCss()}`;
/** The library's compiled code (the ESM bundle), for guards that look for strings in what the app actually ships. */
export const libBundle = () => read(path.join(LIB_DIR, 'dist/index.js'));
/** A declaration file of the library (types and signatures only), e.g. libDts('components/primitives/Badge'). */
export const libDts = (rel) => read(path.join(LIB_DIR, 'dist', `${rel}.d.ts`));
