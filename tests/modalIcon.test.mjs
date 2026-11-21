// A dialog's icon tile has the fill every icon tile in the app has (--icon-tile-bg), not a colour of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { uiComponentsCss } from './libPaths.mjs';

test('the modal icon tile takes the shared icon tile fill', () => {
  const css = uiComponentsCss();
  const rule = /\.modal-icon \{[^}]*\}/.exec(css)?.[0] ?? '';
  assert.match(rule, /bg-\[var\(--icon-tile-bg\)\]/);
  assert.doesNotMatch(rule, /bg-tone-|bg-surface-warm/, 'no wash of its own');
  // and the same icon colour the ID Type card glyphs have (not the accent red)
  assert.match(rule, /text-\[var\(--icon-tile-fg\)\]/);
  assert.doesNotMatch(rule, /accent-text/);
  // the same token the card glyphs use
  assert.match(/\.option-glyph \{[^}]*\}/.exec(css)?.[0] ?? '', /bg-\[var\(--icon-tile-bg\)\]/);
});

test('a plain toast uses the eligibility outcome classes: success pass, error hard stop, warning soft stop, info advisory', () => {
  const src = fs.readFileSync('src/capabilities/Toasts/Toast.tsx', 'utf8');
  assert.match(src, /success: 'pass',\s*error: 'hard-stop',\s*warning: 'soft-stop',\s*info: 'advisory'/);
  assert.match(src, /eligibility-alert-\$\{KIND_OUTCOME\[t\.kind\]\}/);
  assert.doesNotMatch(src, /kindSurface|kindDot|KIND_ICON/, 'no colour system of its own');
});
