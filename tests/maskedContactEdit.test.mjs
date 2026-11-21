import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

// A NAS Email ID / Mobile Number is shown masked and stays editable; what the agent enters is shown unmasked.
let m;
before(async () => {
  await boot();
  m = await load('/src/components/patterns/guidedContactModel.ts');
});
after(close);

const nas = { isNewCustomer: true, email: 'fatima.al@example.qa', mobile: '55123451' };

test('a NAS value is masked until the agent changes it, then shown as entered', () => {
  const fresh = { email: nas.email, personalMobile: nas.mobile, moiResult: nas };
  assert.equal(m.displayedEmail(fresh), m.maskEmail(nas.email));
  assert.equal(m.displayedMobile(fresh), m.maskMobile(nas.mobile));
  const edited = { ...fresh, email: 'new.address@example.qa', personalMobile: '55999888' };
  assert.equal(m.displayedEmail(edited), 'new.address@example.qa');
  assert.equal(m.displayedMobile(edited), undefined, 'undefined = the field shows its own (typed) digits');
  // Emptied: nothing left to mask.
  assert.equal(m.displayedEmail({ ...fresh, email: '' }), '');
  // An agent-created customer has no NAS value to mask.
  assert.equal(m.displayedEmail({ ...fresh, moiResult: { ...nas, createdByAgent: true } }), nas.email);
});

test('editing inside the mask keeps only what was typed; a clean replacement is kept as is', () => {
  assert.equal(m.valueAfterEditingMask('new@x.qa', null), 'new@x.qa', 'select-all + type / paste: no stars, kept whole');
  assert.equal(m.valueAfterEditingMask('f**q*y@e****e.qa', 'q'), 'q', 'a key typed inside the mask');
  assert.equal(m.valueAfterEditingMask('f*y@e****e.qa', null), '', 'a deletion inside the mask clears it');
  assert.equal(m.valueAfterEditingMask('', null), '');
});

test('the contact step no longer locks a NAS value, and the mobile field applies the same rule', () => {
  const step = fs.readFileSync('src/components/patterns/GuidedContactStep.tsx', 'utf8');
  assert.doesNotMatch(step, /fromNas\s*&&/, 'a NAS email / mobile is not read-only');
  assert.match(step, /readOnly=\{emailLocked\}/);
  assert.match(step, /valueAfterEditingMask\(/);
});
