// Multi-SIM: the count comes only from `multiSimCount` on the plan and the selected add-ons, summed and held to 4; each gets a Free-pool number
// automatically; a Multi-SIM is never a customer's active line or a reservation; and the SIM Selection page titles itself only when they apply.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

let m, model;
before(async () => {
  await boot();
  m = await load('/src/engines/multiSim.ts');
  model = await load('/src/capabilities/SimType/multiSimModel.ts');
});
after(close);

const read = (p) => fs.readFileSync(p, 'utf8');
const products = JSON.parse(read('public/mock-data/products.json'));

test('a count is a stated whole number of at least 1; anything else is none (unknown stays 0)', () => {
  assert.equal(m.multiSimCountOf({ multiSimCount: 2 }), 2);
  for (const v of [undefined, null, 0, -1, 1.5, '2', NaN]) assert.equal(m.multiSimCountOf({ multiSimCount: v }), 0, String(v));
  assert.equal(m.multiSimCountOf(undefined), 0);
});

test('the add-ons are summed and held between 0 and 4; a plan adds none (Multi SIM is offered through Add-ons only)', () => {
  const e = (plan, addons) => m.multiSimEntitlement(plan, addons);
  assert.deepEqual(e(undefined, []), { fromPlan: 0, fromAddons: 0, requested: 0, provisionable: 0 });
  assert.equal(e({ multiSimCount: 2 }, [{ multiSimCount: 1 }]).provisionable, 1, 'a plan\'s own count adds none: 1, not 2 + 1');
  assert.equal(e({ multiSimCount: 3 }, []).provisionable, 0);
  assert.equal(e({}, [{ multiSimCount: 3 }, { multiSimCount: 2 }]).provisionable, 4, 'held at 4');
  assert.equal(e({}, [{ multiSimCount: 3 }, { multiSimCount: 2 }]).requested, 5);
  assert.equal(e({}, [{ multiSimCount: 1 }, { multiSimCount: 2 }]).provisionable, 3);
  assert.equal(e({}, [{}, { name: 'Multi SIM' }]).provisionable, 0, 'a name is not a count');
});

test('an add-on that would take the total above 4 is blocked; one that adds none, or fits, is not', () => {
  assert.equal(m.exceedsMultiSimMax(undefined, [{ multiSimCount: 3 }], { multiSimCount: 2 }), true);
  assert.equal(m.exceedsMultiSimMax(undefined, [{ multiSimCount: 3 }], { multiSimCount: 1 }), false, 'exactly 4 is allowed');
  assert.equal(m.exceedsMultiSimMax(undefined, [{ multiSimCount: 2 }, { multiSimCount: 2 }], { multiSimCount: 1 }), true);
  assert.equal(m.exceedsMultiSimMax({ multiSimCount: 4 }, [], { multiSimCount: 4 }), false, 'a plan\'s count is not counted');
  assert.equal(m.exceedsMultiSimMax(undefined, [{ multiSimCount: 4 }], {}), false, 'an add-on with no Multi-SIMs is never blocked');
});

test('the catalogue: only the records that state a count provide one, across the whole product set', () => {
  assert.equal(m.multiSimBenefitText({ multiSimCount: 2 }), '2 Multi-SIMs included');
  assert.equal(m.multiSimBenefitText({ multiSimCount: 1 }), '1 Multi-SIM included');
  assert.equal(m.multiSimBenefitText({ multiSimCount: 9 }), '4 Multi-SIMs included', 'held at the maximum');
  assert.equal(m.multiSimBenefitText({}), undefined);
  // The independent expectation: the two add-ons and four demo plans given a count (seeded 2026-11-03): Offers tab PROD-108 / PROD-109, Standard Plans PROD-139 / PROD-140.
  const STATED = { 'PROD-195': 1, 'PROD-196': 4, 'PROD-197': 4, 'PROD-108': 1, 'PROD-109': 2, 'PROD-139': 2, 'PROD-140': 1 };
  const withCount = Object.fromEntries(products.filter((p) => p.multiSimCount !== undefined).map((p) => [p.productId, p.multiSimCount]));
  assert.deepEqual(withCount, STATED);
  for (const p of products) assert.equal(m.multiSimCountOf(p), STATED[p.productId] ?? 0, p.productId);
  // The paid Multi SIM add-on states one (2026-11-17); a product whose NAME alone says Multi SIM would provide none.
  assert.equal(m.multiSimCountOf(products.find((p) => p.productId === 'PROD-195')), 1);
});

