import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load, close } from './harness.mjs';

after(close);
const nums = JSON.parse(fs.readFileSync('public/mock-data/numbers.json', 'utf8'));
const blocked = nums.filter((n) => n.status === 'BLOCKED');
const RETAIL = 'Retail Sales';

// The Blocked Numbers tab lists the blocked numbers the viewer's own group blocked, as cards, with the same search, filter and sort as the other tabs.
test('Blocked Numbers: the list is exactly the numbers the viewer\'s own group blocked - over the whole population, for every group', async () => {
  const m = await load('/src/components/domain/msisdnPickerModel.ts');
  const groups = [...new Set(blocked.map((n) => n.blockedByTeam).filter(Boolean))];
  assert.ok(groups.length >= 2, 'the data has numbers blocked by different groups');
  for (const viewer of [...groups, 'Some Other Group', undefined, '']) {
    const listed = m.blockedForViewer(nums, viewer);
    const expected = nums.filter((n) => n.status === 'BLOCKED' && Boolean(n.blockedByTeam) && n.blockedByTeam.toLowerCase() === String(viewer ?? '').trim().toLowerCase());
    assert.deepEqual(listed.map((n) => n.msisdn).sort(), expected.map((n) => n.msisdn).sort(), `as ${viewer}`);
    assert.ok(listed.every((n) => n.status === 'BLOCKED'), 'nothing that is not blocked is listed');
  }
  assert.ok(m.blockedForViewer(nums, RETAIL).some((n) => n.msisdn === '+97455551234'), 'the demo VIP number is Retail Sales\'');
  assert.equal(m.blockedForViewer(nums, ' retail sales ').length, m.blockedForViewer(nums, RETAIL).length, 'case and spacing do not matter');
  // Another group's blocked number is not exposed; a record that names no group belongs to nobody the list can verify.
  const premium = blocked.find((n) => n.blockedByTeam === 'Premium');
  assert.ok(!m.blockedForViewer(nums, RETAIL).some((n) => n.msisdn === premium.msisdn));
  assert.ok(m.blockedForViewer(nums, 'Premium').some((n) => n.msisdn === premium.msisdn));
  const unowned = blocked.filter((n) => !n.blockedByTeam);
  assert.ok(unowned.length > 0);
  for (const viewer of groups) for (const n of unowned) assert.ok(!m.blockedForViewer(nums, viewer).some((x) => x.msisdn === n.msisdn));
});

test('Blocked Numbers: the tab is the fourth, in the journeys\' order and the portal\'s', async () => {
  const m = await load('/src/components/domain/msisdnPickerModel.ts');
  assert.equal(m.TAB_LABELS.Blocked, 'Blocked Numbers');
  assert.equal(m.TAB_ORDER.at(-1), 'Blocked');
  assert.equal(m.PORTAL_TAB_ORDER.at(-1), 'Blocked');
  assert.equal(m.PORTAL_TAB_ORDER.length, 4);
});

