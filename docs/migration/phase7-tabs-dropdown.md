# Phase 7 - Tabs and Dropdown Menus

Outcome: **the app's tab strips are now the shadcn / Radix Tabs** (`TabStrip` and `SegmentedTabs`, 20 files, call sites unchanged). **Dropdown Menu: nothing to
migrate** - the app has no standard dropdown; its two menus are domain / navigation components.

## Tabs
| Component | Path | Usages | Decision |
|---|---|---|---|
| `TabStrip` (underline strip) | `primitives/TabStrip.tsx` | 11 tags | **MIGRATE** - now Radix Tabs through `components/ui/tabs.tsx` |
| `SegmentedTabs` (same look, filter intent) | `primitives/SegmentedTabs.tsx` | 9 tags | **MIGRATE** - a thin wrapper over `TabStrip` (the two had duplicate code) |
| `Tabs` (vertical list / numbered rail, `IconRail`) | `primitives/Tabs.tsx` | its own layouts | **RETAIN** - a side navigation list, not an underline strip (only its horizontal case already used `TabStrip`) |
| `TabLevel` (`NestedTabs`, `PageLevelTabs`) | `primitives/TabLevel.tsx` | context only | unchanged |

The look is the app's own classes (`tab-strip`, `tab`, `tab-active`); the shadcn Tabs is themed to them and the stock utilities are gone. The root is
`display: contents`, so a strip sits exactly where the old one did. No tab points `aria-controls` at a panel (the app renders the selected view itself).

### Contract: before and after (measured, `e2e/tabs.spec.ts`)
| Property | Hand-written strip | Radix Tabs |
|---|---|---|
| Roles | `tablist` (named), `tab`, `aria-selected` | the same; Radix adds `aria-orientation`, `data-state`, a wrapper `dir` attribute |
| `aria-controls` / `tabpanel` | none | none (overridden; a dangling reference would be an axe failure) |
| Arrow Left / Right | move and select, wrap | the same |
| Home / End | first / last | the same |
| PageUp / PageDown | ignored | **first / last** (additive, a Radix key) |
| Up / Down | ignored | ignored |
| Enter / Space on the selected tab | nothing | nothing |
| Tab key | only the selected tab is a tab stop | the strip is the one tab stop and hands focus to the selected tab; once focus is inside, only the selected tab is (roving) |
| Mouse | selects on click | selects on mouse-down |
| Axe on the strips | no serious / critical | no serious / critical (recorded set is empty before and after) |

Accepted deltas: PageUp / PageDown, the strip as the entry tab stop, activation on mouse-down. The first two are Radix's roving-focus model; none changes what a keyboard or mouse user ends up with.

### Evidence
- 12 browser checks (desktop, tablet, mobile): roles and counts, tabindex before and after focus, arrow wrapping, Home / End, Enter / Space, Up / Down, Tab leaves the strip, PageDown, axe. The suite passed on the hand-written strip first (as the baseline) and on Radix after.
- The 20-screen sweep and all 14 library groups, including "Tabs" (pixels and accessibility tree, light and dark, 3 viewports), are identical before and after; only the dev showcase differs (its tabs are themed now).
- A test lesson: the route announcer moves focus to `<main>` 150 ms after a route change, so browser tests must wait before keyboard steps (it looked like a Radix focus bug until traced).

## Dropdown Menu
| Candidate | Why it is not a standard dropdown | Decision |
|---|---|---|
| `CustomerActionsMenu` (`workspace/customer360`) | persona-driven navigation items, journey launch, a Drawer fallback, a portalled popover | RETAIN (domain) |
| Header profile menu (`PersonaSwitcher`) | navigation; role switch / sign-out with the leave guard | RETAIN (navigation) |
| shadcn `dropdown-menu.tsx` | installed, stock look, no consumer | **DEFER**: kept, unused, guarded by `tests/protectedComponents.test.mjs` (no import outside the showcase) |

## Files
Created: `e2e/tabs.spec.ts`, this document. Modified: `components/ui/tabs.tsx` (themed), `primitives/TabStrip.tsx`, `primitives/SegmentedTabs.tsx`, tests (`ui`, `baselineContracts`, `pilotEnterpriseAccount`, `protectedComponents`), `CLAUDE.md`, the migration matrix.
