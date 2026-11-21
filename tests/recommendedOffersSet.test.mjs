import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, load, close } from './harness.mjs';
import { uiComponentsCss } from './libPaths.mjs';

// Recommended Offers (demonstration set): no grouping, six cards - New Postpaid's three, then one New Fixed Line, one New MNP and one New Prepaid.
let model, std;
before(async () => {
  await boot();
  model = await load('/src/capabilities/CrossSellOffers/crossSalesModel.ts');
  std = await load('/src/data/standardOffers.ts');
});
after(close);

const names = (list) => list.map((o) => o.offerName);

test('the set is New Postpaid x3, then one Fixed Line, one MNP, one Prepaid - from the standard offers', () => {
  const set = model.demoOfferSet({
    'new-postpaid': std.STANDARD_OFFERS['new-postpaid'],
    'new-home': std.STANDARD_OFFERS['new-home'],
    'new-mnp': std.STANDARD_OFFERS['new-mnp'],
    'new-prepaid': std.STANDARD_OFFERS['new-prepaid'],
    'pre-to-post-upgrade': std.STANDARD_OFFERS['pre-to-post-upgrade'],
    'post-to-post-upgrade': std.STANDARD_OFFERS['post-to-post-upgrade'],
  });
  assert.equal(set.length, 6);
  assert.deepEqual(set.slice(0, 3).map((o) => o.serviceJourney), ['new-postpaid', 'new-postpaid', 'new-postpaid']);
  assert.deepEqual(set.slice(3).map((o) => o.serviceJourney), ['new-fixed-line', 'mnp-postpaid', 'new-prepaid']);
  assert.ok(!set.some((o) => o.serviceJourney === 'new-fwa' || o.serviceJourney === 'pre-to-post' || o.serviceJourney === 'post-to-post'), 'no FWA, and no upgrades');
});

test('the home slot is a Fixed Line offer even when FWA is listed first; a type with no offer contributes none', () => {
  const fixed = { offerName: 'Fixed', serviceJourney: 'new-fixed-line' }, fwa = { offerName: 'FWA', serviceJourney: 'new-fwa' };
  assert.deepEqual(names(model.demoOfferSet({ 'new-home': [fwa, fixed] })), ['Fixed']);
  assert.deepEqual(names(model.demoOfferSet({ 'new-home': [fwa] })), [], 'FWA alone is not a Fixed Line offer');
  assert.deepEqual(model.demoOfferSet({}), []);
  const mnp = [{ offerName: 'M1' }, { offerName: 'M2' }];
  assert.deepEqual(names(model.demoOfferSet({ 'new-mnp': mnp })), ['M1'], 'one per type');
});

test('the step no longer groups: no type heading and one list', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync('src/capabilities/CrossSellOffers/CrossSalesStep.tsx', 'utf8');
  assert.doesNotMatch(src, /offer-type-/);
  assert.match(src, /demoOfferSet\(/);
});

test('every kind of connection has its own tone, all the postpaid plans share one, and the kind is named on the card', async () => {
  const fs = await import('node:fs');
  const set = model.demoOfferSet({ 'new-postpaid': std.STANDARD_OFFERS['new-postpaid'], 'new-home': std.STANDARD_OFFERS['new-home'], 'new-mnp': std.STANDARD_OFFERS['new-mnp'], 'new-prepaid': std.STANDARD_OFFERS['new-prepaid'] });
  const sj = await load('/src/capabilities/CrossSellOffers/serviceJourneys.ts');
  const toneOf = (o) => model.offerToneOf(sj.offerTypeOf(o.serviceJourney));
  const tones = set.map(toneOf);
  assert.deepEqual(tones, ['blue', 'blue', 'blue', 'amber', 'pink', 'green'], 'postpaid x3 alike, then one tone per other kind');
  assert.equal(new Set(tones).size, 4);
  assert.deepEqual(set.map((o) => model.offerKindLabel(sj.offerTypeOf(o.serviceJourney), o.serviceJourney)), ['New Postpaid', 'New Postpaid', 'New Postpaid', 'New Fixed Line', 'New MNP', 'New Prepaid']);
  // The tag every card carries: a postpaid offer by its plan's class, the others by their journey.
  const classes = ['Postpaid Voice Plans', 'Postpaid Broadband Plans', 'Postpaid Family Plans', undefined, 'Postpaid Voice Plans', undefined];
  assert.deepEqual(set.map((o, i) => model.offerTagLabel(sj.offerTypeOf(o.serviceJourney), o.serviceJourney, classes[i])), ['Postpaid Voice Plan', 'Postpaid Broadband Plan', 'Postpaid Family Plan', 'New Home', 'New MNP', 'New Prepaid'], 'an MNP offer is New MNP whatever its plan class');
  assert.equal(model.offerTagLabel('new-postpaid', 'new-postpaid', undefined), 'Postpaid');
  assert.equal(model.offerTagLabel('new-home', 'new-fwa', undefined), 'FWA');
  const step = fs.readFileSync('src/capabilities/CrossSellOffers/CrossSalesStep.tsx', 'utf8');
  assert.match(step, /\{tagLabel && \(/, 'every card carries its tag');
  assert.doesNotMatch(step, /offer-kind/);
  assert.equal(model.offerToneOf(undefined), undefined);
  const css = uiComponentsCss();
  for (const t of ['blue', 'amber', 'pink', 'green']) assert.match(css, new RegExp(`\\.offer-tone-${t} \\{`), t);
});

test('a selected or recommended card drops the tone wash and border (so its own border is the only one); an idle card keeps them, with no top strip', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync('src/capabilities/CrossSellOffers/CrossSalesStep.tsx', 'utf8');
  assert.match(src, /offer-tone-\$\{tone\} \$\{selected \|\| recommended \? '' : 'offer-tone-idle'\}/);
  assert.match(uiComponentsCss(), /\.offer-tone-idle \{\s*@apply border-\[color-mix/);
});

test('no top strip on the cards', async () => {
  const css = uiComponentsCss();
  const block = css.slice(css.indexOf('.offer-tone-idle {'), css.indexOf('}', css.indexOf('.offer-tone-idle {')));
  assert.doesNotMatch(block, /border-t-4|border-t-\[/);
});

test('Recommended Offers always shows six cards: with five available, Fiber Connection is the sixth; with six, it is not added', () => {
  const lists = { 'new-postpaid': std.STANDARD_OFFERS['new-postpaid'], 'new-home': std.STANDARD_OFFERS['new-home'], 'new-mnp': std.STANDARD_OFFERS['new-mnp'] };
  const five = model.demoOfferSet(lists);
  assert.equal(five.length, 5, 'prepaid offers are not on this page');
  const six = model.demoOfferSet(lists, [std.FIBER_CONNECTION_OFFER]);
  assert.equal(six.length, 6);
  assert.equal(six[5].offerName, 'Fiber Connection');
  assert.equal(six[5].cardTag, 'New Home', 'the standing fibre card is tagged New Home');
  assert.equal(six[5].serviceJourney, 'new-fixed-line');
  assert.equal(new Set(six.map((o) => o.offerId)).size, 6, 'no card twice');
  // Already six: the filler is not added.
  const full = model.demoOfferSet({ ...lists, 'new-prepaid': std.STANDARD_OFFERS['new-prepaid'] }, [std.FIBER_CONNECTION_OFFER]);
  assert.equal(full.length, 6);
  assert.equal(full[5].serviceJourney, 'new-prepaid', 'a real sixth offer keeps its place; the filler is cut off');
  assert.equal(model.demoOfferSet({}, [std.FIBER_CONNECTION_OFFER]).length, 1, 'never more than the fillers given');
});
