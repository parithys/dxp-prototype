# Phase 6 - Select, Modal and Drawer

Outcome: **Modal and Drawer are now the shadcn / Radix Dialog**, migrated together (one layer stack) with the approved behaviour changes; **Select is
retained** (the app has no standard Select and the searchable combobox has no shadcn equivalent). The audit, the measured conflict that forced the
all-at-once approach, and the behaviour contract are below. The user's decision was "migrate all to Radix" (the options were: retain; approve the deltas and
migrate everything together; fix the accessibility gaps in the legacy hook).

## Readiness gate
| Requirement | State |
|---|---|
| shadcn themed (button, input, label, card, checkbox, textarea) | yes (Phases 1, 4); the Dialog is themed in this phase; Dropdown and Tabs are still stock |
| Phase 2 baseline, Phase 3 pilot, Phase 4 families | present; pilot PASS; Phase 4 PARTIAL |
| Playwright + axe | installed; runs in a terminal (`PORT=5180 npx playwright test`) |
| Snapshots, 3 viewports, light / dark | `e2e/sweep.spec.ts`, `e2e/overlays.spec.ts` |
| Overlay behaviour captured before the change | yes: the legacy contract was automated and snapshotted (Modal, Drawer, Reject Lead drawer + open Select, leave prompt; light / dark; desktop / tablet / mobile) **before** any overlay code changed, and the same snapshots were compared after |
| Gap | the sweep's `journey-start-connection` screen is the "No Access" page for its user; journey overlays are covered by `overlays.spec.ts` (Retail Sales, VFQ12341) |

## Inventory
### Select
| Implementation | Path | Usages | Category | Decision |
|---|---|---|---|---|
| `Select` | `primitives/Select.tsx` | 69 tags | **B - searchable combobox, always** (typing filters, `aria-activedescendant`, PageUp/Down) | **RETAIN** |
| Native `<select>` | `patterns/DemoFaultPanel.tsx` | 3 | **D - native**, demo-only | RETAIN |
| Customer 360 inline selector | `customer360/sections/C360Kit.tsx` | 1 | **C - domain** | RETAIN |
| Company / location search, phone country | `CompanySearchInput`, `ServiceLocationSearchInput`, `PhoneNumberInput`, `ContactPhoneInput` | 5 | B / C (Phase 5) | RETAIN |

There is no category-A standard Select, so the standard-Select gate has nothing to migrate.

### Modal: 16 tags in 13 files (all now on the Radix Dialog through `primitives/Modal.tsx`, no call site changed)
Confirmation (EligibilityOutcomes), Form (ExceptionRequest, AddDiscount, ApplyAddonDiscount, WaiveOff, ActivationComplete Add Comments, FamilyPackagePanel), Informational / confirmation (AddConnection), Destructive / journey (Abandon this order?, Save as Draft; PortInStatus cancel; NumberManagement x2), **Leave-warning** (Leave this journey?; PersonaSwitcher sign-out / role switch).

### Drawer: 40 tags in 24 files (all now on the Radix Dialog through `primitives/Drawer.tsx`, no call site changed)
Form drawers (Customer 360 edit x8, Lead details x4, Order approval x4, SIM swap x2, Ticket drawers x5 + approval review x3 + New Trouble Ticket), informational (Offer details, Prepaid pack, Recharge country, Eligibility rows, document viewer, Query preview), journey / navigation-sensitive (VerificationGate, CustomerActionsMenu, ForgotPasswordFlow).

## Why all at once
A stock Radix Dialog stacked with the OLD overlays broke: focus stayed in the Radix content, the old Modal inherited `pointer-events: none` from `<body>`
(none of its buttons could be clicked) and one Escape closed both layers. A Modal-by-Modal or Drawer-by-Drawer migration would have created that wherever
one overlay opens another, so every overlay moved together. Nested Radix layers were then verified: a Modal over a Dialog takes focus, stays clickable,
one Escape closes only the top layer and focus returns into the outer dialog.

