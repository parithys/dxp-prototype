import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { load, close } from './harness.mjs';
import { tokensCss } from './libPaths.mjs';

// The app's source guards and the ID-capture rules. The design-system components (Button, TabStrip, Pager, Badge, Input, Select, ...) are tested
// in dxp-ui-library/tests/ui.test.mjs, which carries the same source guards over the library's sources.
after(close);

// ---- Source-level guards for the rules this app enforces (fast, no browser) -----------------------------------------
const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'src');
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) files.push(p);
  }
})(SRC);
const read = (p) => fs.readFileSync(p, 'utf8');

test('guard: every <img> has alt text', () => {
  // `[^>]` would stop at the `=>` of an inline handler, so match the whole element up to its closing `/>`.
  const bad = files.filter((f) => (read(f).match(/<img\b[\s\S]*?\/>/g) ?? []).some((el) => !/\balt=/.test(el)));
  assert.deepEqual(bad.map((f) => path.relative(SRC, f)), []);
});

// The opening tag of every <name ...> in a source string, found by walking braces and strings - a regex that stops at the
// first `>` would stop at the `=>` of an inline handler and miss the attributes after it.
function openingTags(source, name) {
  const tags = [];
  const re = new RegExp(`<${name}(?=[\\s>/])`, 'g');
  let m;
  while ((m = re.exec(source))) {
    let i = m.index + m[0].length, depth = 0, quote = null;
    for (; i < source.length; i++) {
      const c = source[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; }
      else if (depth === 0 && (c === '"' || c === "'")) quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (depth > 0 && (c === '"' || c === "'" || c === '`')) quote = c;
      else if (depth === 0 && c === '>') break;
    }
    tags.push({ attrs: source.slice(m.index + m[0].length, i), line: source.slice(0, m.index).split('\n').length });
  }
  return tags;
}

test('guard: every hand-written <button> declares a type (so it never submits a form by accident)', () => {
  const bad = [];
  for (const f of files) {
    for (const t of openingTags(read(f), 'button')) {
      if (!/\btype=/.test(t.attrs) && !t.attrs.includes('{...')) bad.push(`${path.relative(SRC, f)}:${t.line}`);
    }
  }
  assert.deepEqual(bad, []);
});

// Data tables go through DataTable (sorting, paging, sticky header, keyboard rows, one look). These three are not data
// lists, so they stay hand-written semantic tables: a promo-policy legal table with row headers, the Checkout / CAF
// two-column key-value read-back, and the dark "Monthly summary" / "Pack summary" receipts.
const NON_DATA_TABLES = [
  'capabilities/CrossSellOffers/OfferDetailsDrawer.tsx',
  'components/patterns/CheckoutSummaryTables.tsx',
  'capabilities/AddonsSelection/PrepaidAddonsStep.tsx',
];
test('guard: data tables use DataTable - a raw <table> is only for the allow-listed key-value / legal tables', () => {
  const bad = files
    .map((f) => path.relative(SRC, f))
    .filter((r) => r !== 'components/primitives/DataTable.tsx' && !NON_DATA_TABLES.includes(r))
    .filter((r) => /<table[\s>]/.test(read(path.join(SRC, r))));
  assert.deepEqual(bad, []);
});

