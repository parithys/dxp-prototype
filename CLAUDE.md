## Repository split: design system vs prototype (2026-11-21)

The design system is a separate package, `dxp-ui` (sibling folder `../dxp-ui-library`, its own repository). It owns `components/ui`, the generic `components/primitives`, the generic `lib` / `hooks`, the icon library (`assets/icons`), the design tokens, the Tailwind preset and the semantic component classes (`tokens.css`, `preset.css`, `components.css`). This repository keeps the journeys, routes, business logic, mock data and the application's own classes (`src/app-components.css`, `src/app-base.css`, `src/tablet.css`). Import every design-system component, icon, token helper and hook from `'dxp-ui'`; never copy one here (a component the app needs that the library lacks goes in `LIBRARY_GAPS.md`). Wherever the rules below name a design-system path (`src/components/ui`, `src/components/primitives`, `src/assets/icons`, `src/ui-components.css`, `src/tokens.css`), the file now lives in the library repository under the same relative path (`src/styles/components.css`, `src/styles/tokens.css`) and its rules are enforced by the library's own tests.

## Role master workbook — MUST be updated with every new feature or role

`reference/outputs/Persona_Feature_Applicability_Matrix_Reference.xlsx` is the
**single source of truth** for the 26 operational roles: Staff IDs, the demo
password, persona groups, business units, approach classification, capability
(action) gates, which implemented feature each role may reach, and which
sidebar destinations each role sees. It is **generated**, never hand-edited —
opening it in Excel and saving will silently rewrite it.

Seven sheets: **Roles & Credentials** (start here), **Applicability Matrix**
(feature × role), **Capabilities** (action gates), **Feature Inventory**,
**Navigation** (sidebar destinations per role, incl. product-line journey
categories), **Legacy Crosswalk** (66 → 26), **Legend & Method**.

**Whenever you add/remove a feature, screen, role or nav destination,
regenerate it in the same change** — it is not a follow-up task:

1. Edit the source, not the workbook: roles, grants, capabilities and Staff IDs
   live in `public/config/personas.json`; feature keys and their screen ids in
   `public/config/feature-catalogue.json`; nav destinations in
   `src/navigation/navManifest.ts` + `src/engines/navigationEngine.ts`, and
   product-line journeys in `src/navigation/journeyCatalogue.ts`.
2. Regenerate: `python3 reference/scripts/build_persona_feature_matrix.py`

Nothing in the workbook is restated by hand — the demo password is parsed out
of `staffIdRoleMap.ts`, the capability vocabulary out of `types/config.ts`, the
built-screen set out of `registerScreen()` calls, and the Navigation sheet out
of the nav manifest + approach map + journey catalogue. If you find yourself
typing a value into the script that already exists in source, parse it instead.

Rules the script enforces — do not work around them:

- Only *implemented* features appear as built. The built set is discovered from
  `registerScreen()` calls, the same registry the router uses to choose between
  a real screen and `<ScreenNotYetBuilt>`. A granted feature whose screens
  aren't registered shows as `Planned`, deliberately — it stays visible to
  indicate planned functionality rather than disappearing.
- A `✓` means `personas.json` actually grants that feature to that role.
  Nothing is inferred and nothing is hand-ticked. **Blank means deliberately
  not granted** — grants are exhaustive for the 26 roles. (This inverts the
  pre-2026-09-24 model, where a tick required an `rbac.json` evidence row and
  blank meant "the corpus never said".)
- The script **aborts** rather than emit a misleading workbook if: a capability
  is gated in code or granted in `personas.json` but missing from the
  `PersonaCapability` union in `types/config.ts`; a grant references an unknown
  feature key or permission level; a catalogue entry references a screen absent
  from `routes.json`; a Staff ID or role id is duplicated; a role binds an
  identity absent from `users-agents.json`; or the navigation source no longer
  parses to the expected shape (4 approaches, 20 manifest entries, 4 categories
  per product line).
