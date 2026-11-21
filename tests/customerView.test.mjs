// "Customer view" is offered on the same screens in every journey: one policy, keyed by the shared step keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load, close } from './harness.mjs';

test('Customer view is offered on Recommended Offers, Plans & Offers, Number Selection, CAF & Signature and Order Submitted only (not on the Checkout / Order Summary page)', async () => {
  const { hasCustomerView } = await load('/src/components/patterns/wizard/customerViewPolicy.ts');
  for (const key of ['product', 'crossSales', 'plan', 'number', 'caf', 'order-submitted']) assert.equal(hasCustomerView(key), true, key);
  for (const key of ['checkout', 'contact', 'productSelection', 'addons', 'planExtras', 'donor-attachment', 'homeKind', 'mnpType', 'installation', 'line',  'sim', 'simType', 'address', 'billingAccount', 'payment', 'cart', 'subscriptions', 'appointment', 'activity', undefined]) {
    assert.equal(hasCustomerView(key), false, String(key));
  }
});

test('the CAF & Signature customer view carries the Order Summary (the Checkout step) above the terms and the signing', () => {
  const panel = fs.readFileSync('src/components/patterns/wizard/CustomerMirrorPanel.tsx', 'utf8');
  assert.match(panel, /orderSummaryStep && \(/);
  assert.ok(panel.indexOf('orderSummaryStep.render') < panel.indexOf('step?.render('), 'the summary comes first');
  assert.match(fs.readFileSync('src/capabilities/GuidedActivationWizard/GuidedActivationWizard.tsx', 'utf8'), /orderSummaryStep=\{currentStep\?\.key === 'caf' \? activeSteps\.find\(\(s\) => s\.key === 'checkout'\)/);
});

test('no step decides Customer view for itself', async () => {
  const { execSync } = await import('node:child_process');
  assert.equal(execSync('grep -rn hideCustomerView src || true').toString().trim(), '');
});

test.after(close);

test('the title band\'s Abandon Order is always a secondary button (the one place it is drawn, whatever the journey or step)', () => {
  const band = fs.readFileSync('src/components/patterns/wizard/WizardTitleBand.tsx', 'utf8');
  assert.match(band, /<Button\s+variant="secondary"\s+size="sm"\s+onClick=\{onRequestAbandon\}\s*>\s*Abandon Order/, 'a fixed secondary variant, not chosen by a prop or state');
  assert.equal((band.match(/Abandon Order\s*<\/Button>/g) ?? []).length, 1, 'drawn in one place only');
});
