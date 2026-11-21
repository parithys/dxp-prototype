import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The tracker itself, and the CSS gate on it, are tested in the library (dxp-ui-library/tests/inputModality.test.mjs).
test('the app and Storybook start the input-modality tracker', () => {
  assert.match(fs.readFileSync('src/next/AppFrame.tsx', 'utf8'), /trackInputModality\(\)/);
  assert.match(fs.readFileSync('.storybook/preview.tsx', 'utf8'), /trackInputModality\(\)/);
});
