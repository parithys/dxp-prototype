// The customer's eligibility results lead their container: directly under its title, before the controls the agent fills in - the same place on every screen that shows them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

test('the Contact steps put the eligibility results first, then the identification and contact details', () => {
  for (const file of ['src/capabilities/CustomerQualification/step.tsx', 'src/capabilities/CustomerQualification/representativeStep.tsx']) {
    const s = read(file);
    const outcome = s.indexOf('<EligibilityOutcomePanel');
    const gate = s.indexOf('<EligibilityGateStep');
    const identification = s.indexOf('<CustomerIdentification');
    assert.ok(outcome > 0 && gate > outcome && identification > gate, `${file}: banner, outcomes and check come before the identification`);
    assert.match(s, /<div className="space-y-4 mb-6 empty:hidden">/, `${file}: a clean pass leaves no gap`);
    assert.ok(s.indexOf('<SpecialDiscountsIdentification') > identification, `${file}: Special Discounts still follow the contact details`);
  }
});

test('the other screens that show eligibility results lead with them too', () => {
  // MNP plan type: above the "Port the number onto" choice.
  const mnp = read('src/modules/new-connection/steps/MnpPlanTypeStep.tsx');
  assert.ok(mnp.indexOf('<ProductEligibility') < mnp.indexOf('<ChoiceCards'));
  // Verify Customer Identity: above the explanation and the identification.
  const gate = read('src/components/patterns/VerificationGate.tsx');
  assert.ok(gate.indexOf('<EligibilityGateStep') < gate.indexOf('<p className="text-secondary">'));
  assert.ok(gate.indexOf('<EligibilityGateStep') < gate.indexOf('<CustomerIdentification'));
  // Product selection, the plan step's upfront payment and the ID type's approval notice already led their step.
  const product = read('src/modules/new-connection/steps/ProductSelection.tsx');
  assert.ok(product.indexOf('<ProductEligibility') < product.indexOf('<CrossSalesStep'));
  const plan = read('src/capabilities/PlanSelection/postpaidStep.tsx');
  assert.ok(plan.indexOf('<EligibilityChecksList rows={hrnRows}') < plan.indexOf('<PlanSelection'));
  const withNotice = read('src/modules/new-connection/connectionSteps.tsx');
  assert.ok(withNotice.indexOf('<IdTypeApprovalNotice') < withNotice.indexOf('{s.render(c)}'));
});

test('the slot between Identity Details and Contact & Notification is gone: nothing sits between those sections any more', () => {
  assert.doesNotMatch(read('src/components/patterns/GuidedContactStep.tsx'), /beforeContact/);
  assert.doesNotMatch(read('src/capabilities/CustomerIdentification/CustomerIdentification.tsx'), /beforeContact/);
});
