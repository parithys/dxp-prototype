import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// A journey must never draw a page it is about to leave: the start the entry point asked for (values, the step to open at) is applied before the first page is drawn, a redirect draws nothing,
// and a journey that is left keeps its page until the next route has replaced it (the draft is cleared afterwards, not before). Source guards: the behaviour is a render order.
const read = (p) => fs.readFileSync(p, 'utf8');

test('the start of a journey is applied before its first page is drawn', () => {
  const hook = read('src/components/patterns/wizard/useJourneyStartResume.ts');
  assert.match(hook, /const starting = Boolean\(entry\?\.startFresh \|\| entry\?\.resumeOrderId\) && !startsApplied\.has\(location\.key\);/);
  assert.match(hook, /return starting;/);
  // Marked applied before the draft is written, so the render those writes cause already draws the started journey; a resume only once the stored draft is in.
  assert.match(hook, /startsApplied\.add\(key\);\s*clearDraft\(wizardId\);/);
  assert.match(hook, /startsApplied\.add\(key\);\s*hydrateDraft\(/);
  assert.match(read('src/capabilities/GuidedActivationWizard/GuidedActivationWizard.tsx'), /const starting = useJourneyStartResume\(wizardId, steps\);[\s\S]*if \(starting\) return null;/);
});

test('leaving a journey does not redraw its first page: the draft is cleared once the URL has changed', () => {
  const actions = read('src/components/patterns/wizard/useWizardDraftActions.ts');
  // Abandon Order, Save and Exit and the leave prompt's Abandon release through releaseWhenLeft; none of them clears the draft before the navigation.
  assert.equal((actions.match(/releaseWhenLeft\(wizardId\)/g) ?? []).length, 3);
  const abandon = actions.slice(actions.indexOf('const abandonOrder'), actions.indexOf('// Explicitly distinct from abandonOrder'));
  assert.ok(!/clearDraft\(wizardId\)/.test(abandon), 'abandonOrder clears nothing itself');
  const choice = read('src/modules/new-connection/steps/productChoice.ts');
  assert.ok(!/workflowActions\.clearDraft/.test(choice), 'a hand-off from Product Selection clears nothing itself');
});

test('the home journey\'s pass-through Recommended Offers page is not drawn while it only judges eligibility', () => {
  const choice = read('src/modules/new-connection/steps/productChoice.ts');
  assert.match(choice, /export function homeOffersPassingThrough[\s\S]*productPreselected !== true \|\| values\.offerCarried !== true[\s\S]*!eligibilityJudgedForProduct\(values\) \|\| clearAndQuiet\(values, \{ requireHomeKind: true \}\)/);
  const wizard = read('src/modules/new-connection/NewConnectionWizard.tsx');
  // New Home only: the postpaid and prepaid pages are unchanged.
  assert.match(wizard, /const passing = journey === 'home' && !isMirrorWindow && currentStepKey === 'homeOffers' && homeOffersPassingThrough\(draftValues \?\? \{\}\);/);
  assert.match(wizard, /hidden=\{passing && !passGaveUp\}/);
});

test('a New Home offer moves on only once its plan\'s credit check is read, so the journey passes over Add-ons to the step after them', () => {
  const sel = read('src/modules/new-connection/steps/ProductSelection.tsx');
  assert.match(sel, /const waitsForOfferPlan = homeJourney && values\.offerCarried === true && crossSales\?\.decision === 'accepted' && \(!values\.productId \|\| values\.creditCheckPass === undefined\);/);
  assert.match(sel, /Boolean\(product\) && \(!waitsForOfferPlan || waitedForPlan\) &&/);
  // The Add-ons page is passed over unless "Customise Add-ons" was pressed on a Standard Plan; that button is the plan step's.
  assert.match(read('src/capabilities/AddonsSelection/step.tsx'), /key: 'planExtras'[\s\S]*autoPass: \(values\) => !values\.customiseAddons/);
  assert.match(read('src/capabilities/PlanSelection/step.tsx'), /export function fixedPlanSelectionStep[\s\S]*<CustomiseAddonsAction productId=\{values\.productId as string \| undefined\} preBundled=\{values\.selectionSource === 'OFFER'\}/);
});

test('New Home Connection, existing customer: the new account opens by itself with their existing Billing Address kept; Bill Type is the system\'s Detailed, read-only', () => {
  const step = read('src/components/patterns/BillingAccountStep.tsx');
  assert.match(step, /const opensForHome = Boolean\(homeBillingAddress\) && loaded && profiles\.length > 0 && !atConsumerCap && !value\.creatingNew && !value\.selectedProfileId && !value\.editingProfileId;/);
  assert.match(step, /autoOpened\.current = true;\s*openNewAccount\(true\);/);
  const addr = read('src/capabilities/Billing/HomeBillingAddress.tsx');
  assert.match(addr, /const ticked = existing \? same === true : same !== false;/);
  assert.match(step, /label="Bill Type"\s*disabled=\{Boolean\(homeBillingAddress\)\}\s*value=\{homeBillingAddress \? DEFAULT_BILL_TYPE/);
  assert.match(read('src/components/patterns/billingAccountModel.ts'), /DEFAULT_BILL_TYPE = 'Detailed'/);
});
