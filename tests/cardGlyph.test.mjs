// One look for every unselected card's icon tile: the fill and the icon colour live in the design system's glyph classes, and a card only says whether it is selected.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { uiComponentsCss } from './libPaths.mjs';

const read = (p) => fs.readFileSync(p, 'utf8');

test('no selectable card colours its own unselected glyph: they declare only the selected state', () => {
  const cards = [
    'src/components/domain/QidInput.tsx', 'src/modules/fixed-line-fibre/fixedActivation/FixedStepViews.tsx',
    'src/modules/new-connection/steps/ProductSelection.tsx', 'src/capabilities/CustomerType/CustomerTypeStep.tsx', 'src/capabilities/SpecialDiscountsIdentification/SpecialDiscountsStep.tsx',
    'src/capabilities/ActualUser/ActualUser.tsx', 'src/components/patterns/BillingAccountStep.tsx', 'src/capabilities/AddonsSelection/AddonsPicker.tsx',
    'src/modules/new-connection/steps/StartCards.tsx',
  ];
  for (const f of cards) {
    const s = read(f);
    assert.doesNotMatch(s, /bg-surface-warm text-accent'/, `${f}: the pink unselected tile`);
    assert.doesNotMatch(s, /: 'icon-tint'/, `${f}: the colours come from the glyph class, not an added icon-tint`);
    assert.match(s, /option-glyph|icon-box/, `${f}: uses a card glyph class`);
  }
});

test('a selected card and a status badge are told apart by more than colour: tick, dark label, 2px edge; the badge is flat, 1px and tick-free', () => {
  const css = uiComponentsCss();
  const rule = (sel) => new RegExp(`${sel.replace(/[.[\]()]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  // The selected mark is drawn (it was hidden by display: none).
  assert.match(rule('.card-tick'), /display: flex/);
  // 1px border + the 1px inset ring = a 2px edge on the selected card.
  assert.match(rule('.card-selected'), /shadow-\[var\(--shadow-selected-ring\)\]/);
  // No selected card carries a red label: the label stays the page's text colour.
  for (const f of ['src/components/domain/QidInput.tsx', 'src/modules/new-connection/steps/ProductSelection.tsx', 'src/modules/fixed-line-fibre/fixedActivation/FixedStepViews.tsx', 'src/components/patterns/CafSignatureCapture.tsx', 'src/components/patterns/AppointmentBookingStep.tsx'])
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /text-\[var\(--field-card-selected\)\]/, f);
  // A status badge: a flat solid tile (no gradient), a 1px border, never the tick.
  assert.doesNotMatch(rule('.eligibility-alert-icon'), /gradient/);
  assert.doesNotMatch(rule('.eligibility-alert'), /border-2|card-tick|gradient/);
  assert.doesNotMatch(fs.readFileSync('src/components/domain/EligibilityRows.tsx', 'utf8'), /SelectedTick/);
});
