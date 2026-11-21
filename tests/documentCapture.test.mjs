import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import fs from 'node:fs';
import { load, close } from './harness.mjs';

after(close);
const h = React.createElement;

// Supporting documents are taken the way the device does it: Initiate Scan on the web; Open Camera and Upload Document on a tablet or phone (never Initiate Scan there).
test('web: Initiate Scan only - no upload, no file input, no camera', async () => {
  const { DocumentCaptureActions } = await load('/src/components/domain/DocumentCaptureActions.tsx');
  const out = html(h(DocumentCaptureActions, { device: 'web', onFile() {} }));
  assert.match(out, />Initiate Scan</);
  assert.doesNotMatch(out, /Upload Document|Replace Document/);
  assert.doesNotMatch(out, /type="file"/, 'no file input on the web');
  assert.doesNotMatch(out, /Capture With Camera|capture="environment"/);
});

test('Additional Documents (uploadOnWeb): the web offers Upload Document and Initiate Scan, a tablet Open Camera and Upload Document', async () => {
  const { DocumentCaptureActions } = await load('/src/components/domain/DocumentCaptureActions.tsx');
  const web = html(h(DocumentCaptureActions, { device: 'web', uploadOnWeb: true, onFile() {} }));
  assert.match(web, />Upload Document</);
  assert.match(web, />Initiate Scan</);
  assert.match(web, /type="file"/);
  assert.match(html(h(DocumentCaptureActions, { device: 'web', uploadOnWeb: true, hasDocument: true, onFile() {} })), />Replace Document</);
  const tablet = html(h(DocumentCaptureActions, { device: 'tablet', uploadOnWeb: true, onFile() {} }));
  assert.match(tablet, />Upload Document</);
  assert.match(tablet, /Open Camera/);
  assert.doesNotMatch(tablet, /Initiate Scan/, 'never a scan on a tablet');
  assert.match(fs.readFileSync('src/components/domain/AdditionalDocumentsUpload.tsx', 'utf8'), /uploadOnWeb\s+onFile=\{flatbed \? firstPage : stageFile\}/, 'the Document Type row asks for it');
});

test('tablet / mobile: Open Camera (the rear camera) and Upload Document, in that order - never Initiate Scan', async () => {
  const { DocumentCaptureActions } = await load('/src/components/domain/DocumentCaptureActions.tsx');
  const out = html(h(DocumentCaptureActions, { device: 'tablet', what: 'court order', onFile() {} }));
  assert.match(out, />Upload Document</);
  assert.match(out, /capture="environment"/, 'the camera input opens the rear camera');
  assert.match(out, /accept="image\/\*"/, 'a camera capture is a photo');
  assert.match(out, /aria-label="Open Camera to capture the court order"/);
  assert.ok(out.indexOf('Open Camera') < out.indexOf('Upload Document'), 'camera first, then upload');
  assert.doesNotMatch(out, /Initiate Scan|Scanning/);
});

test('an attached document turns Upload into Replace; disabled controls say why', async () => {
  const { DocumentCaptureActions } = await load('/src/components/domain/DocumentCaptureActions.tsx');
  assert.match(html(h(DocumentCaptureActions, { device: 'tablet', hasDocument: true, onFile() {} })), />Replace Document</);
  const web = html(h(DocumentCaptureActions, { device: 'web', hasDocument: true, onFile() {} }));
  assert.match(web, />Initiate Scan</, 'the web scan button keeps its name once a document is attached');
  assert.doesNotMatch(web, /Replace Document/, 'no upload on the web');
  const off = html(h(DocumentCaptureActions, { device: 'tablet', disabled: true, disabledTitle: 'Choose a document type first', onFile() {} }));
  assert.equal((off.match(/disabled=""/g) ?? []).length, 2, 'a tablet has the camera and the upload, both disabled');
  assert.equal((html(h(DocumentCaptureActions, { device: 'web', disabled: true, onFile() {} })).match(/disabled=""/g) ?? []).length, 1, 'the scan only');
  assert.match(off, /title="Choose a document type first"/);
});

test('every supporting-document surface uses the capture actions: no upload-only button is left', () => {
  const surfaces = [
    'src/capabilities/NumberSelection/WaiveOff.tsx', // number discount document
    'src/capabilities/EligibilityGate/ExceptionRequestModal.tsx', // exception / court order document
    'src/components/domain/SupportingDocumentField.tsx',
    'src/components/domain/AdditionalDocumentsUpload.tsx',
    'src/components/domain/CafDocumentUpload.tsx',
    'src/modules/order-management/MissingInformationPanel.tsx',
  ];
  for (const f of surfaces) {
    const src = fs.readFileSync(f, 'utf8');
    assert.match(src, /<DocumentCaptureActions/, f);
    assert.doesNotMatch(src, /type="file"/, `${f} owns no file input of its own`);
  }
});