test('guard: no red text links - links use --link', () => {
  const bad = [];
  for (const f of files) {
    const s = read(f);
    if (/<(?:a|Link|NavLink)\b[^>]*className="[^"]*\btext-accent\b(?![^"]*\bbg-)/.test(s)) bad.push(path.relative(SRC, f));
  }
  assert.deepEqual(bad, []);
});

test('guard: components use radius tokens, not Tailwind rounded-lg/xl/2xl', () => {
  const bad = files.filter((f) => !f.includes('/primitives/') && !f.includes('/components/ui/') && /\brounded-(?:md|lg|xl|2xl|3xl)\b/.test(read(f)));
  assert.deepEqual(bad.map((f) => path.relative(SRC, f)), []);
});

test('guard: colours, stacking and motion come from tokens - no hex/rgba, white/70, color-mix(), z-N or duration-N in components', () => {
  // Scans .ts as well as .tsx (class strings live in both). Comment lines are ignored. Brand artwork that
  // paints with literal SVG colours is a separate, allow-listed case and is not matched here.
  const all = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p)) all.push(p);
    }
  })(SRC);
  const rawWhiteBlack = /(?<![\w-])(?:text|bg|border|ring|divide|from|to|via|fill|stroke|outline)-(?:white|black)(?![\w-])/;
  const alphaOnToken = /(?<![\w-])(?:text|bg|border|ring|divide)-(?:accent|danger|success|warn|info|link|fg|muted|surface|bg|white|black)\/\d+/;
  const literalColour = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
  const literalRadius = /(?<![\w-])rounded-full(?![\w-])/;
  const literalScale = /(?<![\w-])-?z-(?:\d+|\[\d+\])(?![\w-])|(?<![\w-])duration-\d+(?![\w-])/;
  const bad = [];
  for (const f of all) {
    // Synthetic specimen artwork is demo data, not interface: its palette lives in src/data/synthetic.
    if (f.includes('/data/synthetic/')) continue;
    read(f).split('\n').forEach((line, i) => {
      if (/^\s*(?:\/\/|\*|\/\*|\{\/\*)/.test(line)) return;
      if (literalColour.test(line.replace(/\/\/.*$/, '')) || literalScale.test(line) || literalRadius.test(line)) bad.push(`${path.relative(SRC, f)}:${i + 1}`);
      if (rawWhiteBlack.test(line) || alphaOnToken.test(line) || /color-mix\(/.test(line)) bad.push(`${path.relative(SRC, f)}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('guard: no console.log or debugger left in the app', () => {
  const bad = files.filter((f) => /\bconsole\.log\(|\bdebugger\b/.test(read(f)));
  assert.deepEqual(bad.map((f) => path.relative(SRC, f)), []);
});

// Dates are dd/mm/yyyy everywhere: only lib/format.ts may format a date, so no screen can show another style.
test('no source formats dates outside lib/format.ts', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  const bad = walk('src')
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('lib/format.ts') && !f.includes('data/synthetic'))
    .filter((f) => /toLocaleDateString\(|Intl\.DateTimeFormat|dateStyle:|month: '(short|long)'/.test(readFileSync(f, 'utf8').replace(/weekday: 'long'/g, '')))
    .filter((f) => !/Dashboard|TelesalesOrdersTicketsSection|appointmentModel/.test(f));
  assert.deepEqual(bad, []);
});

// ID capture (the Scan Identity Document component): the reader on the web, never an upload there; on a tablet Open Camera and Upload, never the reader.
test('idCaptureOptions: web - the reader and no upload (with no reader, nothing); tablet - camera and upload whatever the reader', async () => {
  const { idCaptureOptions } = await load('/src/components/domain/idUploadModel.ts');
  assert.deepEqual(idCaptureOptions('web', true), { scan: true, upload: false, camera: false });
  assert.deepEqual(idCaptureOptions('tablet', true), { scan: false, upload: true, camera: true });
  assert.deepEqual(idCaptureOptions('web', false), { scan: false, upload: false, camera: false });
  assert.deepEqual(idCaptureOptions('tablet', false), { scan: false, upload: true, camera: true });
});

test('ID capture on a tablet: IdFileUpload shows Open Camera and Upload, never the reader passed as `leading`', async () => {
  const { IdFileUpload } = await load('/src/components/domain/IdFileUpload.tsx');
  const { DEVICE_LABEL } = await import('dxp-ui');
  assert.ok(DEVICE_LABEL.tablet);
  const src = fs.readFileSync('src/components/domain/IdFileUpload.tsx', 'utf8');
  assert.match(src, /\{scan && leading\}/, 'the reader only where the rule offers it');
  assert.match(src, /\{camera && \(\s*<CameraCaptureButton/, 'the camera where the rule offers it');
  assert.equal(typeof IdFileUpload, 'function');
  assert.match(fs.readFileSync('src/components/domain/PassportScanSections.tsx', 'utf8'), /\{!capture\.camera && \(\s*<IdFileUpload/, 'Passport on a tablet: each side has its own camera and upload, no second whole-document one');
});

// Special Discounts Identification keeps its own step and model, and draws the Office ID capture from the shared ID upload components (it used to carry
// forked copies of six of them). Its one difference from the other ID steps - the reader on every device - is the `readerEverywhere` option.
test('Special Discounts Identification shares the ID capture components and keeps its capture rule (the reader on every device, no upload)', async () => {
  const dir = 'src/capabilities/SpecialDiscountsIdentification';
  const own = fs.readdirSync(dir).filter((n) => /\.tsx?$/.test(n));
  for (const forked of ['CompanySearchInput', 'IdFileUpload', 'PassportScanSections', 'QidImageUpload', 'ScanFailureNotice', 'ScannedIdPreview', 'idUploadModel', 'qidImageUploadModel'])
    assert.ok(!own.some((n) => n.startsWith(forked)), `${forked} is the shared component, not a copy`);
  assert.match(fs.readFileSync(`${dir}/SpecialDiscountsStep.tsx`, 'utf8'), /<QidImageUpload[\s\S]*readerEverywhere/);
  const { idCaptureOptions } = await load('/src/components/domain/idUploadModel.ts');
  assert.deepEqual(idCaptureOptions('web', true, false, true), { scan: true, upload: false, camera: false });
  assert.deepEqual(idCaptureOptions('tablet', true, false, true), { scan: false, upload: true, camera: true });
  assert.deepEqual(idCaptureOptions('web', false, false, true), { scan: false, upload: false, camera: false });
  assert.deepEqual(idCaptureOptions('tablet', false, false, true), { scan: false, upload: true, camera: true });
  const m = await load('/src/capabilities/SpecialDiscountsIdentification/specialDiscountsModel.ts');
  assert.deepEqual(m.TYPE_OPTIONS.map((o) => o.label), ['Standard Customer', 'Consumer B2B2C', 'Retiree', 'MADA']);
});

test('idCaptureOptions: a step that asks for both (the Customer Representative ID) offers scan and upload', async () => {
  const { idCaptureOptions } = await load('/src/components/domain/idUploadModel.ts');
  assert.deepEqual(idCaptureOptions('web', true, true), { scan: true, upload: true, camera: false });
  assert.deepEqual(idCaptureOptions('tablet', true, true), { scan: false, upload: true, camera: true });
});




test('ID upload set: files add up (all at once or one after another) and each can be deleted', async () => {
  const { applyIdUpload, removeIdUploadAt } = await load('/src/components/domain/idUploadModel.ts');
  let v = applyIdUpload({ source: 'scan', frontScanned: true, backScanned: true }, { sides: 'set', files: [{ name: 'a.pdf', image: 'A' }, { name: 'b.pdf', image: 'B' }] });
  assert.deepEqual(v.uploads.map((f) => f.name), ['a.pdf', 'b.pdf']);
  assert.equal(v.source, 'upload');
  assert.ok(v.frontScanned && v.backScanned, 'the document counts as captured');
  v = applyIdUpload(v, { sides: 'set', files: [{ name: 'c.pdf', image: 'C' }] });
  assert.deepEqual(v.uploads.map((f) => f.name), ['a.pdf', 'b.pdf', 'c.pdf']);
  v = removeIdUploadAt(v, 0);
  assert.deepEqual(v.uploads.map((f) => f.name), ['b.pdf', 'c.pdf']);
  assert.equal(v.frontFile, 'b.pdf');
  v = removeIdUploadAt(removeIdUploadAt(v, 0), 0);
  assert.ok(!v.frontScanned && !v.source, 'deleting the last file leaves nothing');
});

test('card hover is a pale fill and the form fields\' focus border colour: no card gains a ring or shadow on hover', () => {
  const offenders = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p)) {
        fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
          if (/hover:(ring|shadow-\[inset_0_0_0_1px)|hover:border-\[var\(--field-card/.test(line)) offenders.push(`${path.relative('src', p)}:${i + 1}`);
        });
      }
    }
  })('src');
  assert.deepEqual(offenders, [], 'a card hover changes the fill (hover:bg-[var(--field-card-hover-bg)]) and the border colour (hover:border-[var(--field-focus-border)]), not a ring or shadow');
  assert.match(fs.readFileSync('src/modules/product-lines/JourneyCard.tsx', 'utf8'), /hover:border-\[var\(--field-focus-border\)\]/);
  assert.doesNotMatch(tokensCss(), /--field-card-hover-border/);
});
