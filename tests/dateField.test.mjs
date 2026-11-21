import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// The date field itself (parsing, calendar, DateInput) is tested in the library (dxp-ui-library/tests/dateField.test.mjs).
// Every editable date in the app is the DateInput (a typed field with the calendar icon): no raw date input is left behind.
test('no editable date uses a bare native date input or a plain text field labelled as a date', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx$/.test(e.name) ? [path.join(dir, e.name)] : []));
  const offenders = [];
  for (const file of walk('src')) {
    const src = fs.readFileSync(file, 'utf8');
    if (/type="date"/.test(src)) offenders.push(`${file}: type="date"`);
    if (/type="(datetime-local|month|week)"/.test(src)) offenders.push(`${file}: a native date-time picker`);
    if (/<Input[^>]*placeholder="DD\/MM\/YYYY"/.test(src)) offenders.push(`${file}: a DD/MM/YYYY text Input`);
  }
  assert.deepEqual(offenders, []);
});