// A scanned or camera-captured document is named scan-{scan id}-{document type}.{file type}, on every surface.
test('scanned file names: scan-{id}-{type}.{ext}, the type slugged, no type no suffix', async () => {
  const { scannedFileName, fileTypeOfMime } = await load('/src/lib/documentScan.ts');
  const at = new Date('2026-11-08T11:19:05Z');
  assert.equal(scannedFileName(at, 'Passport'), 'scan-20261108111905-passport.jpg');
  assert.equal(scannedFileName(at, 'Court Order'), 'scan-20261108111905-court-order.jpg');
  assert.equal(scannedFileName(at, 'Signed CAF / Form (2)', 'png'), 'scan-20261108111905-signed-caf-form-2.png');
  assert.equal(scannedFileName(at, undefined), 'scan-20261108111905.jpg');
  assert.equal(scannedFileName(at, '  '), 'scan-20261108111905.jpg');
  assert.equal(fileTypeOfMime('image/jpeg'), 'jpg');
  assert.equal(fileTypeOfMime('image/png'), 'png');
  assert.equal(fileTypeOfMime(''), 'jpg');
});

test('every surface tells the capture actions what the document is, so the scanned file is named for it', () => {
  const surfaces = [
    'src/capabilities/NumberSelection/WaiveOff.tsx',
    'src/capabilities/EligibilityGate/ExceptionRequestModal.tsx',
    'src/components/domain/SupportingDocumentField.tsx',
    'src/components/domain/AdditionalDocumentsUpload.tsx',
    'src/components/domain/CafDocumentUpload.tsx',
    'src/modules/order-management/MissingInformationPanel.tsx',
  ];
  for (const f of surfaces) {
    const src = fs.readFileSync(f, 'utf8');
    const tags = src.match(/<DocumentCaptureActions[\s\S]*?\/>/g) ?? [];
    assert.ok(tags.length > 0, f);
    for (const tag of tags) assert.match(tag, /documentType=\{/, `${f}: a capture control does not name its document type`);
  }
  // The one scan generator names through the shared function; nothing else builds a "scan-" name.
  assert.match(fs.readFileSync('src/lib/documentScan.ts', 'utf8'), /scannedFileName\(now, documentType\)/);
});

// A scan starts only when the agent clicks Initiate Scan: choosing a document type never starts one, and nothing is previewed before a scan completes.
test('choosing a document type does not start a scan; one scan generator; a type change clears what was staged', () => {
  const actions = fs.readFileSync('src/components/domain/DocumentCaptureActions.tsx', 'utf8');
  assert.doesNotMatch(actions, /autoScanKey/, 'no automatic scan');
  assert.match(fs.readFileSync('src/components/domain/useDocumentScan.ts', 'utf8'), /onFile\(await scanDocument\(new Date\(\), documentType, page\)\)/, 'the scan carries the chosen type');
  assert.match(actions, /useDocumentScan\(documentType\)/, 'the control scans through the one hook');
  assert.match(fs.readFileSync('src/components/domain/AdditionalDocumentsUpload.tsx', 'utf8'), /setLabel\(e\.target\.value\);\s*setError\(null\);\s*\/\/[^\n]*\n\s*setStaged\(null\);/, 'a changed type drops the staged file (and so its preview)');
  const owners = ['src', 'app'].flatMap((d) => fs.readdirSync(d, { recursive: true }).map((p) => `${d}/${p}`)).filter((p) => /\.(ts|tsx)$/.test(p) && /scanDocument\(/.test(fs.readFileSync(p, 'utf8')) && !p.endsWith('documentScan.ts'));
  assert.deepEqual(owners, ['src/components/domain/useDocumentScan.ts']);
});

// A scanned (or photographed, or chosen) image is shown on the page before it is attached.
test('the staged image is previewed on Additional Documents; nothing renders without an image file', async () => {
  const { FileImagePreview } = await load('/src/components/domain/FileImagePreview.tsx');
  assert.equal(html(h(FileImagePreview, { file: null })), '');
  assert.equal(html(h(FileImagePreview, { file: new File(['x'], 'a.pdf', { type: 'application/pdf' }) })), '', 'a PDF has no picture to show');
  const src = fs.readFileSync('src/components/domain/AdditionalDocumentsUpload.tsx', 'utf8');
  assert.match(src, /<FileImagePreview file=\{staged\} \/>/);
  const view = fs.readFileSync('src/components/domain/FileImagePreview.tsx', 'utf8');
  assert.match(view, /read\?\.file !== file\) return null/, 'a picture of an earlier file is never shown for a later one');
  assert.match(view, /alt=\{`Preview of \$\{file\.name\}`\}/, 'the image has alt text');
});

test('the Exception Request offers Initiate Scan and Upload Document on the web, as Additional Documents does', async () => {
  const { ExceptionRequestModal } = await load('/src/capabilities/EligibilityGate/ExceptionRequestModal.tsx');
  const out = html(h(ExceptionRequestModal, { open: true, onClose() {}, onSubmit() {}, requirement: { id: 'court-type-order', label: 'Court Type Order' }, approverRole: 'Sales Manager' }));
  assert.match(out, />Initiate Scan</);
  assert.match(out, />Upload Document</);
  assert.match(fs.readFileSync('src/capabilities/EligibilityGate/ExceptionRequestModal.tsx', 'utf8'), /<DocumentCaptureActions[^>]*uploadOnWeb/);
});
