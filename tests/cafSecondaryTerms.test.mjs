import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (f) => fs.readFileSync(f, 'utf8');

// The CAF & Signature step shows General and Supplementary Key Terms side by side only when a Secondary Contact is on the line
// (the Supplementary Form exists only then); with none, the single-column panel is rendered as before.
test('CAF terms: the two-column layout is tied to the Supplementary Form (a Secondary Contact) and nothing else', () => {
  const capture = read('src/components/patterns/CafSignatureCapture.tsx');
  assert.match(capture, /supplementaryTerms=\{supplementaryForm \? \{ terms: SECONDARY_CONTACT_TERMS/);
  const terms = read('src/components/patterns/CafTerms.tsx');
  // The two-column branch is guarded by the prop, so without it the original panel below is the one rendered.
  assert.match(terms, /if \(supplementaryTerms && \(content\.secondary\?\.sections \?\? supplementaryTerms\.terms\)\.length > 0\) \{/);
  const branch = terms.slice(terms.indexOf('if (supplementaryTerms'), terms.indexOf('return (\n    <section aria-label="Full Terms and Conditions" className="card ">\n      <div className="split-nowrap'));
  // The headings are the signing screen's own words in the customer's language (English: Key Terms & Conditions / Supplementary Key Terms & Conditions).
  assert.match(branch, /\{content\.primary\?\.heading \?\? t\('keyTerms'\)\}/);
  assert.match(branch, /\{content\.secondary\?\.heading \?\? t\('supplementaryKeyTerms'\)\}/);
  // Agreements and signature (children) come after the columns, outside the two-column container, at full width.
  assert.ok(branch.indexOf('{children}') > branch.indexOf('two-col-top'), 'children follow the columns');
  assert.doesNotMatch(branch, /Agreements and signature/, 'the agreements and signature have no frame of their own');
  assert.match(branch, /\{t\('primaryContact'\)\}/);
  assert.match(branch, /\{t\('secondaryContact'\)\}/);
  // The two-card branch comes before the signed early return, so the signed view carries the same layout.
  assert.ok(terms.indexOf('if (supplementaryTerms') < terms.indexOf('if (signed)'));
  assert.match(branch, /\{children\}/);
});