## The contract now (and what changed)
| Property | Before (hand-written hook) | Now (Radix Dialog + the app's wrapper) |
|---|---|---|
| Body scroll | not locked | **locked** while open (approved change) |
| Page behind | not hidden | **`aria-hidden`** (approved change) |
| `<body>` pointer events | untouched | `pointer-events: none` while open (Radix); the app's toasts keep `pointer-events-auto` on their cards |
| Name | `aria-label` | **`aria-labelledby`** the title (approved change); `aria-modal="true"` kept; no invented description |
| Initial focus | the dialog container | **unchanged**: the container (Radix's first-control default is overridden) |
| Tab | wrapped | wrapped (Radix focus trap) |
| Escape | top layer only; a Select closes its list first | **unchanged**: top layer only (Radix stack); an open combobox keeps its own Escape (`onEscapeKeyDown` guard) |
| Scrim click | Modal closes, Drawer does not | **unchanged**: a Modal closes, a Drawer does not (`onInteractOutside` prevented for the drawer) |
| Focus return | the opener | **unchanged**: the opener (captured as Radix moves focus in; the dialogs are controlled, so Radix has no trigger to return to) |
| Drawer motion | slide in / out over `--motion-base` (220 ms), unmount after | the same, via `tw-animate-css` classes; the scrim is kept mounted for as long as the panel slides |
| Portal | `OverlayPortal` to `<body>` | Radix Portal to `<body>` (`OverlayPortal` remains only for the library specimen) |
| Server render | content in place | Modal / Drawer render the content in place when there is no `document` (the tests render screens that way); the app is client-only |
| Leave prompt, Back, reload | `useBlocker` + `beforeunload`; Back / Forward not intercepted | **unchanged** (no navigation code was touched) |

Removed: `primitives/useDialogBehaviour.ts` (the focus / Escape / Tab hook). Replaced: `components/ui/dialog.tsx` (stock, unused) is now the app's themed Dialog, imported only by Modal and Drawer.

## Decisions
| Family | Component | Risk | Decision | Status | Validation |
|---|---|---|---|---|---|
| Select | Standard Select | - | DEFER (nothing eligible) | Complete | - |
| Select | Searchable `Select` and domain selectors | High | RETAIN | Complete | unit + `protected.spec` + sweep; Escape-in-a-Drawer test |
| Modal | all 13 files, incl. destructive confirmations | Critical | **MIGRATE** (wrapper) | Validated | `overlays.spec`, visual snapshots unchanged, axe |
| Modal | Leave this journey? / PersonaSwitcher | Critical | **MIGRATE** (wrapper) - same component, same props | Validated | `overlays.spec`: one prompt, Escape and scrim stay, Abandon leaves, dirty reload raises `beforeunload` |
| Drawer | all 24 files | High | **MIGRATE** (wrapper) | Validated | `overlays.spec`, visual snapshots unchanged, axe, Select-in-Drawer Escape |
| Overlay | `useDialogBehaviour` | - | removed (no consumer) | Complete | `overlayContracts` |

## Evidence
- Visual: the pre-migration snapshots (Modal, Drawer, Reject Lead drawer, the same drawer with its Select open; light and dark; desktop, tablet and mobile) all match after the change. The leave prompt (desktop) differed only in the page behind it (the journey's scan had finished in the new run but not the old one; the dialog itself was identical); its baseline was refreshed after making the test wait for the scan.
- Browser: Modal (container focus, `aria-labelledby`, scroll locked, page hidden, Escape, focus return, scrim, inside click, repeated open / close leaves no lock or `pointer-events` style, no Radix console warnings, axe serious / critical none), Drawer (same plus the scrim does nothing), Tab stays inside, Select inside a Drawer (Escape closes the list, then the drawer, focus returns), nested Modal over Dialog, the shared Dialog on the showcase, leave prompt flow and reload.
- Unit: `tests/overlayContracts.test.mjs` (wrappers, the Dialog's four app-specific behaviours, no hand-written scroll lock, no popstate, the two `beforeunload` sites).
- Timing note: Radix arms its outside-click and layer registration a tick after mount, so the browser tests wait ~400 ms before a scrim click or an Escape over a nested layer.

## Existing gaps (not caused by this change)
- Shift+Tab from the dialog container itself is not wrapped by the app's own focus handling; Radix's trap pulls focus back, which is the same visible result.
- Two `beforeunload` sites (`useBlocker`, `PersonaSwitcher`) can both arm the browser prompt.
- Browser Back / Forward are not intercepted by the leave guard (a Next App Router limit).
- The sweep's journey screen is the "No Access" page for its user.
- (Closed in Point 10.) A touch device has no scan simulator; its dirty-journey tests upload a front and back, type the QID number and expiry and press Fetch, and run on all three projects.

## Files
Created: `e2e/overlays.spec.ts` (+ snapshots), `tests/overlayContracts.test.mjs`, this document. Modified: `components/ui/dialog.tsx`, `primitives/Modal.tsx`, `primitives/Drawer.tsx`, `dev/UiShowcase.tsx`, tests (`baselineContracts`, `pilotEnterpriseAccount`, `protectedComponents`), `CLAUDE.md`, the migration matrix. Deleted: `primitives/useDialogBehaviour.ts`.