test('Free-pool numbers: Free and AVAILABLE only, never the primary or one already given, lowest first; too few throws', () => {
  const pool = [
    { msisdn: '+97433000005', category: 'Free', status: 'AVAILABLE' },
    { msisdn: '+97433000001', category: 'Free', status: 'AVAILABLE' },
    { msisdn: '+97433000002', category: 'Free', status: 'Reserved' },
    { msisdn: '+97433000003', category: 'Free', status: 'BLOCKED' },
    { msisdn: '+97433000004', category: 'Star', status: 'AVAILABLE' },
    { msisdn: '+97433000006', category: 'Free', status: 'AVAILABLE' },
  ];
  assert.deepEqual(m.assignMultiSimMsisdns(pool, new Set(), 2), ['+97433000001', '+97433000005']);
  assert.deepEqual(m.assignMultiSimMsisdns(pool, new Set(['+97433000001']), 2), ['+97433000005', '+97433000006'], 'the primary is skipped');
  assert.deepEqual(m.assignMultiSimMsisdns(pool, new Set(), 0), []);
  assert.throws(() => m.assignMultiSimMsisdns(pool, new Set(), 4), /Not enough free numbers/);
  // The real inventory covers the maximum.
  const numbers = JSON.parse(read('public/mock-data/numbers.json'));
  const got = m.assignMultiSimMsisdns(numbers, new Set(), m.MULTI_SIM_MAX);
  assert.equal(new Set(got).size, 4);
  for (const n of got) assert.ok(numbers.some((x) => x.msisdn === n && x.category === 'Free' && x.status === 'AVAILABLE'));
});

test('the Multi-SIMs held: at most the count, complete only when all are in and provisioned, no serial twice', () => {
  const physical = (serial) => ({ simType: 'Physical', simSerial: serial, simValid: true });
  const esim = (iccid) => ({ simType: 'eSIM', esimIssued: true, simIccid: iccid });
  const values = { simType: physical('A'), multiSims: [physical('B'), esim('E1'), physical('D')] };
  assert.equal(model.multiSimsFor(values, 2).length, 2, 'trimmed to the count');
  assert.equal(model.multiSimsFor({}, 3).length, 0, 'nothing held yet');
  assert.deepEqual(model.multiSimsFor({}, 0), []);
  assert.equal(model.allMultiSimsComplete(values, 3), true);
  assert.equal(model.allMultiSimsComplete(values, 4), false, 'one more is still needed');
  assert.equal(model.allMultiSimsComplete({ ...values, multiSims: [physical('B'), { simType: 'Physical', simSerial: 'C', simValid: false }] }, 2), false, 'a serial that did not validate');
  assert.equal(model.allMultiSimsComplete({}, 0), true, 'none to provision');
  assert.equal(model.allMultiSimsComplete({ ...values, multiSims: [{ simType: 'Physical', simSerial: 'B', simValid: true }] }, 1), true, 'no number of its own is needed: it shares the Primary SIM\'s');
  assert.equal(model.hasDuplicateSerial(values, 3), false);
  assert.equal(model.hasDuplicateSerial({ ...values, multiSims: [physical('A')] }, 1), true, 'the same serial as the primary');
  assert.equal(model.hasDuplicateSerial({ ...values, multiSims: [physical('B'), physical('B')] }, 2), true);
  assert.deepEqual(model.serialsInUse(values, 3), ['A', 'B', 'D']);
  assert.deepEqual(model.iccidsOfEsims({ simType: esim('E0'), multiSims: [physical('B'), esim('E1')] }, 2), ['E0', 'E1']);
});

test('on the SIM Selection page the Multi-SIMs are read-only: type and serial as configured on the Addons page, nothing to select, scan or generate', () => {
  const step = read('src/capabilities/SimType/step.tsx');
  assert.equal((step.match(/<MultiSimPanel/g) ?? []).length, 1);
  assert.doesNotMatch(step, /Multi-SIM \$\{i \+ 1\}|multiSimsFor\([^)]*\)\.map\(/, 'no panel per Multi-SIM');
  assert.doesNotMatch(step.slice(step.indexOf('<MultiSimPanel'), step.indexOf('/>', step.indexOf('<MultiSimPanel'))), /onChange|device|approvalRequired|otherSerials/, 'no editing props');
  const panel = read('src/components/domain/MultiSimPanel.tsx');
  assert.doesNotMatch(panel, /SimSerialScanner|Generate eSIM|issueEsimProfile|<Button|<IconButton|onChange/, 'nothing to select, scan, generate or remove');
  assert.match(panel, /SIM Type/);
  assert.match(panel, /SIM Serial Number/);
  assert.match(panel, /sim\?\.simType === 'eSIM' \? sim\.simIccid : sim\?\.simSerial/, 'an eSIM\'s serial is its ICCID');
});

