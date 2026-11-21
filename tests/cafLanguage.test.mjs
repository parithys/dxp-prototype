import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { boot, load, close } from './harness.mjs';
import { uiComponentsCss, tokensCss } from './libPaths.mjs';

globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};

// The signing screen's wording - headings, labels, Terms & Conditions - is the BUSINESS's, one document per journey, party and language (CAF_<journey>_<party>_<language>.docx),
// converted to public/config/caf-content/. Nothing Arabic is written in the app and nothing is translated by it.
let lang, ctx, provider, terms, engine, model;
before(async () => {
  await boot();
  lang = await load('/src/data/cafLanguage.ts');
  ctx = await load('/src/components/patterns/cafLanguageContext.ts');
  provider = await load('/src/components/patterns/cafLanguage.tsx');
  terms = await load('/src/components/patterns/CafTerms.tsx');
  engine = await load('/src/engines/cafContentEngine.ts');
  model = await load('/src/components/patterns/cafTermsModel.ts');
});
after(close);

const ARABIC = /[؀-ۿ]/;
const read = (f) => fs.readFileSync(f, 'utf8');
const SCRIPT = 'reference/scripts/build_caf_content.py';

test('no Arabic is written in the app: the content is the business\'s, only the toggle names the language for itself', () => {
  for (const f of ['public/mock-data/tnc-full-text.json', 'public/mock-data/tnc-summary-bullets.json', 'src/data/prepaidActivation.ts', 'src/data/secondaryContactTerms.ts', 'src/components/patterns/CafTerms.tsx', 'src/components/patterns/CafSignatureCapture.tsx', 'src/capabilities/CafSignature/CafSignature.tsx', 'src/lib/signedCafImage.ts'])
    assert.doesNotMatch(read(f), ARABIC, `${f} carries no authored Arabic`);
  const language = read('src/data/cafLanguage.ts').split('\n').filter((l) => ARABIC.test(l));
  assert.equal(language.length, 1, 'the one Arabic in the data layer is the language\'s own name on the toggle');
  assert.match(language[0], /label: 'العربية'/);
  for (const [key, v] of Object.entries(lang.CAF_LABELS)) assert.ok(typeof v === 'string' && v.trim() && !ARABIC.test(v), `${key}: the built-in label is English`);
  for (const f of ['src/data/cafLanguage.ts', 'src/engines/cafContentEngine.ts', 'src/components/patterns/cafLanguage.tsx', 'src/capabilities/CafSignature/CafSignature.tsx'])
    assert.doesNotMatch(read(f), /translate\.|translation api|googleapis/i, `${f} translates nothing`);
});

test('the documents are named per journey, party and language, as the business names them', () => {
  assert.equal(lang.cafContentName('postpaid', 'primary', 'en'), 'CAF_postpaid_primary_english');
  assert.equal(lang.cafContentName('postpaid', 'primary', 'ar'), 'CAF_postpaid_primary_arabic');
  assert.equal(lang.cafContentName('postpaid', 'secondary', 'en'), 'CAF_postpaid_secondary_english');
  assert.equal(lang.cafContentName('postpaid', 'secondary', 'ar'), 'CAF_postpaid_secondary_arabic');
  assert.equal(lang.cafContentName('prepaid', 'primary', 'ar'), 'CAF_prepaid_primary_arabic');
  assert.deepEqual(lang.CAF_LANGUAGES.map((l) => [l.key, l.dir]), [['en', 'ltr'], ['ar', 'rtl']], 'English first, Arabic right to left');
});

