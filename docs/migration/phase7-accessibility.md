# Phase 7 (accessibility) - preserving and verifying the accessibility contracts

Method: the contracts were read from the source (tokens, CSS, components, tests), then measured on the live app with `e2e/a11y.spec.ts` (computed styles,
a canvas-based WCAG contrast calculation, keyboard focus, axe) plus the specs from earlier phases (`checkbox`, `input`, `tabs`, `overlays`, `protected`, the
pilot and the pixel + accessibility-tree sweep). Nothing was changed in the product code: the audit found **no migration regression**. It did find
existing gaps, and one place where the brief and the repository disagree (the dark focus ring), which need a decision.

## Decisions taken (after the audit)
The audit found no migration regression and three things to decide; "proceed with your recommendations" was taken as:
1. **Dark field border raised to 3:1 - done.** `--field-border` in dark is now `#707a8e` (was the card-border token, 1.6 to 1.8:1). Measured on the real surfaces, every field edge (input, filled, read-only, textarea, select trigger, checkbox) is 3:1 or more in dark and 3.35:1 or more in light. The card border itself is unchanged. The header search box and every form field are slightly brighter in dark as a result (the only pixel change; no accessibility-tree change on any screen).
2. **Dark focus ring stays near-white - not made teal.** The brief assumed a teal dark ring; the repo's contract is `--focus-outline` = teal `#007e91` in light and `--fg` (`#f8fafc`) in dark, measured on every control. Teal on the dark page is roughly 3.8:1 by calculation against 15.7:1 for the current ring, so teal would be weaker; nothing was changed.
3. **The three marginal contrast tokens fixed - done.** Error text and edge `--field-border-error` `#e60000` -> `#d40000` (5.15:1 on the page tint, 5.53:1 on white); the green tag label uses a new `--success-on-tint` `#2b7530` (4.84:1; dark = `--success`); dark `--danger` `#f0554a` -> `#f46a60` (5.07:1 on the notice fill). Axe now reports nothing on any component group, light or dark (`RECORDED_AXE` is empty).
The Phase 2 characterisation test of the dark edge (`baselineContracts`) was updated to the new token, with the reason in the test; its old assertion described the gap that was just fixed.

## Contracts and results
| Component or feature | Accessible name | Role | Required attributes | Keyboard contract | Focus contract | Visual contract | Existing test | Migration status | Result |
|---|---|---|---|---|---|---|---|---|---|
| Field border contrast | - | - | - | - | - | light default 3.53, filled / read-only / textarea / select / checkbox 3.35; error 4.48 (before the token fix, 5.15 after); dark 3:1 or more (was 1.63 to 1.77) | `a11y.spec` (new) | dark edge token raised (decision 1) | **PASS** (dark was an EXISTING ISSUE, now fixed) |
| Focus ring | - | - | - | - | `:focus-visible`; light 2px teal outline or `--focus-ring` (2px page colour + 2px teal) or inset 1px teal on fields; dark the same shapes in `--fg` | every control at 4.34 to 4.78:1 (light) and 15.5 to 17.1:1 (dark) on its surface | `a11y.spec` (new) | unchanged | **PASS**; dark colour is `--fg`, not teal |
| Button (migrated) | content / `aria-label` | native `button` | `type="button"` default; native `disabled` | Enter, Space | ring on primary, secondary, tertiary, icon | as above | `button.spec`, `ui.test` | PASS | **PASS** |
| Checkbox (migrated, Radix) | the wrapping label text, or `aria-label` | `checkbox` on a `button` | `aria-checked`, `data-state`, native `disabled` | Space toggles; Enter does not | inset ring | tile border 3.35:1 light | `checkbox.spec`, pilot | native input replaced by a button with the same role / name / state | **PASS - SEMANTICALLY EQUIVALENT** |
| Input / Textarea (field composites) | visible `<Label htmlFor>` (required marker `aria-hidden`, `aria-required`) | `textbox` | `aria-invalid`, `aria-describedby` -> helper or error (`role=alert`), read-only `tabindex=-1` | typing | inset ring | border contrast as above | `input.spec`, `baselineContracts` | unchanged semantics | **PASS** |
| Label | text | `label` | `htmlFor` or wrapping | click focuses / toggles the control | - | - | pilot, `input.spec`, `checkbox.spec` | bare Radix label, same classes | **PASS** |
| Radio groups / choice cards | group `aria-label` | `radiogroup` > `radio` | `aria-checked`, native `disabled` on real radios | as before | as before | - | `a11y.spec` (new) | hand-written, not part of the migration | **PASS** |
| Searchable Select | label (`aria-labelledby` / `aria-label`) | `combobox` + `listbox` | `aria-expanded`, `aria-activedescendant`, `aria-invalid`, `aria-required` | arrows, PageUp/Down, Enter, Escape (list only) | in the field | - | `protected.spec` | retained | **PASS** |
| Tabs (migrated, Radix) | `aria-label` on the list | `tablist` > `tab` | `aria-selected`; no `aria-controls` | arrows (wrap), Home, End; PageUp/Down additive | roving tabindex | ring 4.34:1 light / 17.1:1 dark | `tabs.spec` | hand-written strip replaced | **PASS - SEMANTICALLY EQUIVALENT** (additive PageUp / PageDown) |
| Modal / Drawer (migrated, Radix Dialog) | title, `aria-labelledby` (was `aria-label`) | `dialog`, `aria-modal` | page behind `aria-hidden`; scroll locked | Tab trapped, Escape top layer, focus to the container, back to the opener | close button ring 4.78 / 15.5:1 | - | `overlays.spec` | approved changes | **PASS - SEMANTICALLY EQUIVALENT** (the name source, scroll lock and hidden page are the approved improvements) |
| Skip link | "Skip to main content" | `link` | `href="#main-content"`, one `main#main-content` with `tabindex=-1` | first tab stop; Enter moves focus to `<main>`; no `#fragment`, no route change | visible on screen and unclipped on focus; works after client navigation | light and dark | `a11y.spec` (new) | unchanged | **PASS** |
| Route announcements | "<heading> page" | `status`, `aria-live=polite`, `sr-only` | one announcer | - | focus moves to `<main>` 150 ms after a change | - | `a11y.spec` (new) | unchanged | **PASS**: Orders, Leads, Back, Forward, Not Found; the title follows; exactly one announcer |
| Disabled semantics | - | - | native `disabled` on button, input, checkbox (`data-disabled`) | not activatable, left out of the tab order | - | - | `a11y.spec` (new) | native | **PASS** |
| Validation and error semantics | label | - | `aria-invalid`, `aria-describedby`, `role=alert` on field errors | - | focus stays where it was (existing) | error border 4.48:1 light / 5.19:1 dark | `input.spec` | unchanged | **PASS**; profile password form errors are plain `<p>` (**EXISTING ISSUE**, Phase 2) |
| Notifications | message | `status` / `alert` | `aria-live` polite / assertive | Escape clears | - | - | `protected.spec` | retained | **PASS** |
| axe, every library group | - | - | - | - | - | - | `a11y.spec` (new) | - | **PASS** (three existing token-level misses fixed, see below) |

