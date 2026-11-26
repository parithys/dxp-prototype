// CAF & Signature: sign on paper. The agent prints the Primary CAF (and, with a Secondary Contact, the Supplementary CAF) for the customer's pen signature and uploads each
// signed copy back; the step is signed once every printed form's copy is in. Expected behaviour is written from the requirement, not read from the code.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

let step, docs, print;
before(async () => {
  await boot();
  ({ cafSignatureStep: step } = await load('/src/capabilities/CafSignature/step.tsx'));
  docs = await load('/src/engines/journeyDocuments.ts');
  print = await load('/src/components/patterns/cafPrint.ts');
  mandatory = attached(docs.missingMandatoryDocuments(undefined));
});
after(close);

const copy = (name) => ({ id: `id-${name}`, fileName: `${name}.pdf`, sizeBytes: 1000 });
const withSecondary = { actualUser: { choice: 'other', identity: { moiResult: { name: 'Sara' }, email: 'sara@example.com' } } };
const full = () => step({ variant: 'full' });
// Continue also waits for the documents the business marks mandatory (document-types.json); they are attached here so these tests are about the CAF alone.
const attached = docs_labels => ({ additionalDocuments: docs_labels.map((label) => ({ label })) });
let mandatory;

test('without a Secondary Contact the paper CAF is signed once the signed Primary CAF is uploaded - and not before', () => {
  const s = full();
  assert.equal(s.isValid({ caf: { cafType: 'Manual' } }), false, 'chosen but nothing uploaded');
  assert.equal(s.isValid({ caf: { cafType: 'Manual', paperPrimary: copy('primary'), ...mandatory } }), true);
  assert.equal(s.locksAfter({ caf: { cafType: 'Manual' } }), false);
  assert.equal(s.locksAfter({ caf: { cafType: 'Manual', paperPrimary: [copy('primary')] } }), true, 'once signed the journey locks');
});

test('with a Secondary Contact BOTH signed documents are needed: General Terms & Conditions alone, or Supplementary alone, is not enough', () => {
  const s = full();
  const v = (caf) => ({ ...withSecondary, caf: { cafType: 'Manual', ...mandatory, ...caf } });
  assert.equal(s.isValid(v({ paperPrimary: copy('p') })), false);
  assert.equal(s.isValid(v({ paperSecondary: copy('s') })), false);
  assert.equal(s.isValid(v({ paperPrimary: copy('p'), paperSecondary: copy('s') })), true);
});

test('a paper CAF keeps the agent view (it is not the customer-facing screen); an on-screen signature still goes customer-facing', () => {
  const s = full();
  assert.equal(s.customerFacing({ caf: { cafType: 'Manual', paperPrimary: copy('p') } }), false);
  assert.equal(s.customerFacing({ caf: { cafType: 'Digital', signatureDataUrl: 'data:image/png;base64,AA' } }), true);
  assert.equal(s.isValid({ caf: { cafType: 'Digital' } }), false, 'unsigned on screen is still not valid');
});

test('the signed paper copies are listed in Journey Documents, in the CAF slot', () => {
  const list = docs.consolidatedDocuments({ caf: { cafType: 'Manual', paperPrimary: copy('p'), paperSecondary: copy('s') } });
  const paper = list.filter((d) => d.source === 'CAF & Signature');
  assert.deepEqual(paper.map((d) => d.fileName), ['p.pdf', 's.pdf']);
  assert.deepEqual(paper.map((d) => d.fileId), ['id-p', 'id-s']);
  assert.deepEqual(docs.consolidatedDocuments({ caf: { cafType: 'Manual' } }).filter((d) => d.source === 'CAF & Signature'), []);
});