- It **also aborts on app wiring that is broken rather than merely
  undocumented**, because a generated workbook would otherwise report broken
  wiring as working: a journey gated on a feature key that doesn't exist; a
  journey marked `available` whose screen isn't registered; a dashboard quick
  action targeting an unregistered screen; a nav destination with no matching
  `<Route path>` (it would fall through to `/:moduleSlug` and render "Module
  not found."); a declared search group with no searcher; a catalogued feature
  key granted to no role; or a role with zero grants.

  If it aborts, fix the source — that abort is the feature working. Every one
  of these guards has been negative-tested by deliberately breaking the source.

Superseded persona records (historical, **not** authoritative):
`reference/docs/VFQ_DXP_Personas_Reference.xlsx` → "Personas" (the 66-persona
model), and `reference/outputs/Test_Data_Reference.xlsx` → "Login
Credentials" / "Persona (Original)" / "Persona by Approach". The 66-persona
model, its RBAC evidence and the two columns unique to that workbook are
archived under `reference/blueprint/legacy/`.

⚠️ Those three sheets in `Test_Data_Reference.xlsx` — "Persona
(Original)", "Persona by Approach" and "ID Lookup (MOI Fetch)" — are **not
produced by `scripts/build_test_data_reference.py`**. The workbook on disk has
19 sheets; a regeneration writes 16 and silently drops those three. So despite
the "generated, never hand-edited" rule that applies to the role matrix above,
this particular workbook currently carries content the script cannot rebuild.
Re-create those sheets in the script before regenerating it, or the history
goes.

## Project structure

This directory (`vfq-dxp-app/`) is the single source of truth for the
application — it is fully self-contained (verified 2026-08-25: no import,
fetch, or config reaches outside this directory). `reference/` alongside
`src/`/`public/` holds distilled reconstruction documentation (requirements,
business rules, journeys, personas, screen catalogue, process diagrams,
source-confidence policy) that fed the app's construction but is not consumed
by it at runtime — treat it as background material, not part of the active
implementation, unless a task explicitly asks you to consult it.

The raw source corpus this documentation was built from — `data/`,
`Guided Journeys/`, `Workshop Recordings/` — lives one level up, at the
project root (sibling to this directory), not inside it. Citations inside
`reference/` documents of the form `data/<file>` refer to that root-level
`data/` folder, i.e. `../data/<file>` relative to this directory.

## Knowledge base

Before answering questions about the VFQ (Vodafone Qatar) stack modernization
project — workshops, business process reviews, business requirements specs
(BRSDs), business rules, customer forms, or Guided Journey UI walkthroughs —
read `reference/.knowledge/INDEX.md` first, then open only the specific
`reference/.knowledge/docs/<slug>.md` files the question requires. Do not
answer from the index one-liner alone when the question needs detail — open
the summary. Cite the slug in your answer so claims trace back to a source
document.

If `reference/.knowledge/INDEX.md` reports a document as low-confidence or
failed, say so rather than answering from it.

`../Guided Journeys/` files (one level up, at the project root) are
screenshot-driven UI walkthroughs. Plain text extraction (pandoc/markitdown)
recovers almost nothing from them — the content lives in embedded PNG
screenshots. As of 2026-08-21, all 39 of these documents have been
re-processed by extracting each `.docx`'s embedded images (it's a ZIP
container; images live under `word/media/`, true reading order comes from
`word/_rels/document.xml.rels` + the `r:embed` sequence in
`word/document.xml`) and viewing them directly, recovering full field-level
procedural detail — 38 are `high` confidence, 1 `medium`. If new files are
added to this folder later, or a fresh corpus has the same screenshot-only
problem, use this same image-extraction + direct visual reading approach
rather than relying on text extraction alone.

## Customer inventory - kept in sync with the app's data

`reference/outputs/02 Customer-Inventory.xlsx` (the seeded customer inventory) and the app's mock data (`public/mock-data`) are ONE contract and must
never drift: every customer in either is in both, with the same details and the same associated data - identity, lines, blacklist, risk class (HRN),
employer, identity documents, and what they owe (unpaid bills and payment due, by `src/engines/billingBalance.ts`). A customer present on one side only
is a failure in both directions. The workbook is **generated**, never hand-edited (the next regeneration overwrites an edit).

