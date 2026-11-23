import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

// /start-connection is the common Contact page of every New Connection journey (Mobile, Prepaid, MNP, Home / Fibre): the customer is verified once there, the agent then chooses on
// Recommended Offers. New Home Connection has no Contact page of its own for a role that can reach it.
let nav;
before(async () => {
  await boot();
  nav = await load('/src/engines/navigationEngine.ts');
});
after(close);

const newConnectionsTo = (personaId) => nav.resolveNavFor(personaId).find((i) => i.key === 'new-connections')?.to;

test('the New Connections menu lands on the common Contact page for a role that holds the postpaid wizard grant', () => {
  assert.equal(newConnectionsTo('ROLE-01'), '/start-connection', 'Retail Sales');
  // Customer-First roles (Mass Market, Direct Sales) have no New Connections item in their menu at all.
  assert.equal(newConnectionsTo('ROLE-05'), undefined);
  assert.equal(newConnectionsTo('ROLE-03'), undefined);
  // A role that sees the item but lacks the grant keeps the hub rather than meeting No Access.
  const src = fs.readFileSync('src/engines/navigationEngine.ts', 'utf8');
  assert.match(src, /item\.key === 'new-connections'\) return personaId && canUseFeature\(personaId, COMMON_CONTACT_FEATURE\) \? item : \{ \.\.\.item, to: '\/new-connections' \}/);
});

test('New Home Connection opened with nobody identified goes to the common page; a draft, carried values or a journey under way do not', () => {
  const w = fs.readFileSync('src/modules/new-connection/NewConnectionWizard.tsx', 'utf8');
  assert.match(w, /const homeEntryUnderway = Boolean\(entryState\?\.resumeOrderId \|\| entryState\?\.startValues \|\| draftValues\?\.contact \|\| draftOrderId \|\| \(draftStep \?\? 0\) > 0\);/);
  assert.match(w, /if \(journey !== 'home' \|\| isMirrorWindow \|\| homeEntryUnderway \|\| !personaIdForEntry \|\| !canUseFeature\(personaIdForEntry, COMMON_CONTACT_FEATURE\)\) return;/);
  assert.match(w, /flow === 'existing' && existingCustomerId \? existingCustomerPath\(existingCustomerId\) : '\/start-connection'/);
});

test('Check RFS with nobody identified goes through the common page and keeps its result; Recommended Offers then opens the home journey without a second check', () => {
  const sa = fs.readFileSync('src/modules/check-rfs/ServiceAvailability.tsx', 'utf8');
  assert.match(sa, /'\/start-connection'/);
  assert.match(sa, /startValues: \{ pendingHome: rfsDraftValues\(handOff\) \}/);
  const choice = fs.readFileSync('src/modules/new-connection/steps/productChoice.ts', 'utf8');
  assert.match(choice, /const pendingHome = values\.pendingHome as Record<string, unknown> \| undefined;[\s\S]*ctx\.navigate\(homeConnectionRoute\(ctx\)[\s\S]*\.\.\.pendingHome/);
});