test('the SIM Selection page is titled "Primary SIM Selection" only when Multi-SIMs apply', async () => {
  const src = read('src/capabilities/SimType/step.tsx');
  assert.match(src, /headingFor: \(values\) => \(multiCount\(values\) > 0 \? 'Primary SIM Selection' : undefined\)/);
  assert.match(src, /Selected Multi-SIM/);
  // The step label (the rail and the summary) keeps the one name.
  assert.match(read('src/data/stepLabels.ts'), /SIM_TYPE_LABEL = 'SIM Selection'/);
  // New Postpaid is the journey that passes a count.
  assert.match(read('src/modules/new-connection/postpaidSteps.tsx'), /multiSimCount: multiSimCountFor\(products\)/);
});

test('a Multi-SIM shares the Primary SIM\'s MSISDN: nothing allocates, chooses, requires or submits a number of its own', () => {
  const step = read('src/capabilities/SimType/step.tsx');
  assert.match(step, /allMultiSimsComplete\(values, multiCount\(values\)\) \|\| hasDuplicateSerial/);
  const panel = read('src/components/domain/MultiSimPanel.tsx');
  assert.doesNotMatch(panel, /assignMultiSimMsisdns|secondaryMsisdn|Secondary Number|<Input|<Select|NumberSelection/);
  assert.doesNotMatch(panel, /Mobile Number|primaryMsisdn/, 'no number row: the SIM shares the Primary\'s');
  const submit = read('src/modules/new-connection/submitNewConnectionOrder.ts');
  assert.doesNotMatch(submit, /assignMultiSimMsisdns\(|secondaryMsisdn|has no secondary number/);
  // Each Multi-SIM line carries the Primary's number; not a customer's line and not a reservation.
  const lineBlock = submit.slice(submit.indexOf("createRecord('multi-sim-lines'"), submit.indexOf("createRecord('multi-sim-lines'") + 700);
  assert.match(lineBlock, /msisdn: values\.msisdn/);
  assert.doesNotMatch(lineBlock, /customerId/);
  assert.doesNotMatch(lineBlock, /Reserved/);
  assert.doesNotMatch(read('src/capabilities/SimType/summary.ts'), /secondaryMsisdn/);
});

test('Multi SIM add-on: the SIM Selection opens in a side drawer on the Addons page; the SIMs are shown on the add-on\'s own card, with no separate Multi SIM list on the page', () => {
  const comp = read('src/capabilities/AddonsSelection/MultiSimAddonSims.tsx');
  assert.match(comp, /<Drawer/);
  assert.match(comp, /<SimTypeStep/);
  assert.doesNotMatch(comp, /aria-label="Multi SIM" className/, 'no separate Multi SIM section on the page');
  assert.doesNotMatch(comp, /navigate|useRouter|assignMultiSimMsisdns|secondaryMsisdn/, 'the agent stays on the page; no number is allocated');
  const step = read('src/capabilities/AddonsSelection/step.tsx');
  assert.match(step, /<MultiSimAddonSims/);
  assert.match(step, /values\.multiSimsPending === true\) return false/);
});

test('the maximum of 4 Multi-SIMs: what is asked for is counted, and an add-on that would take the order above it cannot be selected', () => {
  const picker = read('src/capabilities/AddonsSelection/AddonsPicker.tsx');
  assert.match(picker, /multiSimsRequested\(addons\.filter\(/);
  assert.match(picker, /\) \+ 1 > MULTI_SIM_MAX/);
  assert.match(picker, /if \(!removing && candidate && multiSimBlocked\(candidate\)\) return;/);
  // Asked for, not provided: one each to start, the next added on the Addons page, never above what the add-on provides or 4 in all.
  const free = { productId: 'F', multiSimCount: 4 }, paid = { productId: 'P', multiSimCount: 1 };
  assert.equal(m.multiSimRequestedOf(free), 1);
  assert.equal(m.multiSimRequestedOf(free, { F: 3 }), 3);
  assert.equal(m.multiSimRequestedOf(free, { F: 9 }), 4, 'held at what the add-on provides');
  assert.equal(m.multiSimRequestedOf(paid, { P: 3 }), 1);
  assert.equal(m.multiSimRequestedOf({ productId: 'N' }, { N: 3 }), 0, 'no stated count, none');
  assert.equal(m.multiSimsRequested([free, paid]), 2);
  assert.equal(m.multiSimsRequested([free, paid], { F: 4 }), 4, 'held at 4 in all');
  assert.equal(m.multiSimsRequested([free, paid], { F: 3 }), 4);
});


test('plan cards, plan details and plan search never advertise included Multi-SIMs: Multi SIM is offered through Add-ons only', () => {
  for (const f of ['src/components/patterns/PostpaidPlanCard.tsx', 'src/components/patterns/PlanDetailsDrawer.tsx', 'src/components/patterns/postpaidPlanModel.ts']) {
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /multiSimBenefitText/, f);
  }
});

