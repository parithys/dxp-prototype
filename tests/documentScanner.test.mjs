// The scanner that takes a document (device + document type), the flatbed's multi-page scan, and the single PDF its pages are combined into.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

globalThis.window ??= globalThis;
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
before(boot);
after(close);

test('scanner type: a tablet uses its camera; on the web each configured type uses its desk scanner, an unnamed type the OCR scanner', async () => {
  const { scannerTypeFor } = await load('/src/engines/documentScanner.ts');
  // The business's table (2026-11-08), written independently of the configuration it is read from.
  const web = { QID: 'ocr', Passport: 'flatbed', 'GCC ID': 'ocr', 'Employee ID': 'ocr', CAF: 'flatbed', 'Special Needs Card': 'ocr', 'Supplementary Form': 'flatbed', 'Upfront Payment Receipt': 'flatbed' };
  for (const [label, scanner] of Object.entries(web)) {
    assert.equal(scannerTypeFor(label, 'web'), scanner, `web: ${label}`);
    assert.equal(scannerTypeFor(label, 'tablet'), 'camera', `tablet: ${label}`);
  }
  assert.equal(scannerTypeFor('  passport ', 'web'), 'flatbed', 'label match ignores case and spacing');
  assert.equal(scannerTypeFor('Employer Letter', 'web'), 'ocr', 'a free-typed label');
  assert.equal(scannerTypeFor('MNP Form', 'web'), 'ocr', 'a configured type the business has not placed on a flatbed');
  // Every type in the configuration names a valid scanner or none.
  const types = JSON.parse(fs.readFileSync('public/config/document-types.json', 'utf8')).types;
  for (const t of types) assert.ok(t.scanner === undefined || ['ocr', 'flatbed'].includes(t.scanner), t.id);
  assert.deepEqual(types.filter((t) => t.scanner === 'flatbed').map((t) => t.label).sort(), ['CAF', 'Passport', 'Supplementary Form', 'Upfront Payment Receipt']);
});

// A tiny valid-enough JPEG: SOI, a SOF0 frame header with the size, EOI.
const jpeg = (w, h) => Uint8Array.of(0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9);

test('jpegSize reads the frame size; a non-JPEG is refused', async () => {
  const { jpegSize } = await load('dxp-ui');
  assert.deepEqual(jpegSize(jpeg(620, 877)), { width: 620, height: 877 });
  assert.deepEqual(jpegSize(jpeg(1, 1)), { width: 1, height: 1 });
  assert.throws(() => jpegSize(Uint8Array.of(0x89, 0x50, 0x4e, 0x47)), /not a JPEG/);
});

test('buildPdf: one PDF page per scanned page, in order, with a consistent cross-reference table', async () => {
  const { buildPdf } = await load('dxp-ui');
  for (const n of [1, 2, 5]) {
    const pages = Array.from({ length: n }, (_, i) => ({ jpeg: jpeg(620, 877), width: 620, height: 877 + i }));
    const bytes = buildPdf(pages);
    const text = Buffer.from(bytes).toString('latin1');
    assert.ok(text.startsWith('%PDF-1.4'));
    assert.ok(text.trimEnd().endsWith('%%EOF'));
    assert.equal((text.match(/\/Type \/Page \//g) ?? []).length, n, `${n} page objects`);
    assert.match(text, new RegExp(`/Type /Pages /Count ${n} `));
    // startxref points at the xref table; each xref entry points at its "n 0 obj".
    const start = Number(/startxref\n(\d+)\n/.exec(text)[1]);
    assert.equal(text.slice(start, start + 4), 'xref');
    const entries = [...text.slice(start).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    assert.equal(entries.length, 2 + n * 3);
    entries.forEach((off, i) => assert.equal(text.slice(off, off + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`, `object ${i + 1} at its offset`));
  }
});

test('a flatbed document: Add Page sits before Upload Document, pages go up as one PDF named for the type; an OCR document has neither', () => {
  const src = fs.readFileSync('src/components/domain/AdditionalDocumentsUpload.tsx', 'utf8');
  assert.match(src, /scannerTypeFor\(label, detectDeviceType\(\)\) === 'flatbed'/, 'decided by device and document type');
  const add = src.indexOf('Add Page');
  const upload = src.indexOf('Upload Document\n                </Button>');
  assert.ok(add > 0 && upload > add, 'Add Page comes immediately before the Upload Document button');
  assert.match(src, /<div className="flex gap-3">\s*\{flatbed && \(\s*<Button/, 'only for a flatbed document, in one row with Upload Document');
  assert.match(src, /pdfFromImageFiles\(pages, scannedFileName\(new Date\(\), trimmed, 'pdf'\)\)/, 'one PDF of all the pages, scan-{id}-{type}.pdf');
  assert.match(src, /onFile=\{flatbed \? firstPage : stageFile\}/, 'Initiate Scan starts a new document on a flatbed');
  assert.match(src, /setStaged\(null\);\s*setPages\(\[\]\);/, 'a changed type drops the pages');
});

test('Add Page scans the next page and appends it; any scanned page can be deleted before the document is uploaded', () => {
  const src = fs.readFileSync('src/components/domain/AdditionalDocumentsUpload.tsx', 'utf8');
  assert.match(src, /scansTaken\.current \+= 1;\s*void pageScan\.scan\(\(f\) => setPages\(\(p\) => \[\.\.\.p, f\]\), scansTaken\.current\)/, 'the same scan, appended after the pages already taken');
  assert.match(src, /onDelete=\{\(i\) => setPages\(\(p\) => p\.filter\(\(_, k\) => k !== i\)\)\}/, 'a page is deleted by its index');
});