// ---- the converter: a .docx the business provides -> the configuration file the app loads ----
function writeDocx(file, bodyXml) {
  const py = `import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1],'w')\nz.writestr('word/document.xml',sys.argv[2])\nz.close()`;
  const doc = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`;
  execFileSync('python3', ['-c', py, file, doc]);
}
const p = (style, text) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t>${text}</w:t></w:r></w:p>`;
const table = (rows) => `<w:tbl>${rows.map((r) => `<w:tr>${r.map((c) => `<w:tc><w:p><w:r><w:t>${c}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'caf-content-'));
const run = (...args) => spawnSync('python3', [SCRIPT, ...args], { encoding: 'utf8' });

test('the converter reads the heading, the sections and the labels table of a document, and names the file for it', () => {
  const src = tmp(), out = tmp();
  writeDocx(path.join(src, 'CAF_postpaid_primary_arabic.docx'), [
    p('Title', 'DOC-HEADING'), p('Heading1', 'Section One'), p('', 'First paragraph.'), p('', 'Second paragraph.'), p('Heading1', 'Section Two'), p('', 'Only paragraph.'),
    p('Heading1', 'Labels'), table([['primaryContact', 'PRIMARY-LABEL'], ['pleaseSign', 'SIGN-LABEL']]),
  ].join(''));
  const r = run('--source', src, '--out', out);
  assert.equal(r.status, 0, r.stderr);
  const doc = JSON.parse(read(path.join(out, 'CAF_postpaid_primary_arabic.json')));
  assert.deepEqual(doc, {
    journey: 'postpaid', party: 'primary', language: 'ar', source: 'CAF_postpaid_primary_arabic.docx', heading: 'DOC-HEADING',
    sections: [{ title: 'Section One', body: 'First paragraph. Second paragraph.' }, { title: 'Section Two', body: 'Only paragraph.' }],
    labels: { primaryContact: 'PRIMARY-LABEL', pleaseSign: 'SIGN-LABEL' },
  });
});

test('the converter refuses a wrongly named document and an unknown label key, and --check writes nothing', () => {
  const src = tmp(), out = tmp();
  writeDocx(path.join(src, 'CAF_postpaid_primary_french.docx'), p('Title', 'X'));
  let r = run('--source', src, '--out', out);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not named CAF_/);
  fs.rmSync(path.join(src, 'CAF_postpaid_primary_french.docx'));
  writeDocx(path.join(src, 'CAF_postpaid_secondary_english.docx'), [p('Title', 'X'), p('Heading1', 'Labels'), table([['notALabel', 'x']])].join(''));
  r = run('--source', src, '--out', out);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown label key\(s\) notALabel/);
  fs.rmSync(path.join(src, 'CAF_postpaid_secondary_english.docx'));
  writeDocx(path.join(src, 'CAF_postpaid_secondary_english.docx'), p('Title', 'OK'));
  r = run('--source', src, '--out', out, '--check');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(fs.readdirSync(out), [], '--check writes nothing');
  assert.equal(run().status, 0, 'the real folders: with no document provided there is nothing to convert, and nothing wrong');
});

test('the loader returns the business\'s document, and nothing (not an error) where it has not been provided', async () => {
  assert.equal(await engine.loadCafContent('prepaid', 'primary', 'ar'), undefined);
  assert.equal(await engine.loadCafContent('prepaid', 'secondary', 'en'), undefined);
  const demo = await engine.loadCafContent('postpaid', 'primary', 'ar');
  assert.equal(demo.demo, true);
  assert.equal(demo.sections.length, 5);
});

// ---- the screen reads them ----
const sections = [{ sectionId: 'TNC-1', title: 'Built-in Title', body: 'Built-in body.' }];
const panel = (supplementaryTerms) => React.createElement(terms.FullTerms, { enabled: true, sections, supplementaryTerms }, React.createElement('i', null, 'sign'));
const withContent = (content, node, l = 'ar') => html(React.createElement(provider.CafLanguageProvider, { lang: l, content, direction: true }, node));

test('with no document the built-in English shows (in either language); a provided document replaces it - heading, sections and labels', () => {
  const builtIn = html(panel());
  assert.match(builtIn, /Built-in Title/);
  assert.match(builtIn, /Key Terms &amp; Conditions/);
  assert.match(withContent({}, panel()), /Built-in Title/, 'Arabic chosen but not provided: English, never blank');
  const primary = { journey: 'postpaid', party: 'primary', language: 'ar', heading: 'DOC-HEADING', sections: [{ title: 'Doc Section', body: 'Doc wording.' }], labels: { primaryContact: 'PRIMARY-LABEL' } };
  const out = withContent({ primary }, panel());
  assert.match(out, /DOC-HEADING/);
  assert.match(out, /Doc Section/);
  assert.match(out, /Doc wording\./);
  assert.doesNotMatch(out, /Built-in Title|Key Terms &amp; Conditions/, 'the document replaces the built-in wording');
  assert.match(out, /dir="rtl"/);
  assert.equal(ctx.cafLanguageValue('ar', { primary }).t('primaryContact'), 'PRIMARY-LABEL');
  assert.equal(ctx.cafLanguageValue('ar', { primary }).t('pleaseSign'), 'Please Sign', 'a label the document does not give is the built-in one');
  assert.equal(ctx.cafLanguageValue('en').t('save'), 'Save Signature');
});

test('the secondary contact\'s document supplies the Supplementary terms, their heading and the contact label', () => {
  const supplementary = { terms: [{ title: 'Built-in Supplementary', body: 'x' }], primaryContactName: 'Primary Name', secondaryContactName: 'Secondary Name' };
  assert.match(html(panel(supplementary)), /Built-in Supplementary/);
  const secondary = { journey: 'postpaid', party: 'secondary', language: 'ar', heading: 'SECONDARY-HEADING', sections: [{ title: 'Sec Section', body: 'Sec wording.' }], labels: { secondaryContact: 'SECONDARY-LABEL' } };
  const out = withContent({ secondary }, panel(supplementary));
  assert.match(out, /SECONDARY-HEADING/);
  assert.match(out, /Sec Section/);
  assert.match(out, /SECONDARY-LABEL/);
  assert.doesNotMatch(out, /Built-in Supplementary/);
  assert.match(out, /Secondary Name/, 'the contact\'s own name is data, not content');
});

test('the toggle names the two languages; the pop-up chooses, the agent\'s screen reads the English documents', () => {
  const toggle = html(React.createElement(provider.CafLanguageToggle, { lang: 'en', onChange() {} }));
  assert.match(toggle, /English/);
  assert.match(toggle, /العربية/);
  const sig = read('src/capabilities/CafSignature/CafSignature.tsx');
  assert.match(sig, /const inCustomerPopup = useCustomerPopup\(\)/);
  assert.match(sig, /useState<CafLanguage>\('en'\)/, 'English by default');
  assert.match(sig, /inCustomerPopup \? chosenLanguage : 'en'/, 'the agent screen is always English');
  assert.match(sig, /loadCafContent\(cafJourney, 'primary', language\), loadCafContent\(cafJourney, 'secondary', language\)/, 'both parties\' documents, in the language');
  assert.match(sig, /direction=\{inCustomerPopup\}/, 'only the pop-up is laid out right to left');
  assert.match(sig, /className="mirror-corner">\s*<CafLanguageToggle/, 'the toggle sits at the top right, in the title row');
  assert.match(read('src/components/patterns/wizard/CustomerMirrorPanel.tsx'), /relative w-full p-6/, 'the card is the corner\'s positioning context');
  assert.match(read('src/hooks/useCustomerPopup.ts'), /mirror'\) === '1'/);
  const capture = read('src/components/patterns/CafSignatureCapture.tsx');
  assert.match(capture, /termsLanguage: lang/);
  assert.match(capture, /content\.primary\?\.sections \?\? sections/, 'the signed form carries the business\'s wording');
});

test('the key-information bullets are the configured templates, filled with the order\'s figures', () => {
  const templates = JSON.parse(read('public/mock-data/tnc-summary-bullets.json'));
  const out = model.buildTncBullets({ planCommitmentMonths: 12, starLockInMonths: 24, discountName: 'Loyalty', discountDurationMonths: 6, hrnAdvanceQar: 500 }, templates);
  assert.equal(out.length, 4);
  assert.match(out[0], /12-month minimum commitment/);
  assert.ok(out.every((b) => !/\{\w+\}/.test(b)), 'every placeholder filled');
});

test('DEMO: Arabic stand-ins for the primary and secondary terms sit in the config folder (not in code), flagged as demo and replaced by the business\'s own documents', () => {
  const primary = JSON.parse(read('public/config/caf-content/CAF_postpaid_primary_arabic.json'));
  const secondary = JSON.parse(read('public/config/caf-content/CAF_postpaid_secondary_arabic.json'));
  const english = JSON.parse(read('public/mock-data/tnc-full-text.json'));
  assert.equal(primary.sections.length, english.length, 'one Arabic section for each built-in primary section, in the same order');
  assert.equal(secondary.sections.length, 4, 'one for each of the four supplementary terms');
  for (const d of [primary, secondary]) {
    assert.equal(d.demo, true);
    assert.equal(d.language, 'ar');
    assert.match(d.source, /DEMO/);
    for (const s of d.sections) assert.ok(ARABIC.test(s.title) && ARABIC.test(s.body), s.title);
  }
  assert.ok(!('heading' in primary) && !('labels' in primary), 'only the content shown is supplied; headings and labels stay the built-in until the business provides them');
});

test('the terms sit in a dedicated fixed-height container that scrolls, with the contact line outside it', () => {
  const src = read('src/components/patterns/CafTerms.tsx');
  assert.equal((src.match(/caf-terms-scroll/g) ?? []).length, 4, 'the general, supplementary, single-column and its iPAY terms (the Secondary Contact layout\'s iPAY card is as tall as its text)');
  assert.doesNotMatch(src, /scrollMode|max-h-\[/, 'one behaviour: fixed height, scrolling inside');
  const css = uiComponentsCss();
  assert.match(css, /\.caf-terms-scroll \{\s*@apply h-\[var\(--size-caf-terms-h\)\] overflow-y-scroll py-6;/, 'padding above and below; the vertical scrollbar always shown');
  assert.match(css, /\.caf-terms-scroll::-webkit-scrollbar \{\s*width: var\(--size-scrollbar\);/, 'a classic scrollbar, so it stays visible');
  assert.match(read('src/components/patterns/wizard/CustomerMirrorPanel.tsx'), /step\?\.key === 'caf' \? 'sm:min-h-14'/, 'the title row is tall enough for the language toggle: no overlap');
  assert.match(tokensCss(), /--size-caf-terms-h: 21\.875rem;/);
  const twoCol = src.slice(src.indexOf('if (supplementaryTerms'), src.indexOf('if (signed)'));
  assert.ok(twoCol.indexOf("t('primaryContact')") > twoCol.indexOf('caf-terms-scroll') && twoCol.indexOf("t('primaryContact')") > twoCol.indexOf('</div>\n              <div className="pad-row">'), 'the contact line follows the scrolling container');
});

test('each block of text takes its own direction, so an English sentence in the Arabic layout keeps its full stop at its end (and Arabic reads right to left)', () => {
  const termsSrc = read('src/components/patterns/CafTerms.tsx');
  const capture = read('src/components/patterns/CafSignatureCapture.tsx');
  assert.ok((termsSrc.match(/dir="auto"/g) ?? []).length >= 8, 'the section titles and wording, the key information');
  for (const must of ["<p dir=\"auto\" className=\"body-text\">{t('understandCopy')}</p>", "{t('marketing')}</p>", 'dir="auto" className="body-text">\n                    {fullTerms ? t(\'readAgreedFull\')'])
    assert.ok(capture.includes(must), must.slice(0, 60));
  assert.match(capture, /<p dir="auto" className=\{`body-text mt-3/);
  const out = html(React.createElement(provider.CafLanguageProvider, { lang: 'ar', direction: true }, React.createElement(terms.FullTerms, { enabled: true, sections: [{ sectionId: 'A', title: 'English Title', body: 'English body.' }] }, React.createElement('i', null, 'x'))));
  assert.match(out, /<h4 dir="auto"[^>]*>English Title<\/h4>/);
  assert.match(out, /<p dir="auto"[^>]*>English body\.<\/p>/);
});

test('the statements, agreements and signature are always left-aligned, laid out left to right, in either language', () => {
  const capture = read('src/components/patterns/CafSignatureCapture.tsx');
  assert.match(capture, /<div dir="ltr" className=\{`left-aligned \$\{fullTerms/);
  assert.match(uiComponentsCss(), /\.left-aligned \{\s*@apply text-left;/);
});

test('Arabic terms are set at 16px (the body size), English at the caption size', () => {
  const css = uiComponentsCss();
  assert.match(css, /:lang\(ar\) \.caf-terms-scroll p,\s*:lang\(ar\) \.caf-terms-scroll li \{\s*font-size: var\(--fs-body\);/);
  assert.match(tokensCss(), /--fs-body: 16px;/);
  assert.match(read('src/components/patterns/cafLanguage.tsx'), /lang=\{lang\}/, 'the Arabic layout is marked lang="ar", which the rule keys on');
});