test('Order Summary serial rows: one SIM keeps "SIM Serial Number"; with Multi-SIMs it is SIM Serial Number (Primary) then (SIM1), (SIM2) ...; an eSIM has no serial row', async () => {
  const { simSerialRows } = await load('/src/components/patterns/checkoutSummaryRows.ts');
  const phys = (serial) => ({ simType: 'Physical', simSerial: serial });
  assert.deepEqual(simSerialRows(phys('A1')), [{ label: 'SIM Serial Number', value: 'A1' }]);
  assert.deepEqual(simSerialRows(phys('A1'), []), [{ label: 'SIM Serial Number', value: 'A1' }]);
  assert.deepEqual(simSerialRows(phys('A1'), [phys('B1'), phys('B2')]), [
    { label: 'SIM Serial Number (Primary)', value: 'A1' },
    { label: 'SIM Serial Number (SIM1)', value: 'B1' },
    { label: 'SIM Serial Number (SIM2)', value: 'B2' },
  ]);
  // A Multi-SIM that is an eSIM has no serial; the numbering still follows the SIM's place, and an eSIM primary shows none.
  assert.deepEqual(simSerialRows({ simType: 'eSIM' }, [phys('B1'), { simType: 'eSIM' }, phys('B3')]), [
    { label: 'SIM Serial Number (SIM1)', value: 'B1' },
    { label: 'SIM Serial Number (SIM3)', value: 'B3' },
  ]);
  assert.deepEqual(simSerialRows(undefined), []);
});

test('the two free Multi SIM add-ons are alternatives (Local Benefits or GCC Benefits): the benefit type applies to every Multi-SIM and the two are never mixed', () => {
  const group = products.filter((p) => p.exclusiveGroup === 'free-multi-sim').map((p) => p.productId).sort();
  assert.deepEqual(group, ['PROD-196', 'PROD-197'], 'written from the requirement: exactly the Local and the GCC add-on');
  const picker = read('src/capabilities/AddonsSelection/AddonsPicker.tsx');
  assert.match(picker, /x\.exclusiveGroup === group && x\.productId !== id/, 'choosing one drops the other');
  assert.match(picker, /!\(a\.exclusiveGroup && x\.exclusiveGroup === a\.exclusiveGroup\)/, 'the replaced add-on is not counted against the maximum');
  // Each provides up to 4, every one of them of its own benefit type.
  for (const [id, type] of [['PROD-196', 'Local'], ['PROD-197', 'GCC']]) {
    const p = products.find((x) => x.productId === id);
    assert.equal(m.multiSimCountOf(p), 4, id);
    assert.deepEqual(m.multiSimCoverages([p]), [type, type, type, type], `${id}: every SIM is ${type}`);
  }
});


