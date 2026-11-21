// Design-token governance, app side. The tokens are the library's (dxp-ui-library/tests/tokens.test.mjs checks the tokens themselves: dark
// values, scales, palette). Here: everything the app reads is defined, and every token the library defines is read by the library or the app.
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { colourTokensWithoutDark, deadTokens, loadTokens, undefinedRefs } from './tokenModel.mjs';

test('tokens: every var(--x) used in the app is defined', () => {
  assert.deepEqual(undefinedRefs(), []);
});

test('tokens: no dead tokens (declared but never read)', () => {
  assert.deepEqual(deadTokens(), [], 'delete these, or use them');
});


// The application's own tokens (src/app-tokens.css): a raw colour there needs a dark value too, or an entry here with the reason it is the same in both themes.
const APP_CONSTANT_ACROSS_THEMES = {
  '--summary-milestone': 'Step Summary progress fill and milestone disc; same orange in both themes',
  '--login-bg': 'login hero is dark in both themes',
  '--toast-dot-info': 'dot on the dark toast',
  '--white-glass-10': 'glass fill on a dark surface',
  '--telesales-amber': 'chart series colour',
  '--telesales-blue': 'chart series colour',
  '--telesales-chart-slate': 'chart series colour',
};

test('tokens (app): every raw-colour token the application defines has a dark value or is listed as constant across themes', () => {
  const appNames = new Set([...fs.readFileSync(new URL('../src/app-tokens.css', import.meta.url), 'utf8').matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const missing = colourTokensWithoutDark().filter((t) => appNames.has(t) && !(t in APP_CONSTANT_ACROSS_THEMES));
  assert.deepEqual(missing, [], 'add a value to the dark block in src/app-tokens.css, or list the token in APP_CONSTANT_ACROSS_THEMES with the reason');
});

test('tokens (app): the constant-across-themes list has no stale entries', () => {
  const { light, dark } = loadTokens();
  assert.deepEqual(Object.keys(APP_CONSTANT_ACROSS_THEMES).filter((t) => !light.has(t) || dark.has(t)), []);
});
