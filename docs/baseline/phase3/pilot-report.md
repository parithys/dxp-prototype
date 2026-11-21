# Phase 3 pilot - Label, Card and Checkbox on Enterprise Account Creation

Status: **PASS** (with the documented differences and the unverified items listed under Decision). Playwright + axe were installed locally by the developer and the suite run against the original and the migrated screen.

## Readiness gate
Playwright, axe, a browser config and screenshot comparison were absent; the sandbox could not install them (npm 403), so the developer ran `npm install -D @playwright/test @axe-core/playwright && npx playwright install chromium` (Playwright 1.65, axe 4.14, Chromium 158). Added: `playwright.config.ts` (desktop 1440x900, tablet 768x1024 touch, mobile 390x844 touch; trace/screenshot on failure; reuses a dev server via `PORT`), `e2e/enterpriseAccountCreation.spec.ts`, script `test:e2e`, `.gitignore` entries for `e2e/report` and `e2e/results`.

Run: `PORT=5180 npx playwright test` (use the port of an already running dev server, or none to let Playwright start one on 5173).

**Results (3 projects x light/dark x 3 tests = 18):**
1. Original screen (`git show HEAD:` version) - behaviour + axe 12/12 pass; `--update-snapshots` wrote the **pre-migration card screenshots** (`e2e/enterpriseAccountCreation.spec.ts-snapshots/`, 6 files: desktop/tablet/mobile x light/dark).
2. Migrated screen - the same 18 tests pass, including the 6 screenshot comparisons against those pre-migration images (Playwright defaults: per-pixel threshold 0.2, 0 differing pixels allowed). Final run after the last spec edit: 18 passed.
- Tests: label click toggles and focuses the checkbox; Space toggles; Enter does not; the validation message shows/hides; URL unchanged; no console errors; no horizontal overflow; axe (scope `main`) zero violations for the default and checked states, light and dark, all three viewports; card screenshot (unchecked + error state) identical.
- Harness notes: a full page load signs the user out (session is in memory), so the spec signs in and moves with `window.next.router.push`. The screenshot is of the unchecked state, so it does not cover the tick (see differences).

## Screen and why
`/enterprise-iot-b2b/account-creation-screen` (SCR-007, feature `enterprise.account-creation`, roles ROLE-03/06/07, e.g. VFQ12343). Only screen with a Card, a wrapping Label and a Checkbox together. Local React state (no Redux for the checkbox; Redux `pushToast`, RTK Query `createRecord` on submit), rule-engine validation, no modal/drawer/specialised input. It writes only a mock record. **Caveat:** the checkbox attests a Business Finance credit-limit approval - a business-rule gate (not a payment); no other screen has all three primitives.

## Changes (one production file)
`src/modules/enterprise-iot-b2b/screens/EnterpriseAccountCreation.tsx`:
- `<div className="card p-3">` -> `<Card className="p-3 gap-0">` (p-3 replaces stock `py-4`; gap-0 as before).
- `<label className="row gap-2 body-text">` -> `<Label className="row gap-2 body-text">` (`field-label` + the same layout classes).
- app `<Checkbox onChange={(e)=>set(e.target.checked)}>` -> shadcn `<Checkbox className="shrink-0" onCheckedChange={(c)=>set(c === true)}>` (the one adapter; `shrink-0` kept from the app wrapper).
No shared primitive, token or CSS was changed. App `primitives/Checkbox` keeps its 12 other consumers. Button, Input, Select, Modal, Drawer, Tabs untouched.

## Measured parity (live, same session, before vs after)
Light, dark, desktop 1440 / tablet 768 (touch scale) / mobile 390, unchecked + error and checked:
- card rect, padding 12px, border colour, radius 16px, background, no shadow: identical; label rect, font 16px/24px/400, colour, gap 8px: identical; checkbox rect 18x18 (also on tablet - it never scaled), border/background (`rgb(135,135,135)` / white; checked red `rgb(230,0,0)`), dark values: identical; error message rect/colour/size: identical; Create Account button position: identical; no horizontal overflow.
- Create flow (name, CR search, agent, credit limit, approve, Create): button disabled until approved; route `/enterprise-iot-b2b`; toast `Enterprise account ACC-… created for Pilot Test Co.` - same before and after (verified by temporarily restoring the original file).
- Label click toggles and focuses the control; second click unchecks; error message appears/disappears with state; Create stays disabled while name etc. are empty; route unchanged.
- Accessible name "Business Finance has approved this credit limit" via the wrapping label (`labels` length 1) on both; role `checkbox` (native input before, `button[role=checkbox]` after); `aria-checked`/`data-state` correct; Enter does not toggle; tab stop count in the card 1; no hidden input in the page (Radix only adds one inside a `<form>`).

## Differences (all classified)
| Difference | Class |
|---|---|
| Tick is Radix/lucide, 14px, stroke 3 (was the app's 18px SVG, stroke 2.25) | Acceptable documented difference (already flagged in Phase 1) |
| Element is a `button[role=checkbox]`, not `input[type=checkbox]` | Expected implementation difference; same role/name/state; code querying `input[type=checkbox]` on this screen would miss it (none does) |
| `<Label>` adds `select-none` | Expected, no user impact on a one-line label |
| Card is `display:flex` column (was block) | Expected, geometry identical |
| Focus-visible ring: the tile uses the shared `.checkbox` class on both | Playwright pressed Space/Enter on the focused control, but the ring itself is not asserted or screenshotted - **unverified** |
| Preview-tool screenshots in `pre/` and `post/` | Not pixel-comparable (the emulator scaled some post shots into a corner); the Playwright snapshots and the geometry/colour measurements are the comparison |

## Evidence
Pre: `docs/baseline/phase3/pre/` (4 states: desktop light checked + unchecked, desktop dark, tablet, mobile). Post: `docs/baseline/phase3/post/` (desktop light checked, desktop dark, tablet). Phase 2 baseline reused: component states, ARIA, leave-warning n/a. Post mobile and hover/focus screenshots not taken.

## Existing issues seen (not from the pilot)
Mobile 390: the CR Type / ID Type select collapses to a ~100px chip and its label wraps one word per line (see `pre/...mobile...`). Checkbox is 18px on tablet (target is the 24px label row, below 44px).

## Validation
`npx tsc -b` pass; `npm run lint` pass (0 warnings); `npm test` pass 979/980, 0 failed, 1 existing TODO (CUST-1001 QID), including 3 new tests in `tests/pilotEnterpriseAccount.test.mjs`; `npm run build` pass; `npx playwright test` pass 18/18 (desktop, tablet, mobile x light, dark). `npm install` reported 2 high-severity advisories (`npm audit`) - not investigated, unrelated to this change.

## Decision
**PASS**, with these not verified: keyboard focus-visible ring appearance, hover state, the checked tick (known 14px vs 18px difference) in a pixel comparison, a real-device tablet, tab order across the whole page, and the Radix form-bubble input inside a `<form>` (the screen has none). Rollback: `git checkout -- src/modules/enterprise-iot-b2b/screens/EnterpriseAccountCreation.tsx`.
