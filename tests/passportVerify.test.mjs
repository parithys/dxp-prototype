// Passport on web: no Upload; both sides are scanned, then the header's "Validate with MOI" reads the passport and validates it against MOI.
// Tablet / mobile: Upload, validated as before. The QID, GCC ID and Diplomatic ID are unchanged (they validate as soon as their scan completes).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

let m;
before(async () => { await boot(); m = await load('/src/components/domain/idUploadModel.ts'); });
after(close);

const read = (p) => fs.readFileSync(p, 'utf8');

test('only a Passport on a web device is validated on request', () => {
  for (const [doc, device, expected] of [
    ['Passport', 'web', true],
    ['Passport', 'tablet', false],
    ['QID', 'web', false],
    ['GCC ID', 'web', false],
    ['Diplomatic ID', 'web', false],
    [undefined, 'web', false],
  ]) assert.equal(m.passportVerifiesOnDemand(doc, device), expected, `${doc} on ${device}`);
});

test('the capture actions: the reader on the web (no upload in the identity scan); camera and upload on a tablet, never the reader', () => {
  assert.deepEqual(m.idCaptureOptions('web', true), { scan: true, upload: false, camera: false });
  assert.deepEqual(m.idCaptureOptions('tablet', true), { scan: false, upload: true, camera: true });
  assert.deepEqual(m.idCaptureOptions('web', false), { scan: false, upload: false, camera: false }, 'no reader: nothing to offer (typed entry opens after the permitted reads)');
});

test('the Passport card carries the Validate with MOI button, enabled once the front is scanned (the back is optional) and not yet validated', () => {
  const src = read('src/components/domain/PassportScanSections.tsx');
  assert.match(src, /onVerify \? \(/);
  assert.match(src, /disabled=\{!frontScanned \|\| scanning !== null \|\| verifying \|\| verified \|\| verifyDisabled\}/);
  assert.match(src, /'Validate with MOI'/);
  assert.doesNotMatch(src, /bothScanned/, 'the back side is optional');
  // The header no longer defaults to an Upload on web: the reader is declared, so upload follows the device.
  assert.match(src, /scanner=\{canScan\}/);
});

test('the lookup waits for the agent before reading and validating a web Passport, and starts over when the scan is cleared', () => {
  const hook = read('src/components/patterns/useIdLookup.ts');
  assert.match(hook, /passportVerifiesOnDemand\(demoType \?\? idType, detectDeviceType\(\)\)/);
  assert.match(hook, /if \(verifyOnDemand && !verifyRequested\) return;/);
  assert.match(hook, /setVerifyRequested\(false\);\n\s+return;/, 'a cleared scan resets the request');
  const step = read('src/components/patterns/IdLookupStep.tsx');
  assert.match(step, /onVerify=\{verifyOnDemand \? startVerification : undefined\}/);
});

// ---- Manual entry after the permitted unsuccessful scans (the Passport counterpart of the other documents') ------------------------------------------------
test('a Passport opens typed entry after two unsuccessful reads, as the other documents do; the other documents are unchanged', async () => {
  const { load } = await import('./harness.mjs');
  const m = await load('/src/components/patterns/idLookupModel.ts');
  // Passes 1-2: the reader's automatic read. From the third pass: the agent types the number and the expiry.
  assert.deepEqual([1, 2, 3, 4, 9].map((n) => m.captureModeOf(false, n, 'Passport')), ['ocr-auto', 'ocr-auto', 'barcode', 'barcode', 'barcode']);
  // Every other document keeps its own progression (number read and locked on the third pass, typed from the fourth).
  for (const t of ['QID', 'GCC ID', 'Diplomatic ID', undefined]) assert.deepEqual([1, 2, 3, 4, 5].map((n) => m.captureModeOf(false, n, t)), ['ocr-auto', 'ocr-auto', 'ocr-number', 'barcode', 'barcode'], String(t));
  assert.equal(m.captureModeOf(true, 5, 'Passport'), 'upload', 'an upload stays an upload');
});

test('a Passport retake is a further pass over the reader, and Validate with MOI looks up what the agent typed', () => {
  const sections = read('src/components/domain/PassportScanSections.tsx');
  assert.match(sections, /if \(!charged\.current \|\| isRetake\) \{\s+charged\.current = true;\s+if \(onScan\?\.\(\) === false\)/, 'every retake charges a pass');
  const hook = read('src/components/patterns/useIdLookup.ts');
  assert.match(hook, /captureModeOf\(value\.qidScans\?\.source === 'upload', scanAttempts, demoType \?\? idType\)/);
  assert.match(hook, /if \(verifyOnDemand && captureMode === 'barcode'\) void runMoiValidation\(\);\s+else setVerifyRequested\(true\);/, 'typed entry: the press looks the typed values up');
  assert.match(hook, /verifyReady: !\(verifyOnDemand && captureMode === 'barcode'\) \|\| Boolean\(value\.idNumber\?\.trim\(\) && value\.scannedExpiry\?\.trim\(\)\)/, 'both typed values are needed');
  const step = read('src/components/patterns/IdLookupStep.tsx');
  assert.match(step, /verifyDisabled=\{!verifyReady\}/);
  assert.match(step, /hideFetch=\{verifyOnDemand\}/, 'the Validate with MOI button is the action: no Fetch beside the number');
  assert.match(step, /Enter the passport number and expiry date from the document, then select Validate with MOI\./);
});

test('a Passport is complete with its front; every other document still needs both sides', async () => {
  const { load } = await import('./harness.mjs');
  const m = await load('/src/components/domain/qidImageUploadModel.ts');
  const front = { frontScanned: true }, back = { backScanned: true }, both = { frontScanned: true, backScanned: true };
  assert.equal(m.scanSidesDone('Passport', front), true);
  assert.equal(m.scanSidesDone('Passport', both), true);
  assert.equal(m.scanSidesDone('Passport', back), false, 'the back alone is not enough: the front is mandatory');
  assert.equal(m.scanSidesDone('Passport', {}), false);
  assert.equal(m.scanSidesDone('Passport', undefined), false);
  for (const t of ['QID', 'GCC ID', 'Diplomatic ID', undefined]) {
    assert.equal(m.scanSidesDone(t, front), false, String(t));
    assert.equal(m.scanSidesDone(t, back), false, String(t));
    assert.equal(m.scanSidesDone(t, both), true, String(t));
  }
});
