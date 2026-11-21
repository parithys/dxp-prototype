# Point 8 - separating styling tests from behavioural tests

Why: after the shadcn / Radix migration several tests failed or had to be rewritten only because markup details changed (a CSS class, the attribute order, a
`data-slot`, an extra wrapper), while the behaviour they protected had not. They now fall into three layers that fail for different reasons.

| Layer | Where | Asserts | Fails when |
|---|---|---|---|
| Behaviour | `tests/*.test.mjs` through `tests/helpers/dom.mjs`; `e2e/*.spec.ts` (role, name, state, keyboard, focus, outcome) | role, accessible name, state (`disabled`, `checked`, `selected`, `invalid`, `required`, read-only), relationships (`aria-describedby`), keyboard reachability, text, what is hidden from assistive technology | the behaviour or the semantics change |
| Styling contract | `tests/styling.test.mjs` | which semantic classes a component's API (variant, size, state) resolves to, as a SET of tokens (order and extra classes ignored), and the rules `src/ui-components.css` gives them | the look is changed |
| Appearance | the pixel snapshots in `e2e/` (sweep, library groups, overlays, pilot) and the computed-style checks in `e2e/a11y.spec.ts` / `e2e/input.spec.ts` | what is painted: borders, rings, contrast | what the user sees changes |

## The helper
`tests/helpers/dom.mjs` is a small dependency-free reader for the markup `react-dom/server` produces (there is no jsdom): `parse`, `byRole`, `getByRole`,
`nameOf`, `stateOf`, `describedBy`, `tabbable`, `hiddenFromAT`, `text`. It resolves names the way assistive technology does (`aria-labelledby`, `aria-label`, `<label for>`,
a wrapping label without its `aria-hidden` marker), excludes `aria-hidden` elements from role queries (Radix's hidden form-bridge input), and normalises
attribute case (React writes `readOnly`). `tests/domHelper.test.mjs` tests the reader itself.

## What moved
- Button, TabStrip / SegmentedTabs, tab hierarchy (`ui.test.mjs`) and Button, Input, TabStrip, Checkbox (`baselineContracts.test.mjs`), the pilot markup test, the library and the standalone step page: now role / name / state assertions.
- Class assertions moved to `styling.test.mjs`: the Button variant and size mapping (formerly `uiShowcase.test.mjs`), the Input / Textarea border states, Label and Card as look-free wrappers, the Checkbox tile, the tab-strip classes, the overlay look (`overlayContracts`), the step-page layout (`standaloneStepPage`), and the library's shared look.
- Playwright: the input state classes became computed border colours compared with the token (`--field-border`, `--field-border-filled`, `--field-border-error`); buttons and cards are found by `data-variant` / `data-slot` (shadcn's stable markers) or by role, not by `btn-*` / `.card`.

## Guards
`tests/testSeparation.test.mjs`: outside `styling.test.mjs`, an assertion over rendered markup may not name the classes of the migrated components (baseline empty); the behavioural suites must import the markup reader.

## Evidence that the layers separate
Mutation checks (apply a change, run the behavioural files and `styling.test.mjs`, revert):
| Mutation | Behavioural | Styling |
|---|---|---|
| Rename `btn-primary`, `tab-strip`, the checkbox tile class | no failure | fails |
| Default button type becomes `submit` | fails | no failure |
| Tabs point `aria-controls` at a missing panel | fails | no failure |
| Tablist loses its name | fails | no failure |
| Checkbox loses `role=checkbox` | fails | no failure |
| Error no longer sets `aria-invalid` | fails | fails (the error state class is derived from it) |

## Left as is, deliberately
- Source-structure tests that read a `.tsx` file (`addonCategories`, `selectedPlanAndPortIn`, ...) and tests on classes of components that were not migrated (`prepaidPagesTidy` toggle) - not affected by the migration.
- `e2e/a11y.spec.ts` measures colours of elements found by `data-variant`, label or state.