Every addition, change or deletion goes through the script and lands in BOTH sources in one command:

- **Add**: add a `P(...)` entry to `PROPOSED` (and the name to `NAMES`) in `reference/scripts/build_customer_inventory.py`, then `npm run sync:customers`
  (seed the mock data, regenerate the workbook, verify). Anything the customer needs in the app (bills for a collections block, lines, accounts) is seeded by the script.
- **Change** an added customer: `python3 reference/scripts/build_customer_inventory.py --remove CUST-xxxx`, edit its entry, `npm run sync:customers`.
- **Delete** an added customer: delete its `P(...)`/`NAMES` entry, `python3 reference/scripts/build_customer_inventory.py --remove CUST-xxxx`, then `npm run sync:customers`.
  `--remove` deletes only records the script wrote (tagged `Customer-Inventory ...`) and refuses an original demo customer.
- **Check**: `npm run verify:customers` (`reference/scripts/verify_customer_inventory_sync.py`; exits 1 listing each difference, prints "In sync." when clean).
  `tests/customerInventorySync.test.mjs` runs it inside `npm test` against a freshly generated workbook AND against the file at `reference/outputs`, so editing
  `public/mock-data` (or the workbook) without the script fails the suite. Do not edit a seeded customer's records in `public/mock-data` by hand.

## Capability Library - change a shared capability once

Every reusable capability (Customer Identification, Number Selection, Plan Selection, Payment, ...) has ONE implementation
under `src/capabilities/<Name>/`, listed in `src/capabilities/registry.json`. Journeys import from the barrel
(`src/capabilities/index.ts`), never a capability's parts. To change one, edit it there (or run the `update-capability`
skill) so every journey picks it up; then run `python3 reference/scripts/build_reusable_capabilities_inventory.py`,
which regenerates `consumers.generated.json` and the inventory workbook and must report 0 bypass imports. See
`src/capabilities/README.md`.

## API layer - the only way to read or write data

Every read and write of a record goes through the RTK Query API layer in `src/services/` (`apiSlice.ts`: one `createApi`, typed endpoints, tags).
Screens use the hooks in `services/entityHooks.ts` (`useEntityRecords`, `useKindPending`, `useEntityOps` ...), code outside React uses
`services/entityOps.ts` (`entityOps`, `listEntities`, `getEntity`). `engines/mockDataEngine.ts` is the mock BACK END behind `services/mockData.ts`:
nothing else may import it (`tests/architecture.test.mjs` enforces it). Add an endpoint in `apiSlice.ts` (handler in `mockData.ts`, types in
`services/types.ts`); to go live, swap each `queryFn: mock(handler)` for a `query`. Do not write to the mock engine directly - a write that bypasses
the API layer leaves its cache stale.

## Data & business-rule guardrails - read before classifying, filtering or deriving anything

The recurring defect here is code that invents its own reading of a record (a field that merely correlates in the sample data) and silently
drops or mislabels the rest. Example: a journey took the promotion code on an installed asset to say what the line is, then matched names
against the plan catalogue, and offered 1 of a customer's 20 postpaid lines. Rules:

1. Search for an existing definition before writing one. What kind of service/line something is: `classifyProductName` /
   `mobileLineTypeOfName` / `LIVE_SERVICE_STATUSES` in `src/engines/customerServicesEngine.ts` (the one Customer 360 uses). Reuse the
   engine, capability or model that already answers the question; do not add a second regex, `===` on a name/code, or `.find` by name.
2. Never infer a domain meaning from a field that correlates with it. Promotion/product codes, plan names and labels are not service
   types. Check the data model and an existing definition first; if there is no evidence, the value is unknown.
3. Unknown stays unknown: no `unknown -> postpaid / eligible / approved / active` defaults. Use an explicit state (`Other`,
   `undefined`) and keep the record visible.
4. Never validate a rule against records that rule selected. Validate it over the whole dataset (`public/mock-data`) against an
   expectation written independently of the code (a table of what each distinct value IS), and check BOTH false positives and false
   negatives.
