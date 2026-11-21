// USSD Push Preference: a per-line (installed asset) Yes / No that Customer 360 shows and an authorised, verified agent can change.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const assets = JSON.parse(fs.readFileSync('public/mock-data/installed-assets.json', 'utf8'));
const read = (p) => fs.readFileSync(p, 'utf8');

test('a recorded preference is Yes or No, on mobile-number lines only; a line with none stays unknown (no default is invented)', () => {
  const set = assets.filter((a) => 'ussdPushPreference' in a);
  assert.ok(set.length > 0, 'some lines carry one');
  for (const a of set) {
    assert.ok(['Yes', 'No'].includes(a.ussdPushPreference), `${a.installedAssetId}: ${a.ussdPushPreference}`);
    assert.ok(/^\+974\d{8}$/.test(a.serviceId) || ['IA-9002', 'IA-9004', 'IA-9005'].includes(a.installedAssetId), `${a.installedAssetId}: only a mobile line has one (${a.serviceId})`);
  }
  // Fixed, fibre and device services (not given one by any seeder) have none.
  for (const a of assets.filter((x) => /GigaHome|Fixed Voice|OSNtv|Broadband/i.test(x.productServiceName ?? ''))) assert.ok(!('ussdPushPreference' in a), `${a.installedAssetId} is not a mobile line`);
});

test('the Service Details panel shows it for a mobile line and the edit saves Yes / No on the line, behind the edit-records gate and identity verification', () => {
  const panel = read('src/workspace/customer360/sections/C360ProductsServices.tsx');
  assert.match(panel, /\{mobileSel && sel\.asset\?\.installedAssetId !== undefined && \(\s*<Field\s+label="USSD Push Preference"/);
  assert.match(panel, /ussdPush\[String\(sel\.asset\.installedAssetId\)\] \?\? str\(sel\.asset\.ussdPushPreference\)/, 'the changed value shows at once; else the record\'s');
  const edit = read('src/workspace/customer360/sections/UssdPushPreferenceEdit.tsx');
  assert.match(edit, /canEditCustomerRecords\(/);
  assert.match(edit, /requireVerification\(\(\) => setOpen\(true\)\)/);
  assert.match(edit, /updateRecord\('installed-assets', 'installedAssetId', installedAssetId, \{ ussdPushPreference: choice \}\)/, 'saved through the API layer, on the line');
  assert.match(edit, /\{ key: 'Yes', label: 'Yes' \},\s*\{ key: 'No', label: 'No' \}/, 'two values, no others');
  assert.match(edit, /disabled=\{pending \|\| !choice \|\| choice === current\}/, 'nothing to save until a different value is chosen');
  assert.match(edit, /<OptionToggle label="USSD Push Preference"/, 'the Yes / No choice is the Option Toggle');
});
