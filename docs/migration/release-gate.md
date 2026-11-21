# Component-family release gate (Point 9)

Authoritative status of every component family migrated to shadcn/ui. It extends `phase4-migration-matrix.md` (the inventory and per-phase decisions, which remains the
detail record) and replaces its "Status" columns as the source of truth for release status. A family is **COMPLETE** only when every mandatory applicable gate is PASS;
a FAIL, BLOCKED or NOT RUN gate keeps it **INCOMPLETE** (or **BLOCKED**). Execution session: 2026-11-07, one working tree, dev server on port 5180.

Allowed gate values: PASS, FAIL, BLOCKED, NOT APPLICABLE, NOT RUN. A shadcn import never counts as evidence.

## 1. Inventory of migrated families

| Family | Existing implementation | Current implementation | Production consumers | Variants / sizes / states | Risk | Rollback unit |
|---|---|---|---|---|---|---|
| Foundation | none (Tailwind + semantic CSS) | `components.json`, `src/lib/utils.ts` (`cn`), the shadcn colour map in `src/index.css`, `@/` alias, deps `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`; dev deps Playwright + axe | all `ui/` components | - | Medium | see section 9 |
| Label | raw `<label className>` (36) | `ui/label.tsx` (bare Radix Label) | 17 files (+ the Input / Textarea composites) | wrapping, `htmlFor`, required marker | Low | section 9 |
| Card | `<div className="card ...">` (89 converted) | `ui/card.tsx` (the `card` class only) | 54 files | static / template classes | Low | section 9 |
| Checkbox | `primitives/Checkbox` (native input + SVG) | `ui/checkbox.tsx` (Radix, the app's tile and tick) | 12 files | unchecked, checked, disabled, in label, in a table cell | Medium | section 9 |
| Button (+ IconButton) | `primitives/Button` | `ui/button.tsx` (variants default / secondary / tertiary / destructive / outline; sizes sm / md / lg / icon / icon-sm; `type="button"` default); `IconButton` wraps it | 132 files | primary gradient, secondary, tertiary text-link, destructive, icon; hover, focus, active, disabled | Medium | section 9 |
| Standard inputs | `primitives/Input`, `Textarea` drew a raw `<input>` / `<textarea>` | the same composites (unchanged API) render `ui/input.tsx` / `ui/textarea.tsx` | 97 Input + 26 Textarea tags | default, filled, error, read-only, disabled; required; helper; numeric keypad | Medium | section 9 |
| Tabs | hand-written `TabStrip`, `SegmentedTabs` | `ui/tabs.tsx` (Radix) behind the unchanged `TabStrip` / `SegmentedTabs` | 20 files | underline strip, count badge, selected | High | section 9 |
| Dialog (Modal and Drawer) | `Modal`, `Drawer`, `useDialogBehaviour` | `ui/dialog.tsx` (Radix) behind the unchanged `Modal` / `Drawer` | 13 + 24 files | modal, drawer, nested, leave prompt | High | section 9 |
| Accessibility tokens | dark field edge = card border; error `#e60000`; dark danger `#f0554a`; green tag on `--success` | `--field-border` (dark) `#707a8e`, `--field-border-error` `#d40000`, dark `--danger` `#f46a60`, `--success-on-tint` | every screen with a field or error text | light and dark | Low | section 9 |

**Not in migration scope (no release gate):** Select (the app's searchable combobox, retained), Dropdown Menu (`ui/dropdown-menu.tsx` installed, no consumer), Tooltip, notifications / toasts, DataTable, PhoneNumberInput, QidInput, SignaturePad (see section 8). The unused shadcn Select, Tooltip and Sonner were deleted in Phase 5 (duplicates).

## 2. Release-gate matrix

Visual = appearance matches the pre-change design (pixel snapshots taken immediately before each family change and compared after; approved differences listed). Functional =
behaviour unchanged. Desktop / Tablet / Mobile = the three Playwright projects (1440x900, 768x1024 touch, 390x844 touch). Integration = the harness-based suites (`journeys`, `journeyGates`, `newConnection`, ...), which run the real engines and screens through the app's own loader; the repository has no separate integration runner.

| Family | Visual | Functional | A11y | Desktop | Tablet | Mobile | Dark | Type check | Lint | Unit | Integration | E2E | Visual regression | Build | No duplicate systems | Independent rollback | Overall |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Foundation | NOT APPLICABLE | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | FAIL | INCOMPLETE |
| Label | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | FAIL | INCOMPLETE |
| Card | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | FAIL | INCOMPLETE |
| Checkbox | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | FAIL | INCOMPLETE |
| Button | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | FAIL | INCOMPLETE |
| Standard inputs | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | FAIL | INCOMPLETE |
| Tabs | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | COMPLETE |
| Dialog (Modal / Drawer) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | COMPLETE |
| Accessibility tokens | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | COMPLETE |

### Every FAIL / BLOCKED / NOT RUN, with its reason
| Family | Gate | Result | Reason and evidence | Severity | Blocks release? | Corrective action |
|---|---|---|---|---|---|---|
| Foundation, Label, Card, Checkbox, Button, Standard inputs | Independent rollback | FAIL | None of the work is committed (`git log` ends at `3d061b1`; 193 production files modified in one working tree). The families were applied by codemods across overlapping files: 65 files carry Card or Label edits, 130 carry Button edits (many are among the 65), the Checkbox call sites sit in files that also carry Label and Button edits, and `primitives/Input.tsx` / `Textarea.tsx` hold the Label and the Input hunks together. Reverting one family with `git` would revert the others in those files; there are no per-family commits or patches. | High | Yes (the release process requires a reversible unit per family) | Decision for the owner: commit the tree as separate commits per family only if the work can be split (it cannot be reconstructed from the final tree), or keep the migration as one reversible unit (one commit / one revert) and record that the families are not independently releasable. Reverse codemods for Label, Card, Button and Checkbox are mechanical and could be scripted. |
| Foundation | Visual parity | NOT APPLICABLE | Draws nothing itself; its effect is exercised by every other family's visual gate. | - | No | - |

### Owner decision on rollback (recorded after the gate run)
The owner chose to commit the whole migration as a single unit (`81f0923`, pushed to `main`). The six families above therefore ship as one reversible release
(`git revert 81f0923`), and are not independently releasable; the Independent rollback gate stays FAIL for them. It is an accepted release decision, not a pass.

### Dialog touch coverage (closed)
The leave-journey prompt is now exercised on tablet and mobile: on a touch device the test uploads a front and back (PDF), types the seeded customer's QID number and
expiry, and presses Fetch, which gives the journey progress ("Save as Draft" appears). The prompt then behaves as on desktop (one prompt, Escape and the scrim keep the
user in, Abandon leaves, a dirty reload raises `beforeunload`), and its pixel baselines (light and dark, tablet and mobile) were created and reviewed.

## 3. Evidence

| Gate | Method | Result | Where |
|---|---|---|---|
| Type check | `npx tsc -b` | exit 0, 0 errors, 9 s | whole project |
| Lint | `npm run lint` (oxlint) | exit 0, 0 warnings | whole project |
| Unit and integration | `npm test` (`node --test tests/*.test.mjs`) | exit 0: 1008 tests, 1007 pass, 0 fail, 0 skipped, 1 existing TODO (CUST-1001 QID mismatch), 20 s | `/tmp/claude/g-test.log` |
| Per-family unit runs | `node --test` on the family's files | Label / Card (20 of 20), Checkbox (31 of 31), Button (42 of 42), Standard inputs (45 of 45), Tabs (37 of 37), Dialog (22 of 22), specialised (20 of 20), architecture and tokens (14 of 14) | session log |
| E2E, accessibility, visual | `PORT=5180 npx playwright test --reporter=json` (before the touch leave-prompt checks were added: 146 passed, 22 skipped, 0 failed, 193 s; afterwards: 156 passed, 12 skipped by design, 0 failed, 0 flaky, 193 s) | `/tmp/claude/pw-gate.json` |
| Production build | `npm run build` (`tsc -b && next build`) | exit 0, 11 s | `/tmp/claude/gate-build.log` |

Playwright by spec and project (passed / skipped): `a11y` 11/0 desktop, 5/6 tablet, 5/6 mobile; `button` 4/4/4; `checkbox` 2/2/2; `enterpriseAccountCreation` (the Label + Card + Checkbox pilot, with axe) 6/6/6; `input` 2/2/2; `overlays` 17/0 desktop and the same on tablet and mobile once the touch journey could be made dirty (see below); `protected` 6/6/6; `sweep` (20 screens and 14 library groups, pixels and accessibility tree, light and dark) 4/4/4; `tabs` 4/4/4. The skipped ones are the checks that do not vary by viewport (colour tokens, axe).

### Per family
- **Label, Card.** Equivalence proven structurally: an AST comparison of all 676 converted elements against git HEAD found the same class tokens (673 identical; 3 where a redundant attribute was dropped). Pixel and accessibility-tree sweeps before and after were identical (20 screens x 6, library groups). Pilot spec: card geometry snapshots, axe, label click-through.
- **Checkbox.** The tick is the app's own SVG path (`CHECKBOX_TICK`), the tile is the app's class; `checkbox.spec` (table row select, Space, no row click, library specimens), the pilot and `baselineContracts` (role, name, checked, disabled). One measured 1px baseline difference in a table cell was corrected at the call site (`align-[1px]`) and re-verified.
- **Button.** 353 call sites verified by AST (variant, size and prop mapping, one intended adapter); `button.spec` (type=button everywhere, form behaviour, gradient via `data-variant`); `styling.test` (variant and size to class); all sweeps identical. Hover and active are CSS-defined and were not screenshotted (the tooling cannot drive hover).
- **Standard inputs.** `input.spec` (label association, border colour against the design token, `aria-describedby`, `role=alert`, read-only `tabindex=-1`, numeric keypad); sweeps identical; field-border contrast measured in `a11y.spec`.
- **Tabs.** `tabs.spec` ran on the hand-written strip first (the baseline) and on Radix after, 12 checks; sweeps and the library "Tabs" group were identical in pixels and tree.
- **Dialog.** Pre-change snapshots of Modal, Drawer, the Reject Lead drawer and its open Select (light and dark, three viewports) matched after the change; `overlays.spec` (container focus, `aria-labelledby`, scroll lock, hidden page, Escape, focus return, scrim, Tab trap, nested overlays, leave prompt on desktop, no Radix console warnings, axe).
- **Accessibility tokens.** Before the change the full suite showed 330 pixel differences, all in dark and all field edges or the header search box, none in light, no accessibility-tree change; reviewed and accepted by the owner's decision; contrast measured in `a11y.spec` (3:1 or more in light and dark; axe clean on all groups).
- **Accessibility, all families.** `a11y.spec`: field borders, focus rings (teal in light, `--fg` in dark, every control), skip link, route announcements, radio groups, native disabled, axe on 13 groups, light and dark; `accessibilityAudit.test.mjs` untouched.

### Approved visual differences
| Difference | Family | Reason | Decision |
|---|---|---|---|
| Dark field edges and the header search border are brighter (`#707a8e`) | Accessibility tokens | WCAG 1.4.11 (the old edge was 1.6:1) | accepted, owner decision |
| Error text and edge `#d40000`, green tag label, dark danger text | Accessibility tokens | axe `color-contrast` at 4.35 to 4.48:1 | accepted, owner decision |
| Dialog leave-prompt desktop baseline refreshed | Dialog | the page behind showed a different scan state; the dialog itself was identical | accepted |
| Dev showcase page (not an app screen) refreshed | Dialog, Tabs, Button | the showcase was edited | accepted |

## 4. Files changed by Point 9
| File | Family | Why |
|---|---|---|
| `docs/migration/release-gate.md` (new) | all | the authoritative matrix and evidence |
| `tests/releaseGate.test.mjs` (new) | all | keeps the matrix honest: every installed shadcn component and every family is listed; only the allowed vocabulary; an overall COMPLETE needs every gate PASS |
| `e2e/overlays.spec.ts` | Dialog | the dirty-journey helper now works on touch (upload, QID number and expiry, Fetch); the touch leave-prompt checks and baselines were added |
| `e2e/overlays.spec.ts-snapshots/overlay-leave-prompt-{tablet,mobile}-{light,dark}-*.png` (new) | Dialog | first baselines of the leave prompt on touch, reviewed |

No production source was changed in Point 9.

## 5. Commands executed
`npx tsc -b` (exit 0); `npm run lint` (exit 0); `npm test` (exit 0); per-family `node --test ...` runs (exit 0 each); `PORT=5180 npx playwright test --reporter=json` (exit 0); `npm run build` (exit 0); duplicate-system greps (below); two rollback rehearsals: Tabs and Dialog (restore the pre-migration files from `git show HEAD:<file>`, `npx tsc -b`: exit 0, 0 errors each; files restored afterwards) and Accessibility tokens (reverse the token and badge lines, token / architecture / accessibility unit tests 20 of 20; restored).

## 6. Failures and resolutions
| Family | Gate | Category | Root cause | Action | Result |
|---|---|---|---|---|---|
| Dialog | Tablet, Mobile | missing coverage (test environment) | a touch journey could not be made dirty: an upload alone identifies nobody, and Fetch stays disabled until the expiry date is typed | the helper uploads, fills the QID number and expiry, presses Fetch | PASS (16 of 16 leave checks and baselines on touch) |
| Label ... Standard inputs | Independent rollback | process | nothing committed; interleaved edits | none possible without a commit decision | FAIL |
No migration-related functional, accessibility, responsive, dark-mode, type or build failure was found in this session. No production logic changed.

## 7. Duplicate-system audit
| System | Finding |
|---|---|
| Tooltip | one: `primitives/Tooltip.tsx` (+ `TooltipGroup`). No Radix tooltip, no `TooltipProvider` anywhere in `src`. |
| Toast / notifications | one: the Redux slice and `ToastContainer`, mounted once. No Sonner (package and component removed in Phase 5), no Radix Toast. |
| Dialog / overlay | one dialog implementation (`ui/dialog.tsx`, used only by `Modal` and `Drawer`); the hand-written focus hook is deleted; one `OverlayPortal` remains only for the library specimen; the Tooltip and the actions popover keep their own portals (unchanged). |
| State | Redux only; no Zustand, no new context (the only `createContext` is the existing tab-depth one); no form library added. |
| Providers | the only global provider is the Redux `Provider` in `AppFrame`. |
| Router | no `react-router`. |
Enforced by `tests/protectedComponents.test.mjs` and `tests/overlayContracts.test.mjs`.

## 8. Specialised-component preservation
Diff against HEAD (lines): Select +1, PhoneNumberInput +1, DataTable +1, Tooltip +1, TooltipContext 0, notification slice +1, ToastContainer +1 (each +1 is only the `PROTECTED` header comment); QidInput +3/-2 and SignaturePad +3/-2 (their buttons now use the shadcn Button, the documented COMPOSE decision; logic untouched). Their behaviour is characterised by `protected.spec` (18 browser checks) and `protectedComponents.test` (12 node tests), all passing. The shared dark token change (Accessibility tokens) recoloured their field edges and error text, as it did every field. No specialised component was replaced, duplicated or simplified.

## 9. Rollback plan per family
| Family | Scope and files | Restore | Dependencies on other families | Verify after | Limitations |
|---|---|---|---|---|---|
| Tabs | `ui/tabs.tsx`, `primitives/TabStrip.tsx`, `primitives/SegmentedTabs.tsx`, tests `ui.test` / `baselineContracts` (tab blocks), `e2e/tabs.spec.ts`, `styling.test` (tab block), library snapshots (unchanged pixels) | `git show HEAD:<file>` for the three source files; revert the tab test blocks | none (consumers unchanged) | `npx tsc -b`, `npm test`, `npx playwright test tabs sweep` | rehearsed with `tsc` only; the PageUp / PageDown test is replaced by the old "ignored" expectation |
| Dialog | `ui/dialog.tsx`, `primitives/Modal.tsx`, `primitives/Drawer.tsx`, deleted `primitives/useDialogBehaviour.ts`, `overlayContracts.test`, `baselineContracts` (overlay block), `e2e/overlays.spec.ts` | `git show HEAD:<file>` for the four source files | none (consumers unchanged); Modal / Drawer SSR fallback goes with them | `npx tsc -b`, `npm test`, `npx playwright test overlays sweep` | rehearsed with `tsc` only; the approved scroll lock / `aria-hidden` / `aria-labelledby` changes revert with it |
| Accessibility tokens | `src/tokens.css` (4 values), the `.badge-tag-green` line in `src/ui-components.css`, `baselineContracts` token test, `a11y.spec` contrast and axe expectations, the 12 refreshed dark baselines | restore the old values (listed in section 5) | none | `npm test`, `npx playwright test a11y sweep` | the dark snapshots are untracked and were overwritten: they must be regenerated after a rollback |
| Label, Card, Checkbox, Button, Standard inputs, Foundation | not independently revertible (section 2) | the whole migration can be reverted as one unit: `git checkout 3d061b1 -- src tests package.json package-lock.json ...` then `npm install` | all five share ~130 files and the `ui/` directory | `npx tsc -b`, `npm test`, `npm run build` | needs the commit decision above |

## 10. Remaining risks
- Rollback is not independently possible for six families until a commit strategy is chosen; the Playwright snapshots (27 MB) and every report in `docs/` are untracked.
- The pre-migration build was never run beside this one (approval to create that worktree and dev server was denied); before / after evidence is the chain of snapshots taken immediately before each family's change. Journey steps beyond step 1 are covered by the AST and prop-mapping checks and the retained unit suites, not by pixel snapshots (the sweep's journey route is the "No Access" page for its user).
- Hover and active appearances are defined in CSS and were not captured. Screen readers, forced colours, zoom / reflow and on-screen keyboards were not exercised.
- `npm install` / `npm audit` reported 2 high-severity advisories earlier; not investigated.
- Deployment approvals (security, product, stakeholders) are outside this gate.

## 11. Final statement
**Point 9 is incomplete.** Of nine families, three are COMPLETE (Tabs, Dialog, Accessibility tokens) and six are INCOMPLETE on the independent-rollback gate (Foundation, Label, Card, Checkbox, Button, Standard inputs); the owner accepted shipping those as one unit (`81f0923`), which does not make the gate pass. The component-level release gate has not passed.