## axe (serious and critical, UI Components Library, 13 groups, light and dark)
Before the token fixes axe found three marginal `color-contrast` misses, all token-level (not in a migrated component): the field error text at 4.48:1 (`#e60000` on the page tint), `.badge-tag-green` at 4.35:1, and the dark danger notice at 4.37:1. They were fixed by decision 3; every group, plus the open Modal, open Drawer, tab strips and the Select, now scans clean with no rule excluded.

## Other findings
- **Label conventions:** visible `<Label htmlFor>`; a required marker that is `aria-hidden` while the field carries `aria-required`; Title Case copy (guarded by tests). Unchanged by the migration.
- **Radix semantics inspected:** Dialog (`aria-labelledby`, no description by design, focus guards), Tabs (`aria-orientation`, wrapper `dir`, the strip as the entry tab stop), Checkbox (a button; Radix's hidden form input exists only inside a `<form>`, and none of the files that use the Checkbox has one).
- **Not weakened:** no accessibility test was deleted, skipped or loosened (`accessibilityAudit.test.mjs` is untouched). Tests changed in earlier phases were exact-markup assertions replaced by role, name and state assertions of the new markup, each with the reason in its phase document: Button and TabStrip / SegmentedTabs in `ui.test.mjs`, the overlay, tab and checkbox contract tests in `baselineContracts.test.mjs`. 12 of the new browser checks are skipped on touch projects on purpose (colour tokens and markup do not vary by viewport).
- **Existing, recorded earlier:** disabled inputs are 1.5:1 against their surface in light and, oddly, 14.7:1 in dark (the disabled edge is more prominent than an enabled one in dark); `<th>` has no `scope`; touch targets on `/support`; Select has no Home / End (they are caret keys).

## Not verified here
- **Pre-migration comparison.** A true before / after of every screen's accessibility tree and pixels needs the pre-migration build running beside this one; the sandbox's approval was denied for creating that worktree and dev server. To do it locally: `git worktree add /tmp/head-wt 3d061b1`, copy `node_modules`, `PORT=5181 npm run dev` there, then from this repo `SNAP_DIR=pre PORT=5181 npx playwright test sweep.spec --update-snapshots` followed by `SNAP_DIR=pre PORT=5180 npx playwright test sweep.spec` (`SNAP_DIR` keeps that set apart from the committed snapshots). Expected differences: the checkbox tick, the dialog and tab markup, the dev showcase and the component-catalogue count.
- **Screen readers:** no assistive technology was run; the accessibility tree and computed names were checked in the browser only.
- **Forced colours, zoom / reflow and on-screen keyboards** were not exercised.
- **Real-device tablet and mobile keyboard navigation:** the skip link and keyboard tests ran on the desktop project (touch projects skip the keyboard-only checks).

## Still open
- The oddly prominent disabled-field edge in dark (14.7:1 against 1.5:1 in light), from an earlier phase.

## Fixed afterwards
- **Profile password errors** are now each failing field's own `error` (`aria-invalid`, `aria-describedby`, `role=alert`) instead of one loose paragraph; the MFA code error likewise. Pinned by `e2e/a11y.spec.ts` (all three viewports) and `baselineContracts.test.mjs`.
- **`<th>` scope:** every header cell declares `scope` (`col`, or `colgroup` for the checkout title row); `tests/accessibilityAudit.test.mjs` fails on a `<th>` without it.
- Test hardening found on the way: the sweep pins the clock (the dashboard greeting and date changed with the time of day), and the leave-prompt pixel test masks the uploaded PDF previews behind the dialog.