5. Cover many-record and mixed cases, not one convenient customer (CUST-1001 is clean): zero lines, one, 20+, postpaid + prepaid,
   mobile + fibre/FWA, contradictory fields, null/unknown values. Add conservation checks (`offered + excluded = original`).
6. Do not fit a fix to a record (`CUST-xxxx`, one plan, one code). Fix the mechanism.
7. A shared definition changed means every consumer is re-verified (search the imports) before the change counts as done.
8. Do not call a rule correct until `npx tsc -b`, `npm run lint`, `npm test` and `npm run build` have actually run and passed.

`tests/classification.test.mjs` is the pattern (independent expected table, whole-population invariants), and `tests/assumptions.test.mjs`
guards against new ad-hoc classification of service names outside the engine.

## Shared assets - one dedicated place each

Reusable assets live in one dedicated location, not beside the component that happens to use them:

- **Icons**: every SVG icon path is an export of `src/assets/icons/` (`navigation.ts`, `actions.ts`, `status.ts`, `objects.ts`;
  `stepIcons.ts` maps wizard step keys to icons, `journeyIcons.ts` maps service journeys). Import from `src/assets/icons`; never write a
  path string (`'M12 5v14 ...'`) in a component, screen or config. To add an icon, add one `export const NAME = '...'` to the right
  file - the library test fails on a duplicate name or a path under two names. `assets` imports nothing else in the app. The only
  path data allowed elsewhere is bespoke artwork drawn inside its own SVG component (logos, country markers, ID-card specimens,
  `PanelIcon`, the step-status discs); the `ARTWORK` list in `tests/architecture.test.mjs` names them.
- **Images and logos**: `public/brand/`. **Design tokens and global styles**: `src/tokens.css`, `src/index.css`. **Fonts**: the single
  `<link>` in `app/layout.tsx`.
