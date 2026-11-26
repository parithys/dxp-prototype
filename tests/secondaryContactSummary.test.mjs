import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

// A Secondary Contact, added on SIM Selection, is a step of its own in the Journey Summary, listed straight after SIM Selection - and only once it is added.
let sim;
before(async () => {
  await boot();
  sim = await load('/src/capabilities/SimType/step.tsx');
});
after(close);

test('the Secondary Contact section appears only once it is added, and holds the actual user\'s details', () => {
  const step = sim.simTypeStep({ withActualUser: true });
  const [extra] = step.extraSummary;
  assert.equal(extra.key, 'secondaryContact');
  assert.equal(extra.label, 'Secondary Contact');
  assert.equal(extra.when({}), false, 'not added');
  assert.equal(extra.when({ actualUser: { choice: 'primary' } }), false);
  assert.equal(extra.when({ actualUser: { choice: 'other' } }), true, 'added');
  assert.equal(extra.when({ actualUser: { choice: 'other' }, representative: { enabled: true } }) !== undefined, true);
  assert.deepEqual(extra.fields.map((f) => f.label), ['Line Used By', 'Actual User', 'ID Number', 'Email', 'Work Number']);
  // SIM Selection's own summary no longer carries it.
  assert.ok(!step.summary.some((f) => f.label === 'Line Used By' || f.label === 'Actual User'));
});

test('a journey without the option has no extra section, and the panel and the types carry the mechanism', () => {
  assert.equal(sim.simTypeStep({}).extraSummary, undefined);
  const panel = fs.readFileSync('src/components/patterns/wizard/StepSummaryPanel.tsx', 'utf8');
  assert.match(panel, /\(isCurrent \? \[\] : step\.extraSummary \?\? \[\]\)\.filter\(\(x\) => x\.when\(values\)\)/, 'listed after its step, only while it applies and only once the agent has moved on from the page');
});