test('each Multi SIM is named with what it covers, from its add-on\'s own record: every SIM of the Local Benefits add-on is Local and every SIM of the GCC Benefits add-on is GCC', () => {
  const by = Object.fromEntries(products.map((p) => [p.productId, p]));
  assert.deepEqual(m.multiSimCoverages([by['PROD-196']]), ['Local', 'Local', 'Local', 'Local']);
  assert.deepEqual(m.multiSimCoverages([by['PROD-197']]), ['GCC', 'GCC', 'GCC', 'GCC'], 'under GCC Benefits every Multi-SIM is GCC: Local and GCC are never mixed in one configuration');
  // Order follows the add-ons chosen; an add-on that states no coverage gives its SIM none (never guessed from a name); one that provides no SIM adds none.
  assert.deepEqual(m.multiSimCoverages([by['PROD-195'], by['PROD-197']]), [undefined, 'GCC', 'GCC', 'GCC', 'GCC']);
  assert.deepEqual(m.multiSimCoverages([{}, { multiSimCount: 2, multiSimCoverage: ['GCC'] }]), ['GCC', undefined]);
  // Whole catalogue: a stated coverage has exactly one entry per SIM the record provides.
  for (const p of products.filter((x) => x.multiSimCoverage)) assert.equal(p.multiSimCoverage.length, m.multiSimCountOf(p), p.productId);
  const comp = read('src/capabilities/AddonsSelection/MultiSimAddonSims.tsx');
  assert.match(comp, /slots\.map\(\(i\) => \(\s*<Card/, 'a separate container for each SIM in the drawer, all shown at once');
});

test('a selected Multi SIM add-on\'s card says whether its SIM is selected or generated: green when complete, amber while it is still needed', () => {
  const picker = read('src/capabilities/AddonsSelection/AddonsPicker.tsx');
  assert.match(picker, /selected && addonStatus\?\.\[a\.productId\]/, 'only a selected add-on shows it');
  assert.match(picker, /<Badge variant="warning">/, 'amber while a SIM is still needed');
  assert.match(picker, /<Badge key=\{line\} variant="success">/, 'green for each SIM that is in');
  const comp = read('src/capabilities/AddonsSelection/MultiSimAddonSims.tsx');
  for (const text of ['SIM not selected yet', 'SIMs selected']) assert.ok(comp.includes(text), text);
  // Once a SIM is in, the card carries its own line - "SIM 1 - eSIM - 8974412009900140101" - not a generic "selected" label.
  assert.match(comp, /`SIM \$\{no\} - \$\{sim\?\.simType === 'eSIM' \? 'eSIM' : 'Physical SIM'\} - \$\{/);
  assert.match(picker, /\(addonStatus\[a\.productId\]\.lines \?\? \[\]\)\.map/);
  assert.match(read('src/capabilities/AddonsSelection/step.tsx'), /addonStatus=\{values\.multiSimAddonStatus/);
});

test('a selected Multi SIM add-on\'s card opens the SIM Selection drawer instead of deselecting; Remove SIM: the first container only clears its SIM (offered once one exists), a later one always clears and removes the container; an add-on left with no SIM is deselected on close', () => {
  const picker = read('src/capabilities/AddonsSelection/AddonsPicker.tsx');
  assert.match(picker, /onOpenMultiSim && selectedIds\.includes\(a\.productId\) && multiSimCountOf\(a\) > 0 \? onOpenMultiSim\(a\.productId\) : toggle\(a\.productId\)/);
  assert.match(picker, /onClick=\{options\.length > 1 \? undefined : \(\) => press\(a\)\}/);
  const comp = read('src/capabilities/AddonsSelection/MultiSimAddonSims.tsx');
  assert.match(comp, /\(!isFirstOf\(i\) \|\| isSimComplete\(valueAt\(i\)\)\) && \(/, 'first: only once a SIM exists; later ones: always');
  assert.match(comp, /onClick=\{\(\) => \(needsConfirm\(i\) \? setConfirming\(i\) : removeSim\(i\)\)\}/, 'asks first only when a SIM would be lost');
  assert.match(comp, /title="Remove This SIM\?"/);
  const removeBody = comp.slice(comp.indexOf('const removeSim'), comp.indexOf('const needsConfirm'));
  const firstBranch = removeBody.slice(removeBody.indexOf('if (owner && r && i === r.from)'), removeBody.indexOf('// Drafts of the containers after it'));
  assert.match(firstBranch, /next\[i\] = \{\}/, 'the first only clears its SIM');
  assert.doesNotMatch(firstBranch, /splice|onRemoveAddon|setRange/, 'and keeps its container and the add-on');
  assert.match(removeBody, /next\.splice\(i, 1\)/, 'a later container is taken out');
  assert.doesNotMatch(removeBody, /setRange\(null\)|close\(\)/, 'Remove SIM never closes the drawer');
  assert.match(comp, /onRemoveAddon\(id\)/, 'an add-on left with no SIM when the drawer closes is deselected');
  assert.match(comp, /\.\.\.next\.slice\(r\.to\)/, 'its slots go with it, so another add-on\'s SIMs keep their place');
  assert.match(comp, /removed \|\| slots\.every/, 'Done is enabled after a removal');
  assert.match(comp, /<h2 className="title title-xl">/, 'the drawer title has the page heading style');
  const step = read('src/capabilities/AddonsSelection/step.tsx');
  assert.match(step, /onRemoveAddon=\{\(id\) => setValue\('addonIds'/);
  assert.match(step, /onOpenMultiSim=\{\(id\) => setValue\('multiSimOpen'/);
});



test('the drawer offers "Add Next Multi SIM": the next SIM of the same benefit type, up to what the add-on provides and 4 in all; there is no switch between Local and GCC', () => {
  const comp = read('src/capabilities/AddonsSelection/MultiSimAddonSims.tsx');
  assert.match(comp, /Add Next Multi SIM/);
  assert.match(comp, /countOf\(current as string\) < fullOf\(current as string\) && total < MULTI_SIM_MAX/);
  assert.doesNotMatch(comp, /onReplaceAddon|upgrade/, 'the benefit type is never changed from the drawer');
  assert.match(read('src/capabilities/AddonsSelection/step.tsx'), /onWantedChange=\{\(wanted\) => setValue\('multiSimWanted'/);
  // The SIM Selection page and the order ask for what was asked for, not for everything the add-on could give.
  assert.match(read('src/modules/new-connection/postpaidSteps.tsx'), /multiSimsRequested\(/);
  assert.match(read('src/modules/new-connection/submitNewConnectionOrder.ts'), /multiSimsRequested\(addons, values\.multiSimWanted/);
});


test('every eSIM gets its own serial number: from stock when there is one, else a newly generated ICCID that is never in stock nor used by another SIM of the order', async () => {
  const esim = await load('/src/components/domain/esimProfile.ts');
  const sims = JSON.parse(read('public/mock-data/sims.json'));
  const inStock = new Set(sims.flatMap((x) => [x.iccid, x.simSerial]));
  const used = [];
  for (let i = 0; i < 6; i++) {
    const p = await esim.issueEsimProfile(used);
    assert.ok(/^\d{19}$/.test(p.iccid ?? ''), `an ICCID is always given (${p.iccid})`);
    assert.ok(!used.includes(p.iccid), 'not one used by another SIM of the order');
    used.push(p.iccid);
  }
  assert.equal(new Set(used).size, 6);
  // Once the stock's one available eSIM is used, the rest are generated and none repeats a stocked serial.
  assert.ok(used.filter((x) => !inStock.has(x)).length >= 5);
});

test('a Selected Add-Ons tray item is clickable: it takes the Addons page to the add-on\'s category tab and highlights its card', () => {
  const tray = read('src/components/patterns/wizard/SelectedAddonsHeader.tsx');
  assert.match(tray, /requestAddonFocus\(addon\.productId\)/);
  const picker = read('src/capabilities/AddonsSelection/AddonsPicker.tsx');
  assert.match(picker, /setCategory\(homeTabs \? target\.addonCategory \?\? category : addonCategoryOf\(target\)\)/);
  assert.match(picker, /id=\{addonCardId\(a\.productId\)\}/);
  assert.match(picker, /classList\.add\('ring-4', 'ring-accent-border'\)/);
  const lib = read('src/lib/addonFocus.ts');
  assert.match(lib, /addon-card-\$\{productId\}/);
});

test('MultiSimAddonSims declares every hook before its early return (a hook after it crashes the page when the SIM count changes from 0)', () => {
  const comp = read('src/capabilities/AddonsSelection/MultiSimAddonSims.tsx');
  const early = comp.indexOf('if (total === 0) return null;');
  assert.ok(early > 0);
  const after = comp.slice(early);
  assert.doesNotMatch(after, /\buse(State|Effect|Ref|Memo|Callback)\(/, 'no hook after the early return');
});

test('the SIM Selection section is titled "Selected Multi-SIM (Local Benefits)" or "(GCC Benefits)" from the selected add-on\'s own coverage', () => {
  const by = Object.fromEntries(products.map((p) => [p.productId, p]));
  const first = (ids) => m.multiSimCoverages(ids.map((id) => by[id])).find(Boolean);
  assert.equal(first(['PROD-196']), 'Local');
  assert.equal(first(['PROD-197']), 'GCC');
  assert.equal(first(['PROD-195']), undefined, 'the paid add-on states none: nothing is guessed');
  assert.equal(first([]), undefined);
  assert.match(read('src/modules/new-connection/postpaidSteps.tsx'), /multiSimBenefit: multiSimBenefitFor\(products\)/);
  assert.match(read('src/capabilities/SimType/step.tsx'), /Selected Multi-SIM\{opts\.multiSimBenefit\?\.\(values\) \? ` \(\$\{opts\.multiSimBenefit\(values\)\} Benefits\)`/);
});