- Card hover changes the fill (`hover:bg-[var(--field-card-hover-bg)]`, a pale teal) and the border colour (`hover:border-[var(--field-focus-border)]`, the form fields' focus border), never a ring or shadow; a test enforces it. A selected card keeps its own border.

## Semantic UI classes

Reusable UI looks live in `src/ui-components.css` (`@layer components`, `@apply` over tokens), named
`.component`, `.component-variant`, `.component-size`, `.component-state`: `.btn .btn-primary .btn-lg`, `.card .card-selected`,
`.form-control .form-control-error`, `.tab .tab-active`, `.badge .badge-success`, `.modal-dialog`, `.dropdown-popover`,
`.caption-heading`, `.data-row`, `.link-action`, `.scan-corner-*`.
Layout vocabulary (`.row`, `.row-tight`, `.split`, `.cluster`, `.stack-center`), option cards (`.option-card`, `.card-option`), callouts
(`.notice-*`), chips and tags (`.chip*`, `.tag-*`) and popovers (`.popover`, `.popover-surface`) are in the same file. Text roles (`.title-*`, `.body-text`, `.caption-*`, `.eyebrow`), layouts (`.row-between`, `.spread`, `.actions-end`,
`.fields-*`, `.stack*`), `.icon-*`, `.dot*` and `.pad-*` too. A `className` may carry at most 3 utility classes
(classes defined in `ui-components.css`/`index.css` do not count): its static classes plus, per `${...}`, the largest class string in that
expression - and the same limit applies to any class-list constant or branch string in `src/`. `tests/classNameBudget.test.mjs` enforces it
(its baseline is empty and may only shrink). A semantic class beside a utility that sets the same property loses to the utility (component
layer < utilities), so put such a property in a class too (`.field-fill`, `.rail-item-narrow`) rather than leaving the utility. Do not name a class like a Tailwind utility (`columns-2` broke one).
One style, one class: `tests/semanticCssDuplicates.test.mjs` fails when two classes carry the same (or ~the same) utility set or a class is
unused. Express a variant as a modifier on its base (`.title` + `.title-lg`, `.row` + a `gap-*` utility, `.link` + `.focus-ring`) and classes that
share base properties as one grouped rule (`.a, .b { ... }`), never as a copy.
`python3 reference/scripts/build_ui_component_inventory.py` regenerates `reference/outputs/UI_Component_Inventory_Reference.xlsx`
(every unique component, its category, usage, variants, styling approach and near-duplicates). It also carries the migration columns (ui_imports, semantic_classes, raw_elements, hardcoded_values, call_sites, duplicate_group, migration_bucket, shadcn_target, migration_status), a Migration Summary and a History sheet; the A-mapping, the protected components (status Retained) and the documented native elements live in `reference/migration/shadcn-target-map.yaml` - edit that, not the script. Status rule v4: semantic classes do not block Done (they are the styling layer); a native `<button>` is acceptable only as a clickable card / list row that passes the `button_conformance` checks (explicit type, accessible name, no nested interactive element, focus ring from a token, a semantic class) - navigating, link-styled and icon-only buttons are converted (`<a>`/Link, Button `link`, Button `ghost` + `icon`), see the Button Triage sheet; `react/button-has-type` (oxlint) enforces `type`. Other raw elements and hardcoded values block Done, including a literal hidden inside a semantic class's rule - put such lengths in `tokens.css` as `--size-*` and read them with `var()`. Use one of these (or add one there) instead of repeating a long
utility string; one-off layout (margins, widths) stays as utilities at the call site and, being unlayered, overrides the class.

## Build-time settings

`.env.example` documents the build flags. `NEXT_PUBLIC_SHOW_DEMO=false` hides demo-only UI (scanner simulators, specimen cards)
for a production build; it is shown by default.

## Tests

`npm test` runs the automated suite (`tests/*.test.mjs`, about 1000 tests, about 15 seconds, no extra dependencies - the npm registry
is not reachable from the build sandbox, so it uses `node:test`, Vite's own SSR loader and `react-dom/server`).
`tests/harness.mjs` loads the app's TypeScript through Vite with `fetch` and storage stubbed to read `public/`.

- `journeys.test.mjs`: sign-in, role navigation, customer search and Customer 360, identity validation, eligibility (age,
  blacklist, ID expiry), postpaid pricing and first bill, business rules, queue logic, RBAC grants, and the route catalogue.
- `ui.test.mjs`: Button / tabs / pager / field accessibility markup, and source guards (every `<img>` has alt, every raw
  `<button>` declares a `type` - checked with a brace-aware JSX walk, no red text links, no Tailwind radius utilities in
  components, no `console.log`, and no literal colours, `white/NN`, `color-mix()`, `z-N` or `duration-N` in `.ts`/`.tsx`
  outside `src/data/synthetic/`).
- `tokens.test.mjs`: design-token governance read from the CSS itself (`tests/tokenModel.mjs`) - every `var(--x)` is defined,
  no dead tokens, every raw-colour token has a dark value or an entry (with a reason) in `CONSTANT_ACROSS_THEMES`.
  `node tests/tokenModel.mjs` prints the dead / no-dark / undefined lists.

CI (`.github/workflows/ci.yml`, which must sit at the repository root to run) runs lint, `npm test` and `npm run build`.

- `architecture.test.mjs`: computed from the source's own import graph - no import cycles, and layers only import downward
  (primitives and domain never import capabilities, patterns, modules or workspace; components and capabilities never import modules
  or workspace; `lib/` imports nothing else in the app). Put shared pieces in the lower layer rather than reaching up.
- `journeyCatalogue.test.mjs`: `validateJourneyCatalogue()` - every journey's feature key, screen and path exists, and an
  `available` journey leads to a built screen or a served path. `screenName.test.mjs`: `screenDisplayName()` strips project-phase
  and vendor remarks from catalogue names; every surface that names a screen uses it.

Async actions use `src/hooks/useSubmit.ts` (`useSubmit` / `useSubmitGuard`: one at a time, failure becomes a toast, never stuck on
"Saving..."). Detail screens use `EntityMissing` + `useKindPending` so "loading", "failed" and "not found" are never confused. Filled
status colours that carry a white label use `--success-solid` / `--danger-solid`, not `--success` / `--danger`. Control heights come
from `--control-h-sm/md/lg`. The New Connection wizard lives at `/mobile/start-connection` (`/new-connections` is the New Connections hub).

Add a test here when you change a rule the journeys depend on.

Browser tests: Playwright + axe (`npm run test:e2e`, desktop / tablet / mobile projects, `PORT=<dev server port>` to reuse a running dev
server; the sandbox cannot run them - run them in a terminal). `e2e/sweep.spec.ts` snapshots 20 screens and the UI Components Library
(pixels and accessibility tree, light and dark) - run it with `--update-snapshots` BEFORE changing a shared component and plain AFTER, so any visible
or semantic change fails; update a snapshot only for a difference you can explain. Other specs pin behaviour (pilot, checkbox, button, input).

Shared components (Phase 4, docs/migration/phase4-migration-matrix.md): Label, Card, Checkbox, Button, Input and Textarea are the shadcn/ui
components in `src/components/ui/` (themed to the app's semantic classes; Label and Card carry no look of their own, Button defaults to type=button).
`primitives/Input` and `primitives/Textarea` stay as the field composites (label, helper, error, addons) built on them. `TabStrip` and `SegmentedTabs` are the Radix Tabs (`ui/tabs.tsx`, Phase 7, docs/migration/phase7-tabs-dropdown.md; PageUp / PageDown now jump to the first / last tab). The Button has the stock `link` (the app's `.link` text link; keep the semantic class in className) and `ghost` (`size="icon"` / `"icon-sm"` is the app's icon button and REQUIRES `aria-label`) variants, themed to the app; there is no `bare` variant. The Dropdown Menu in `ui/` is stock and unused - do not import it; the app's two menus (customer actions, profile) are domain / navigation components.

**Overlays (Phase 6, docs/migration/phase6-overlays-select.md):** `Modal` and `Drawer` are thin wrappers over the one Radix Dialog in `components/ui/dialog.tsx`
(focus trap, body scroll lock, hidden page behind, `aria-labelledby`, one layer stack). The Dialog keeps three app behaviours Radix lacks: focus lands on the
container and returns to the opener, an open combobox keeps its own Escape, and a drawer is not closed by an outside click (a Modal is). Migrate overlays only
all together (a stock Dialog over a hand-written overlay breaks focus, pointer events and Escape). `e2e/overlays.spec.ts` and `tests/overlayContracts.test.mjs`
pin the contract; the leave-journey prompt (`useBlocker`) is navigation and must not change.

**Accessibility (Phase 7, docs/migration/phase7-accessibility.md):** `e2e/a11y.spec.ts` pins field-border contrast (3:1 and up in light and dark), a visible focus ring on every control (teal in light, `--fg` in dark - not teal), the skip link, route announcements, radio groups, native disabled and axe per library group (`RECORDED_AXE` is empty; add to it only with a reason). Do not weaken these to pass a migration.

**Release gate (Point 9, docs/migration/release-gate.md):** the authoritative status of each migrated family (appearance, behaviour, accessibility, three viewports, dark mode, tsc, lint, unit, e2e, visual, build, no duplicate systems, independent rollback); `tests/releaseGate.test.mjs` keeps it honest. Update the matrix with evidence when a family changes; never mark a gate PASS without it. Six families' Independent-rollback gate stays FAIL (shipped as one commit, owner-accepted); the leave-journey overlay tests run on desktop, tablet and mobile (touch makes the journey dirty by upload + QID + expiry + Fetch).

**Protected components (Phase 5, docs/migration/phase5-specialised-components.md): do not replace or duplicate** the searchable `Select`
(every dropdown in the app), `PhoneNumberInput`, `QidInput`, `SignaturePad`, `DataTable`, the `Tooltip` system and the Redux notification system
(`notificationSlice` + `ToastContainer`). shadcn has no equivalent that keeps their behaviour; there is no shadcn Select, Tooltip or Sonner in the
repo, on purpose. Each carries a `PROTECTED` header and `tests/protectedComponents.test.mjs` fails on a second toast / tooltip / table system.