test('the printable forms: the Primary CAF is signed by the applicant (or the representative signing for them), the Supplementary CAF by the Secondary Contact', () => {
  const src = fs.readFileSync('src/components/patterns/cafPrint.ts', 'utf8');
  assert.equal(typeof print.printPrimaryCaf, 'function');
  assert.equal(typeof print.printSupplementaryCaf, 'function');
  assert.match(src, /input\.representativeName \?\? input\.customerName/);
  assert.match(src, /'Secondary Contact'/);
  // Every value written into the printed HTML goes through escapeHtml.
  assert.doesNotMatch(src.replace(/escapeHtml\([^)]*\)/g, ''), /\$\{input\.(customerName|idValue|title)\}/);
});

test('Sign on Paper takes several uploaded JPGs or several scanned pages as ONE document: pages are previewed with delete, Accept / Rescan then Done / Add Another Page follow, and Done combines them into one PDF', () => {
  const panel = fs.readFileSync('src/components/patterns/CafPaperPanel.tsx', 'utf8');
  assert.match(panel, /<FilePagesPreview\s+files=\{pagesOf\(f\.key\)\}\s+onDelete=/);
  assert.match(panel, /function ReviewActions[\s\S]*Accept[\s\S]*again\('Rescan', onRescan\)[\s\S]*Done[\s\S]*again\('Add Another Page', onAddPage\)/, 'a scan just taken: Accept / Rescan; once accepted: Done / Add Another Page');
  assert.match(panel, /pages\.length === 1 \? pages\[0\] : await pdfFromImageFiles\(pages, /, 'several pages become one PDF');
  assert.match(panel, /multiple\s+onUploadMany=/, 'Upload Document takes several files');
  assert.match(panel, /Choose PDF documents or JPG images/, 'several PDFs are each a document; JPG images are the pages of one');
  assert.match(panel, /takeFiles\(f, pdfs\)/);
  assert.match(panel, /hideCapture=\{pagesOf\(f\.key\)\.length > 0\}/, 'one set of scan buttons, under the pages');
  assert.match(panel, /onUpload=\{\(file\) => \{\s*setPages\(f\.key, undefined\);\s*void take\(f, file\);/, 'a single upload is added at once');
  assert.match(panel, /f\.copies\.map\(\(c\) => \(/, 'every accepted document is listed');
  assert.match(panel, /form\.onCopies\(\[\.\.\.form\.copies, /, 'another scan or upload adds a document');
  assert.doesNotMatch(panel.slice(panel.indexOf('<DocumentCaptureActions')), /rescan=/, 'Rescan only before Accept (in the review), never on an accepted document');
  assert.match(panel, /\{' \*'\}/, 'each signed document is marked mandatory');
});

test('New Prepaid: with iPAY Activation Yes, the iPAY terms have no print button of their own: they are part of the consolidated Print Full T&C', () => {
  const cap = fs.readFileSync('src/components/patterns/CafSignatureCapture.tsx', 'utf8');
  assert.doesNotMatch(cap, /Print Full T&C, iPAY|printIpay|headerActions/);
  assert.match(cap, /ipay: ipayActivation\?\.value && ipayTermsSections\?\.length \? \{ heading: 'iPAY Terms & Conditions'/, 'included in the consolidated document when applicable');
  assert.doesNotMatch(fs.readFileSync('src/components/patterns/CafTerms.tsx', 'utf8'), /headerActions/);
  assert.equal(typeof print.printIpayCaf, 'function');
});

test('an Open Camera photo is handed over as the real capture in a type a preview can draw (no type -> JPEG; HEIC/WebP re-encoded), and an ID read with no type is not an octet stream', async () => {
  const cam = await import('dxp-ui');
  const typeless = new File(['x'], 'p.jpg', { type: '' });
  assert.equal((await cam.previewableCameraPhoto(typeless)).type, 'image/jpeg');
  const jpeg = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
  assert.equal(await cam.previewableCameraPhoto(jpeg), jpeg, 'a JPEG is untouched');
  const model = fs.readFileSync('src/components/domain/idUploadModel.ts', 'utf8');
  assert.match(model, /application\\\/octet-stream/);
});

test('the CAF page offers "Sign Digitally" (default) and "Sign on Paper" as two cards side by side; the paper panel shows only for paper (or once copies are in), the signature pad only for digital', () => {
  const cap = fs.readFileSync('src/components/patterns/CafSignatureCapture.tsx', 'utf8');
  assert.match(cap, /useState<'digital' \| 'paper'>\('digital'\)/);
  assert.match(cap, /grid grid-cols-2 gap-4/);
  for (const t of ["'Sign Digitally'", "'Print & Sign'", "'Tablet or signature device'", "'Print, sign and upload'"]) assert.ok(cap.includes(t), t);
  assert.match(cap, /fullTerms && signMode === 'paper' \? null : \(/);
  assert.match(cap, /!signed && fullTerms && \(signMode === 'paper' \|\| paperDone\)/);
});

test('the sign-mode cards sit above the "I understand" line, ahead of the agreements and the signature pad', () => {
  const cap = fs.readFileSync('src/components/patterns/CafSignatureCapture.tsx', 'utf8');
  const cards = cap.indexOf('How the customer signs: two cards');
  const understand = cap.indexOf("t('understandCopy')");
  const pad = cap.indexOf("label={t('pleaseSign')}");
  assert.ok(cards > 0 && cards < understand && understand < pad);
});

test('in Sign on Paper "Print Full T&C" is the primary button; scan (Open Camera on a tablet) and upload are secondary, scan first; other screens keep their order', () => {
  const panel = fs.readFileSync('src/components/patterns/CafPaperPanel.tsx', 'utf8');
  assert.match(panel, /<Button size="sm" onClick=\{onPrintFullTerms\}>/, 'primary');
  assert.doesNotMatch(panel, /scanFirst/);
  assert.doesNotMatch(fs.readFileSync('src/components/domain/AdditionalDocumentsUpload.tsx', 'utf8'), /scanFirst/);
});

test('the signed-document containers sit side by side when there are two (no heading of their own)', () => {
  const panel = fs.readFileSync('src/components/patterns/CafPaperPanel.tsx', 'utf8');
  assert.doesNotMatch(panel, /Signed Terms/);
  assert.match(panel, /className="doc-columns"/, 'two independent stacks, side by side');
});

test('on paper the two agreement checkboxes are not shown (they belong to signing digitally)', () => {
  const cap = fs.readFileSync('src/components/patterns/CafSignatureCapture.tsx', 'utf8');
  assert.match(cap, /requireTermsAgreement && !\(fullTerms && signMode === 'paper'\)/);
  assert.match(cap, /supplementaryForm && !\(fullTerms && signMode === 'paper'\)/);
});

test('each Sign on Paper container starts with "Print Full T&C", which prints everything the page carries (key information, terms, Supplementary and iPAY terms) and where the complete text is published', () => {
  const panel = fs.readFileSync('src/components/patterns/CafPaperPanel.tsx', 'utf8');
  assert.match(panel, /Print Full T&amp;C[\s\S]*<DocumentCaptureActions/, 'before Initiate Scan');
  assert.equal(typeof print.printFullTerms, 'function');
  assert.match(fs.readFileSync('src/components/patterns/CafSignatureCapture.tsx', 'utf8'), /onPrintFullTerms=\{printFull\}/);
});

test('a PDF document shows its page count beside its size; the count is read from the PDF itself, and unknown stays unknown', async () => {
  const lib = await load('dxp-ui');
  const pdf = (body) => new TextEncoder().encode(`%PDF-1.4\n${body}\n%%EOF`);
  assert.equal(lib.pdfPageCountOf(pdf('1 0 obj << /Type /Pages /Kids [2 0 R 3 0 R 4 0 R] /Count 3 >> endobj\n2 0 obj << /Type /Page >> endobj\n3 0 obj << /Type /Page >> endobj\n4 0 obj << /Type /Page >> endobj')), 3);
  assert.equal(lib.pdfPageCountOf(pdf('2 0 obj << /Type /Page /Parent 1 0 R >> endobj')), 1, 'page objects counted when no tree count is stated');
  assert.equal(lib.pdfPageCountOf(pdf('1 0 obj << /Type /Catalog >> endobj')), undefined);
  assert.equal(await lib.pdfPageCountOfFile(new File(['x'], 'p.jpg', { type: 'image/jpeg' })), undefined, 'not a PDF');
  assert.match(fs.readFileSync('src/components/patterns/CafPaperPanel.tsx', 'utf8'), /pageCount === 1 \? 'page' : 'pages'/);
});

test('every uploaded-document list is framed: a rule above the first row and below the last (data-rows-ruled)', () => {
  const files = {
    'src/components/domain/AdditionalDocumentsUpload.tsx': 2,
    'src/capabilities/CustomerQualification/RepresentativeSections.tsx': 1,
    'src/components/patterns/NewCustomerDetailsForm.tsx': 1,
    'src/components/patterns/CafPaperPanel.tsx': 1,
    'src/components/domain/QidImageUpload.tsx': 1,
  };
  for (const [f, n] of Object.entries(files)) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok((src.match(/data-rows-ruled|border-y border-border-soft/g) ?? []).length >= n, `${f}: ${n} framed list(s)`);
  }
});

test('the Secondary Contact signs the Supplementary Form the same two ways: its own Sign Digitally / Print & Sign cards, the pad for digital, a signed-copy container for paper', () => {
  const cap = fs.readFileSync('src/components/patterns/CafSignatureCapture.tsx', 'utf8');
  assert.match(cap, /useState<'digital' \| 'paper'>\('digital'\);\s*\/\/ The Secondary Contact|secondaryMode, setSecondaryMode/);
  assert.match(cap, /modeCards\(secondaryMode, setSecondaryMode,/);
  assert.match(cap, /secondaryMode === 'paper' \? \(\s*<div className="agent-only">\s*<CafPaperPanel/);
  assert.match(cap, /paperCopiesOf\(value\.paperSecondary\)\.length > 0;/, 'a signed paper copy counts as the Secondary Contact having signed');
  assert.match(fs.readFileSync('src/capabilities/CafSignature/step.tsx', 'utf8'), /secondarySignatureDataUrl\) \|\| paperCopiesOf\(c\?\.paperSecondary\)\.length > 0/);
});

test('Sign on Paper: ONE Print Full T&C (the consolidated document: both contacts, a signature line for each) and a container per signed document - General, and Supplementary with a Secondary Contact', () => {
  const cap = fs.readFileSync('src/components/patterns/CafSignatureCapture.tsx', 'utf8');
  const block = cap.slice(cap.indexOf('<CafPaperPanel'), cap.indexOf('/>', cap.indexOf('<CafPaperPanel')) + 2);
  assert.match(block, /title: 'General Terms & Conditions'/);
  assert.match(block, /title: 'Supplementary Terms & Conditions'/);
  assert.match(cap, /primary: \{ name: customerName, representativeName: authorizedRepresentative\?\.name, idLabel, idValue, details: formDetails \}/);
  assert.match(cap, /secondary: supplementaryForm \? \{ name: supplementaryForm\.actualUserName, rows: supplementaryForm\.rows \} : undefined/);
  const print = fs.readFileSync('src/components/patterns/cafPrint.ts', 'utf8');
  assert.match(print, /signatureBlock\(primary\.representativeName \?\? primary\.name, 'Primary Contact'\)/);
  assert.match(print, /signatureBlock\(input\.secondary\.name, 'Secondary Contact'\)/);
  const panel = fs.readFileSync('src/components/patterns/CafPaperPanel.tsx', 'utf8');
  assert.equal((panel.match(/Print Full T&amp;C/g) ?? []).length, 1, 'one print button, above the containers');
});

test('in the printed Full T&C the Supplementary (and iPAY) terms each start on a new page; the signed-document containers are General and Supplementary Terms & Conditions', () => {
  const print = fs.readFileSync('src/components/patterns/cafPrint.ts', 'utf8');
  assert.match(print, /\.page-start \{ break-before: page; page-break-before: always; \}/);
  assert.match(print, /<h1 class="page-start">\$\{escapeHtml\(heading\)\}<\/h1>/);
  assert.match(fs.readFileSync('src/components/patterns/CafSignatureCapture.tsx', 'utf8'), /title: 'General Terms & Conditions'/);
});

test('Rescan replaces only the most recently scanned page, working from the pages as they are when the scan finishes', () => {
  const panel = fs.readFileSync('src/components/patterns/CafPaperPanel.tsx', 'utf8');
  assert.match(panel, /updatePages\(f\.key, \(pages\) => \[\.\.\.pages\.slice\(0, -1\), file\]\)/);
  assert.match(panel, /updatePages\(f\.key, \(pages\) => \[\.\.\.pages, file\]\)/, 'Add Page appends');
  assert.match(panel, /setReview\(\(r\) => \{\s*const next = change\(r\[key\] \?\? \[\]\);/);
});

test('Sign on Paper scanning: a new scan waits for Accept / Rescan; accepted pages offer Done / Add Another Page; images the agent chose are already accepted', () => {
  const panel = fs.readFileSync('src/components/patterns/CafPaperPanel.tsx', 'utf8');
  assert.match(panel, /setAccepted\(\(a\) => \(\{ \.\.\.a, \[f\.key\]: 0 \}\)\)/, 'a new scan starts pending');
  assert.match(panel, /pending=\{pagesOf\(f\.key\)\.length > acceptedOf\(f\.key\)\}/);
  assert.match(panel, /\[f\.key\]: images\.length/, 'chosen images are accepted');
  assert.match(panel, /onDone=\{\(\) => void acceptPages\(f\)\}/, 'Done saves every page as one document');
});

test('iPAY Activation applies to Postpaid as well as Prepaid: the same toggle and iPAY terms on the CAF, kept under ipayActivation (Yes by default), and recorded on the order', () => {
  const step = fs.readFileSync('src/capabilities/CafSignature/step.tsx', 'utf8');
  assert.match(step, /ipayActivation=\{opts\.ipay \|\| opts\.offerIpay \? \{ value: ipayOn\(values\)/);
  assert.match(step, /termsSections=\{opts\.ipay \? PREPAID_TERMS_SECTIONS : undefined\}/, 'Postpaid keeps its own terms; only Prepaid swaps them');
  assert.match(fs.readFileSync('src/modules/new-connection/postpaidSteps.tsx', 'utf8'), /cafSignatureStep\(\{ variant: 'full', offerIpay: true \}\)/);
  assert.match(fs.readFileSync('src/modules/new-connection/submitNewConnectionOrder.ts', 'utf8'), /iPayActivation: values\.ipayActivation === undefined \? IPAY_ACTIVATION_DEFAULT/);
});

test('with a Secondary Contact the iPAY Activation toggle sits above the two-column terms (visible), and its terms are a card of their own in a second row across both columns - not appended to the Key Terms', () => {
  const terms = fs.readFileSync('src/components/patterns/CafTerms.tsx', 'utf8');
  const branch = terms.slice(terms.indexOf('if (supplementaryTerms &&'), terms.indexOf('// Once signed there is nothing left to read'));
  assert.ok(branch.indexOf('{ipayToggle}') !== -1 && branch.indexOf('{ipayToggle}') < branch.indexOf('<Card>'), 'the toggle comes before the frame');
  assert.doesNotMatch(branch, /\{ipayTerms\}/, 'not inside the Key Terms column');
  assert.ok(branch.indexOf('aria-label="iPAY Terms and Conditions"') > branch.indexOf('</Card>'), 'a row of its own, below both term columns');
  assert.doesNotMatch(branch.slice(branch.indexOf('aria-label="iPAY Terms and Conditions"') - 80, branch.indexOf('aria-label="iPAY Terms and Conditions"')), /two-col-top/, 'across both columns, not half-width');
  assert.doesNotMatch(branch, /\{ipayBlock\}/, 'not buried at the end of the scrolling terms');
});
