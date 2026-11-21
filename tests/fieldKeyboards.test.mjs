// Touch keyboards: on a tablet or phone the device keyboard opens when a field takes focus, and the field says WHICH keyboard by its data type
// (type="email" / "tel" / "number", or inputMode). Numeric data (QID, PO Box, amounts) gets the number pad; data with letters (Passport, Diplomatic ID,
// Kahramaa ID, CR Number, names) the full QWERTY keyboard. The expectations below are written from the data, not from the code.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { load, close } from './harness.mjs';

after(close);
const read = (f) => fs.readFileSync(f, 'utf8');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

// Every ID number in the mock data, by ID type.
function idNumbersByType() {
  const by = {};
  const visit = (o) => {
    if (Array.isArray(o)) return o.forEach(visit);
    if (!o || typeof o !== 'object') return;
    for (const k of ['qid', 'idNumber']) if (typeof o.idType === 'string' && typeof o[k] === 'string') (by[o.idType] ??= new Set()).add(o[k]);
    Object.values(o).forEach(visit);
  };
  for (const f of fs.readdirSync('public/mock-data').filter((n) => n.endsWith('.json'))) {
    try {
      visit(JSON.parse(read(`public/mock-data/${f}`)));
    } catch {
      /* not JSON data */
    }
  }
  return by;
}

test('ID types: the number pad only for digits-only numbers - QID and GCC ID; Passport, Diplomatic ID and Other ID take the full keyboard', async () => {
  const { ID_TYPES } = await load('/src/data/idTypes.ts');
  // What each number IS (independent of the code): QID 11 digits, GCC ID digits, Passport letters + digits, Diplomatic ID "DIP-QA-nnnnnn", Other ID "RES-nnnnnnn".
  const EXPECTED = { QID: true, 'GCC ID': true, Passport: false, 'Diplomatic ID': false, 'Other ID': false };
  for (const t of ID_TYPES) assert.equal(t.numericNumber, EXPECTED[t.type], `${t.type}: numericNumber`);
  assert.deepEqual(ID_TYPES.map((t) => t.type).sort(), Object.keys(EXPECTED).sort(), 'every ID type is in the table');
});

test('ID types agree with the whole dataset: a number-pad type is (all but a stray record) digits; a full-keyboard type has letters', async () => {
  const { ID_TYPES } = await load('/src/data/idTypes.ts');
  const by = idNumbersByType();
  for (const t of ID_TYPES) {
    const values = [...(by[t.type] ?? [])];
    if (!values.length) continue;
    const digits = values.filter((v) => /^\d+$/.test(v)).length;
    // Conservation: every number is either digits-only or not.
    assert.equal(digits + values.filter((v) => !/^\d+$/.test(v)).length, values.length);
    if (t.numericNumber) assert.ok(digits / values.length >= 0.95, `${t.type}: ${digits}/${values.length} digits-only - a number pad would block the rest`);
    else assert.ok(digits < values.length, `${t.type}: every number is digits, so it could take the number pad`);
  }
});

test('ID number fields: the number pad by ID type, capitals and no autocorrect for numbers with letters', () => {
  for (const f of ['src/components/domain/QidInput.tsx', 'src/components/patterns/NewCustomerDetailsForm.tsx']) {
    const src = read(f);
    assert.match(src, /inputMode=\{[^}]*numericNumber \? 'numeric' : 'text'\}/, f);
    assert.match(src, /autoCapitalize=\{[^}]*numericNumber \? undefined : 'characters'\}/, f);
    assert.match(src, /autoCorrect="off"/, f);
  }
  assert.match(read('src/modules/identity-customer-management/screens/PassportToQidWizard.tsx'), /label="Passport Number"\s+\/\/[^\n]*\n\s+autoCapitalize="characters"/);
});

// Each field named below holds this kind of data; the keyboard it asks for must match.
const FIELDS = [
  ['src/workspace/customer360/BillingAccountPage.tsx', 'Phone', /type="tel"/],
  ['src/workspace/customer360/BillingAccountPage.tsx', 'Email', /type="email"/],
  ['src/workspace/customer360/sections/ContactSection.tsx', 'Work Phone', /type="tel"/],
  ['src/workspace/customer360/sections/ContactSection.tsx', 'Employer Email', /type="email"/],
  ['src/workspace/customer360/sections/AddressSection.tsx', 'PO Box', /inputMode="numeric"/],
  ['src/modules/pre-to-post-migration/screens/BaseManagementWizard.tsx', 'Email', /type="email"/],
  ['src/components/patterns/GuidedContactStep.tsx', 'Email ID', /type="email"/],
  ['src/components/patterns/GuidedContactStep.tsx', 'Work Email ID', /type="email"/],
  ['src/components/patterns/ZsbAddressStep.tsx', 'Zone Number', /inputMode="numeric"/],
  ['src/components/patterns/ZsbAddressStep.tsx', 'PO Number', /inputMode="numeric"/],
  ['src/capabilities/NumberSelection/WaiveOff.tsx', 'Discount Amount', /inputMode="decimal"/],
];

// The opening tag of the <Input> carrying this label (brace-aware: a prop's arrow function holds ">").
function inputTag(src, label) {
  for (let at = src.indexOf('<Input'); at !== -1; at = src.indexOf('<Input', at + 1)) {
    let depth = 0;
    let quote = '';
    let i = at;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === quote) quote = '';
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    const tag = src.slice(at, i + 1);
    if (tag.includes(`label="${label}"`)) return tag;
  }
  return null;
}

test('fields ask for the keyboard their data needs', () => {
  for (const [file, label, keyboard] of FIELDS) {
    const tag = inputTag(read(file), label);
    assert.ok(tag, `${file}: an <Input label="${label}">`);
    assert.match(tag, keyboard, `${file}: ${label}`);
  }
});

test('every editable Email field is type="email" and every Phone field type="tel", across the app', () => {
  const offenders = [];
  for (const f of walk('src').filter((n) => n.endsWith('.tsx') && !n.includes('generated'))) {
    const src = read(f);
    for (const m of src.matchAll(/<Input\b[^]*?label="([^"]*)"/g)) {
      const tag = inputTag(src.slice(m.index), m[1]);
      if (!tag || /\breadOnly\b(?!=\{)/.test(tag) || /\bdisabled\b(?!=\{)/.test(tag)) continue;
      if (/\bEmail\b/i.test(m[1]) && !/type="email"/.test(tag)) offenders.push(`${f}: ${m[1]}`);
      if (/\bPhone\b/i.test(m[1]) && !/type="tel"/.test(tag)) offenders.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('the app\'s phone composite opens the phone keypad (the library\'s PhoneNumberInput, SearchField and Input keyboards are in dxp-ui-library/tests/fieldKeyboards.test.mjs)', () => {
  assert.match(read('src/components/domain/ContactPhoneInput.tsx'), /type="tel"\s+inputMode="tel"/);
});