test('Blocked Numbers: the picker lists them as selectable cards (they are the viewer\'s own group\'s) with the Star filter, search and sort, the reason across two columns, and takes the group from the signed-in persona', () => {
  const src = fs.readFileSync('src/components/domain/MsisdnPicker.tsx', 'utf8');
  assert.match(src, /viewerGroup = getPersona\(activePersonaId\)\?\.name/);
  assert.match(src, /blockedSearching = Boolean\(search\) \|\| \(searchMode === 'price' && Boolean\(priceMin \|\| priceMax\)\) \|\| showingAllPatterns/, 'a text search, a price range or the patterns filter is a search');
  assert.match(src, /tab === 'Blocked'\s*\? blockedSearching\s*\? blockedForViewer\(numbers, viewerGroup\)\s*: \[\]/, 'nothing is listed until the agent searches; then only the viewer\'s own group\'s numbers');
  assert.match(src, /tab !== 'Reserved' && \(/, 'the search-by filter and search box are on every tab but Reserved, Blocked included');
  assert.match(src, /showSort = \(tab === 'Star' \|\| tab === 'Blocked'\)/, 'Blocked sorts by price like Star');
  const card = src.slice(src.indexOf("if (tab === 'Blocked') {"), src.indexOf("if (tab === 'Star' || (tab === 'Reserved'"));
  assert.match(card, /role="button"[\s\S]*aria-pressed=\{isSelected\}[\s\S]*onClick=\{toggle\}/, 'a listed blocked number can be selected');
  assert.match(card, /col-span-2[\s\S]*Blocked Reason/, 'the reason takes two columns');
  assert.doesNotMatch(card, /Blocked<\/Badge>/, 'no Blocked badge');
  assert.match(src, /Blocked By/);
  assert.match(src, /Blocked Reason/);
  assert.ok(!fs.existsSync('src/components/domain/BlockedNumberLookup.tsx'), 'the one-number lookup is replaced by the list');
});

test('Blocked Numbers: the demo VIP number has its group, reason and category on record', () => {
  const vip = nums.find((n) => n.msisdn === '+97455551234');
  assert.equal(vip.blockedByTeam, 'Retail Sales');
  assert.equal(vip.blockedReason, 'Reserved for Villaggio Mall Branch');
  assert.equal(vip.category, 'Star');
});

// For the demo, ten numbers are blocked by Retail Sales: found when searched (whole, in part, by price or pattern), never listed by default, never to another group.
const DEMO = ['55551111', '55552222', '55553333', '55554444', '55555555', '55556666', '55557777', '55558888', '55559999', '55550000'];

test('Blocked Numbers: the ten demo numbers are blocked by Retail Sales, and only Retail Sales sees them', async () => {
  const m = await load('/src/components/domain/msisdnPickerModel.ts');
  for (const d of DEMO) {
    const n = nums.find((x) => x.msisdn === `+974${d}`);
    assert.equal(n.status, 'BLOCKED', d);
    assert.equal(n.blockedByTeam, 'Retail Sales', d);
    assert.ok(n.blockedReason, `${d} says why`);
    assert.ok(n.priceQAR >= 1500 && n.priceQAR <= 50000 && n.valueTier, `${d} is a priced Star number`);
  }
  const mine = m.blockedForViewer(nums, RETAIL).map((n) => m.toLocalMsisdn(n.msisdn));
  for (const d of [...DEMO, '55551234']) assert.ok(mine.includes(d), `${d} is Retail Sales'`);
  for (const other of ['Premium', 'Mass Market', undefined]) for (const d of DEMO) assert.ok(!m.blockedForViewer(nums, other).some((n) => n.msisdn === `+974${d}`), `${d} is not visible to ${other}`);
});

test('Blocked Numbers: the Star search finds them - exact, part, starts with, ends with, contains, price, pattern - and they are all found only by searching', async () => {
  const m = await load('/src/components/domain/msisdnPickerModel.ts');
  const mine = m.blockedForViewer(nums, RETAIL);
  const ids = (list) => list.map((n) => m.toLocalMsisdn(n.msisdn)).sort();
  const by = (search, mode) => mine.filter((n) => m.matchesNumberSearch(n, search, mode));
  assert.deepEqual(ids(by('55551111', 'any')), ['55551111']);
  assert.ok(ids(by('5555', 'starts')).length >= 11, 'starts with 5555: every demo number');
  assert.deepEqual(ids(by('9999', 'ends')), ['55559999']);
  assert.ok(ids(by('777', 'contains')).includes('55557777'));
  assert.ok(m.matchesPriceRange(mine.find((n) => n.msisdn === '+97455555555').priceQAR, '40000', '50000'));
  assert.ok(mine.filter((n) => m.matchesPriceRange(n.priceQAR, '30000', '50000')).length >= 3, 'a price range narrows them');
  assert.ok(mine.every((n) => m.hasRepeatingPairPattern(n.msisdn)), 'the XXYY pattern filter finds them');
  assert.deepEqual(ids(by('1234', 'contains')), ['55551234']);
  assert.deepEqual(ids(by('00000', 'contains')), ['55550000'].filter(() => false), 'five zeros match nothing of theirs');
  assert.deepEqual(ids(by('0000', 'ends')), ['55550000']);
  assert.deepEqual(ids(by('Platinum', 'any')).length > 0, true, 'a tier name finds them too');
});
