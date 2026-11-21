# Phase 2 - behavioural baseline (before shadcn/ui component migration)

Taken 2026-11-07 on the working tree as it stands (Phase 1 theming of the shadcn/ui components is in the tree but uncommitted; no existing screen
imports a shadcn/ui component, so the screens below are the app's own). The application is the source of truth: this document records what it does,
including where that falls short. Nothing here changes a screen or a component.

**How it was observed.** Static contracts are asserted by `tests/baselineContracts.test.mjs` (markup and source). Runtime behaviour was observed live
in the browser preview against `next dev`: DOM and computed-style probes, synthetic key events dispatched at the elements, a mutation observer for
transient states, and screenshots. Limits of that tooling are in section 13. Anything not observed is listed as a gap, not claimed.

## 1. Repository and test environment

| | |
|---|---|
| Framework / router | Next.js 16 App Router (`app/**/page.tsx`), React 19.2, client-rendered (`AppFrame` loaded `ssr: false`) |
| Navigation layer | `src/lib/router.ts` (`routerHooks.ts`, `routerLinks.tsx`) over `next/navigation`; launch state per URL in `sessionStorage` |
| State / data | Redux Toolkit (16 slices, persisted under `vfq-*`), RTK Query API layer (`src/services/apiSlice.ts`) over the mock data |
| Styling | Tailwind CSS 4 (CSS-first), tokens in `src/tokens.css`, semantic classes in `src/ui-components.css`, tablet rules `src/tablet.css`; Tailwind's default breakpoints (no custom `--breakpoint-*`) |
| Dark mode | `:root.dark`, toggled by the Redux theme slice, persisted as `vfq-theme-store` |
| Device scale | `data-device="tablet"` on `<html>` when the device has touch (or a coarse pointer); `?device=tablet\|web` forces it for the tab (`sessionStorage` `dxp-device`) |
| Test tools | `node:test` over `tests/*.test.mjs` through a Vite SSR loader and `react-dom/server`. **No** jsdom, Playwright, Puppeteer, axe or Testing Library |
| Screenshot / a11y tooling | None in the repo. Screenshots here come from the browser preview used in this session. Accessibility tests are markup/source assertions (`accessibilityAudit.test.mjs`, `ui.test.mjs`) plus token contrast maths |
| Package manager | npm |

## 2. Screen coverage and traceability

Routes are the repository's own. "Behaviours" lists what was exercised on that screen. Viewports: D = desktop 1440x900 (`data-device` absent, pointer);
T = tablet 768x1024 and 1024x768 (`data-device="tablet"`); M = 390x844 (touch, so also `data-device="tablet"`). Theme: L light, D dark.

| Screen | Route | Components covered | Behaviours covered | Viewports | Theme | Tests | Screenshots |
|---|---|---|---|---|---|---|---|
| Login | `/` (signed out) | Input (login variant), password toggle, Button, news carousel | empty submit, wrong credentials, correction, show/hide password, loading ("Signing in…") | D T M | L | baselineContracts (messages) | captured (3 viewports + error) |
| Dashboard | `/` | tiles, header search, queue, sidebar, skip link, route announcer | landmarks, headings, skip link, route-change announcement + focus, sidebar unpin after nav click | D T M | L | baselineContracts (page) | D, T, M |
| Customer Search | `/customer-search` | search Input, results, EmptyState | min-3-chars hint, submit by Enter/form, no-match empty state (`role=alert`), match | D | L | - | results, empty |
| Orders | `/orders` | DataTable, TabStrip, Select filters, Pager | tab keyboard (arrows/Home/End/Enter/Space), table semantics, 50 rows, tablet overflow | D T | L D | baselineContracts (TabStrip) | D L/D, T portrait+landscape |
| Leads | `/leads` | DataTable list | 15 rows from the API layer | D | L | leadsApi | list |
| Lead Details | `/lead-management/lead-details-view?id=` | Drawer x3 (Edit Description, Reject, Reassign), Select combobox, Textarea | drawer focus/trap/Escape/outside click/scroll, combobox keyboard, loading ("Loading lead…", 585 ms), not found | D | L D | baselineContracts (overlay) | drawer L, drawer+select D, dark, not found |
| Customer 360 | `/customer/CUST-1001` | section nav, cards, profile header | landmarks, section buttons (`aria-current`), heavy-load render | D | L | - | overview |
| New Connection (journey) | `/mobile/start-connection` | ID-type buttons (`aria-pressed`), scan panel, journey summary, footer bar, Modal (leave prompt) | start, ID type picked, scan (dirty), Continue, leave prompt (all paths), reload, browser Back/Forward, `beforeunload` | D T M | L D | baselineContracts (leave warning) | start, dirty, leave modal L/D, T/M |
| New Postpaid (journey) | same route, product chosen | plan option cards (`role=button`, `aria-pressed`), offer drawer, Customer view | exclusive selection, Enter/Space, View details drawer, Escape + focus return, Customer view mirror | D | L | - | offers and plans, mirror |
| Profile | `/profile` | form of Inputs, Button, Badge, toast | submit-time validation (4 errors + success), toast (`role=status`) | D | L D | baselineContracts (validation) | error L/D, success toast |
| Support | `/support` | Tabs, queue | touch-target measurement only | M T | L | - | none |
| Not Found | `/nope/a/b` | NotFound page | H1, title, announcement | D | L | baselineContracts (EntityMissing) | captured |
| Profile menu | header | dropdown | ARIA, Escape, outside click, focus | D | L | - | captured |

## 3. Component-state baseline

States below were observed (live) or read from source/CSS; "css" means defined in `src/ui-components.css` and not screenshot-captured (the preview has no hover
or keyboard-focus capture).

| Component | Default | Hover | Focus-visible | Active | Disabled | Loading | Error | Selected / checked | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Button | `btn btn-<variant> btn-<size>` | css (gradient hover, secondary fill swap) | `.btn-tertiary`, icon buttons `--focus-ring`; **`.btn` itself defines no focus ring** | css: `enabled:active:scale-[0.99]` (primary, destructive) | native `disabled`, opacity/colour via class, `cursor-not-allowed` | no prop; callers swap the label (login "Signing in…" + disabled) | - | - | `aria-disabled` not used |
| Input | `form-control form-control-default` | css hover border | css field focus border + inset ring | - | native `disabled` + disabled tokens | - | `form-control-error`, `aria-invalid`, `role=alert` message, `aria-describedby` | filled state class | placeholder dropped by the app Input; read-only leaves the tab order |
| Select (combobox) | closed, `aria-expanded=false` | css | css | - | native disabled | - | `aria-invalid` + describedby | `aria-selected` on the option | ArrowDown/Up/Enter, Escape closes list only; Home/End are caret keys |
| Checkbox | native `<input type=checkbox>`, tick aria-hidden | css | css field focus | - | native + tokens | - | - | native `:checked` | |
| Option / plan cards | `role=button` div, `tabindex=0`, `aria-pressed` | css fill | `focus-ring` | - | - | - | - | `aria-pressed=true`, `card-selected` | single selection; Enter and Space activate |
| ID-type picker | buttons with `aria-pressed` | css | css | - | - | - | - | `aria-pressed` | not a radiogroup |
| ChoiceCards | `role=radiogroup` of `role=radio` | css | css | - | - | - | - | `aria-checked` | **no arrow-key handling in source**; each radio is Tab-reachable |
| TabStrip / tabs | `role=tablist` + `aria-label`; roving `tabindex` | css | css | - | - | - | - | `aria-selected` | arrows wrap, Home/End, select-on-focus; **no PageUp/PageDown**; `aria-controls` absent |
| DataTable | plain `<table>`; sortable headers `aria-sort="none"`; `.sort-button` | row hover css | - | - | - | `loading` prop | `emptyMessage` | - | `<th>` has no `scope`; no caption/aria-label |
| Pager | `nav aria-label="Pagination"`, Previous/Next buttons | css | css | - | native `disabled` at the ends | - | - | `aria-current="page"` | |
| Modal | portal, `role=dialog` `aria-modal` `aria-label` | - | - | - | - | - | - | open/closed | outside click closes |
| Drawer | portal, same roles; 720px panel; slides 220 ms | - | - | - | - | - | - | open/closed | outside click does nothing |
| Tooltip | on hover **and** focus; `role=tooltip`; trigger `aria-describedby` | shows | shows | - | - | - | - | - | Escape (window) hides |
| Toast | `role=status` `aria-live=polite`, dismiss button `aria-label="Dismiss notification"` | - | - | - | - | - | `.border-success` | - | no auto-dismiss unless the caller sets it (still present after 6 s) |
| Profile menu | `aria-haspopup="menu"`, `aria-expanded` | - | - | - | - | - | - | open/closed | panel has **no** `role=menu` / `menuitem` |
| EntityMissing | `role=status` "Loading lead…" / `role=alert` + Try Again / plain "could not find" + back link | | | | | observed 585 ms | | | |

Dark mode (observed): body `rgb(15,23,42)`, text `rgb(248,250,252)`, link `rgb(79,200,220)`, success badge `rgb(62,203,110)`; cards, fields, drawer, modal and
tables follow the dark tokens. Dark was captured for Orders, Lead Details (+ drawer with an open select), the journey (+ leave modal) and Profile.
**Not captured in dark:** Dashboard, Customer 360, Customer Search, Support, login (the login panel is dark by design in both themes).

## 4. Keyboard and focus findings

Synthetic key events were dispatched at the focused element or the document; the browser's native Tab traversal itself was not exercised. Where the app
handles the key (overlay Tab wrapping, tab strips, combobox) the result is observed; elsewhere the order is the DOM order.

- **Initial focus:** `<body>` on every page (nothing autofocuses), including after sign-in and after a journey step change.
- **Skip link:** first stop on signed-in pages ("Skip to main content"); activating it focuses `main#main-content` (`tabindex=-1`).
- **Route change:** focus moves to `<main>`, an `sr-only` polite status announces "<Page> page" (e.g. "Orders page"), `document.title` updates ("Orders - Vodafone Qatar DXP"). On a **direct load** of a Not Found URL the title stays "Vodafone Qatar DXP" and nothing is announced.
- **Dashboard tab order (33 stops):** skip link, logo, collapse-navigation, menu search, 10 nav items, header search, queue, header controls, content.
- **Login tab order:** Staff ID, Password, show/hide password, Forgot password, Sign in, Contact IT support, carousel controls, 6 news links, 6 slide dots. `<main>` landmark is absent on the login page.
- **Drawer/modal:** focus lands on the dialog container (`tabindex=-1`), not its first control. Tab from the last control wraps to the first (observed: Tab from "Save Description" -> "Close"); Shift+Tab from the first wraps to the last. Shift+Tab **from the container itself** is not handled by the hook (the container is not the first control), so the browser's own traversal would leave the dialog (inferred from the code and observed focus). Escape closes the top layer only; focus returns to the opener (observed: "Edit Description", and the breadcrumb "Dashboard" link for the leave prompt).
- **Combobox (Select):** ArrowDown opens and highlights option 0 (`aria-activedescendant`), a second ArrowDown + Enter selects option 2 and closes; Escape on the field closes the list but not the surrounding drawer.
- **Tab strips:** ArrowRight/ArrowLeft move and select (wrapping), Home/End jump, Enter/Space on a focused tab change nothing further (already selected).
- **Plan cards:** Enter and Space each select the focused card; only one card is `aria-pressed=true`.
- **Tooltip:** shown on focus and hover, Escape hides.
- **Profile menu:** opening leaves focus on the trigger; Escape does not close it; an outside mousedown does.
- **After a failed submit (login, profile):** focus stays on `<body>`; no error is focused or scrolled to.
- **ID-type picker/ChoiceCards:** Tab only; no arrow-key roving (source).

## 5. ARIA and accessibility findings

Contract (asserted in `baselineContracts.test.mjs`): button `type="button"` + native `disabled`; Input `aria-invalid`, `aria-describedby` -> `id=<id>-error` with `role="alert"`, helper `-helper`, required marker `aria-hidden`, `aria-required`; combobox attributes; tablist/tab/`aria-selected`/roving tabindex; native checkbox; dialog `role=dialog aria-modal aria-label`; tooltip `role=tooltip`; toast `role=status`; Pager `aria-label="Pagination"`/`aria-current="page"`; skip link, polite route announcer, `<html lang="en">`.

Existing automated coverage that was run: `accessibilityAudit.test.mjs` (8), `ui.test.mjs` (21) - all pass. They check contrast ratios from tokens (link, muted nav text, field edges, 24px targets) and tab-strip names.

Baseline gaps recorded (not fixed):
1. **Errors are not tied to fields on Login and Profile.** A single `role=alert` (login) or a plain `<p class="text-danger">` (profile) is shown; the inputs get no `aria-invalid` / `aria-describedby`; focus is not moved. The login error persists after the field is corrected until the next submit. (The shared `Input` component does support the association; these forms do not use it for form-level errors.)
2. **Modal/Drawer:** `aria-label` not `aria-labelledby`; no body scroll lock (`<body>` and `<main>` keep their overflow); the page behind is not `inert` / `aria-hidden` (the scrim only blocks the pointer); Shift+Tab from the container (above).
3. **Profile menu:** `aria-haspopup="menu"` but no `role=menu`/`menuitem`; Escape does not close it.
4. **Tables:** `<th>` without `scope`, no caption or `aria-label`; sortable headers report `aria-sort="none"`.
5. **ChoiceCards** is a `radiogroup` without radio-group arrow keys.
6. **Dark field border contrast:** the field edge is 1.61:1 on the card fill and 1.77:1 on the page (measured live); WCAG 1.4.11 asks 3:1. In light it is 3.59:1 / 3.26:1.
7. **Dark focus colour:** `--color-field-border-focus` is `var(--fg)` (`#f8fafc`) in dark, `#007e91` (teal) in light. The repository does not define a teal dark focus ring.
8. **Small targets (touch device, 390 and 768):** `/support` has 7 controls under 44px (smallest 18px) while every other measured page is >= 44px.
9. `<main>` landmark missing on the login page; page title is not set on a direct load of an unknown route.
10. Skip link, `prefers-reduced-motion` (`animation-duration: 0.01ms`) and `forced-colors` (`outline: 2px solid Highlight`) rules exist in `src/index.css`.

## 6. Validation and error-handling baseline

| Form | Timing | Rules / messages | ARIA | Recovery |
|---|---|---|---|---|
| Login | submit | empty: "Enter your Staff ID and password."; unknown id: "Staff ID not recognised." | one `role=alert`; fields not `aria-invalid` | error stays until next submit; success: button "Signing in…" disabled, route `/` |
| Customer Search | live hint + submit | fewer than 3 chars: "Enter at least 3 characters, then press Enter or Search to see results."; no match: "Customer Data Not Found / No customer record matches "<q>"..." | empty state `role=alert` | new query replaces it |
| Profile > Change Password | submit; Save disabled until all 4 fields are non-empty (no live validation) | first failure wins, in order: "Current password is incorrect." -> "Invalid or expired verification code." -> policy ("Password must be at least 8 characters." / "...one letter." / "...one number.") -> "New password and confirmation do not match." | plain `<p class="text-danger">`; no `aria-invalid` | success: fields cleared, "Password Updated" badge + toast "Password changed." |
| Journey step 1 | live | Continue disabled until the document is scanned/uploaded; ID type alone is not progress | native `disabled` | "Retake scan" |
| Lead Reject drawer | live | "Confirm Rejection" disabled until a reason is chosen | native `disabled` | - |

Field appearance (live): default border `rgb(135,135,135)` (light), focus/hover border the focus token, error border `--field-border-error`; dark per section 3.

## 7. Responsive and tablet findings

Measured (no horizontal overflow `documentElement.scrollWidth > innerWidth` on any page at any width):

| Width | Device | Dashboard / Orders / Leads / Customer Search smallest control | Notes |
|---|---|---|---|
| 1440 | pointer | 42px | sidebar pinned on first load; a click on a sidebar link **unpins it** (persisted `vfq-sidebar-store` `pinned:false`), after which it is off-canvas (`x=-280`) |
| 1024x768 | tablet | 44px | sidebar off-canvas; Orders table cells **overlap** (see below) |
| 768x1024 | tablet | 44-48px | same; header search narrows |
| 390x844 | touch phone (= tablet scale) | 44-48px (Support 18px) | hamburger replaces the sidebar; queue pill hidden; stacked ID-type cards; "Upload document" replaces the scanner simulator; sticky footer bar |

- **Tablet scale:** `--control-h-*` 2rem/2.625rem/3rem -> 2.75rem/3rem/3.5rem; observed Button heights 44/48/56, field 48, tertiary 44, login field 54 / button 61.
- **Orders table at tablet (768 and 1024 landscape):** the Customer Name and Order Type columns overprint ("Shaikha Jassim Rashid Al-Mohannadi" runs into "New Postpaid…"), "Submitted for Approval" and "Approval Requested" are clipped. Not present at 1440 pointer. Existing defect, see screenshots.
- **Touch devices see different controls:** the scanner simulator ("Initiate scan") is desktop-only; touch shows "Upload document".
- The preview's viewport emulation is approximate: a requested 768 width sometimes read `innerWidth` 925-1357 until the size was re-applied; the stored captures were taken after confirming `innerWidth`.

## 8. Dark-mode findings

See section 3 for values and section 5 for the two contrast facts (field edge, focus colour). Observations: the theme toggle persists (`vfq-theme-store`) and survives reload; the wizard footer, drawer, modal, tables, fields and badges all switch; the login page ignores the theme (always dark panel).

## 9. Modal and drawer findings

| Behaviour | Modal (leave prompt, other confirmations) | Drawer (Edit Description, Reject, Reassign, offer details) |
|---|---|---|
| Trigger | button/link; for the leave prompt, any blocked navigation | button |
| Role / name | `dialog`, `aria-modal`, `aria-label` = title | same |
| Initial focus | the dialog container | the dialog container |
| Tab wrapping | first<->last control | same |
| Escape | closes (top layer only) | closes (top layer only) |
| Outside click | **closes** (scrim handler) | **does nothing** |
| Close button | yes (`Close`) | yes |
| Body scroll lock | **none** | **none** |
| Page behind | blocked by the scrim; not inert | same |
| Focus return | to the opener | to the opener |
| Width | content-sized (max-w-lg default) | 720px panel, full height, slides in over 220 ms |
| Nested overlays | Escape closes one layer per press (layer stack in `useDialogBehaviour`) | same |
| Form state after closing | drawer fields are re-seeded from the record when reopened (Lead Details) | |

## 10. Navigation findings

**New Connection journey** (route stays `/mobile/start-connection`; state in `sessionStorage` `vfq-workflow-store` and `vfq-journey-customer`):

| Step | User action | Expected route | State change | Focus result | Warning shown | Result |
|---|---|---|---|---|---|---|
| 1 Contact | open `/mobile/start-connection` | same | nothing stored | body | no | "Step 1 of 3: Contact" announced (polite) |
| 1 | pick Qatar ID | same | `contact.idType` only | body | **no** (not progress) | scan panel appears, Continue disabled |
| 1 | Initiate scan (desktop) / Upload (touch) | same | draft + journey hold created | body | **yes** on leaving | "Save as Draft" appears, Continue enabled |
| 1 -> 3 | Continue | same | step advances | body | yes on leaving | "Step 3 of 3: Offers & Plans" (step 2 is skipped for a scanned, eligible customer) |
| 3 | Start "New Postpaid" | same | product chosen | body | yes | "Step 4 of 11: Offers & Plans"; summary lists Contact and Address with Edit |
| 4 | select a plan | same | plan stored | on the card | yes | Continue enabled; Back available |
| any | Customer view | `?mirror=1` (second window; replaced the tab in the preview) | | | | journey content only, no chrome |

**Leave warning ("Leave this journey?")** - when it appears and when it does not:

| Situation | Result |
|---|---|
| clean journey, or ID type only | navigates, no dialog |
| dirty journey, in-app navigation (breadcrumb, sidebar link) | dialog; route unchanged while open |
| dialog: Close / X, Escape, or outside click | **stay**: route and draft kept, focus back on the link that was clicked |
| dialog: Save as Draft | navigates to the target (observed `/`), journey hold cleared, draft saved |
| dialog: Abandon Journey | navigates to the target (observed `/orders`), hold cleared, `beforeunload` no longer armed |
| browser **Back** | **no dialog**; goes to the previous page; draft and hold retained |
| browser **Forward** | returns to the journey with the scan state intact (draft persisted) |
| reload | journey restored from `sessionStorage` (ID type, scan, "Save as Draft"); `beforeunload` armed again |
| tab close / reload prompt | `beforeunload` event is cancelled (`defaultPrevented`) while dirty, not when clean or after Abandon (event inspected; the native prompt itself is not automatable) |
| customer pop-up (`?mirror=1`) | never blocks |

Known limitation (documented in `routerHooks.ts`): the App Router cannot intercept browser Back/Forward.

## 11. Test baseline

Run on the current tree after the report existed (the suite also checks this report lists every screenshot).

| Command | Status | Duration | Passed | Failed | Skipped | Existing or new failure | Notes |
|---|---|---|---|---|---|---|---|
| `npx tsc -b` | pass (exit 0) | 7 s | - | 0 errors | - | none | |
| `npm run lint` (oxlint) | pass (exit 0) | <1 s | - | 0 | - | none | 0 warnings |
| `npm test` | pass (exit 0) | 19 s | 976 | 0 | 0 | none | 977 tests incl. 1 TODO (CUST-1001 QID mismatch, existing); includes the 19 new `baselineContracts` tests |
| `npm run build` (Next.js) | pass (exit 0) | 12 s | - | - | - | none | run in a terminal tab; log `/tmp/claude/build6.log` |
| `node --test tests/baselineContracts.test.mjs` | pass | (within the suite) | 19 | 0 | 0 | new tests | characterisation only |

Existing failures: **none**. One test is a recorded TODO (not a failure): `familyScenarios.test.mjs` "CUST-1001: the identity document carries the same QID as the customer record" (customers.json `28512345678` vs identity-documents.json `28456701234`).

## 12. Defect found in Phase 1 during this baseline (fixed)

Phase 1 mapped shadcn's `secondary` colour (`--color-secondary`) onto an app token. The app already has a `.text-secondary` class, and the new theme colour overrode it, turning the app's secondary body text near-white (`rgb(245,247,249)` on white, 1.07:1) in 112 places - visible as an empty-looking "Leave this journey?" dialog and an empty-looking "Customer Data Not Found" message. This contradicted the Phase 1 statement that existing screens were unchanged. Fixed in `src/index.css` (`--color-primary*` and `--color-secondary*` are no longer mapped; nothing in the themed shadcn components used them), and `tests/uiShowcase.test.mjs` now fails if any mapped shadcn colour name clashes with a class of the app. Screenshots taken before the fix were discarded and re-captured.

## 13. Visual baseline and limits

Screenshots are in `docs/baseline/screenshots/` (the project's baseline location; ~0.9 MB in total). Names follow `<screen>--<viewport>--<theme>--<state>`. The browser preview scales a 1440x900 viewport to an 800px-wide image; tablet/mobile emulation produces a canvas larger than the page in some captures (the page sits in the top-left).

| File | Path |
|---|---|
| `customer-360--desktop-1440x900--light--overview.jpg` | `docs/baseline/screenshots/customer-360--desktop-1440x900--light--overview.jpg` |
| `customer-search--desktop-1440x900--light--empty-state-no-match.jpg` | `docs/baseline/screenshots/customer-search--desktop-1440x900--light--empty-state-no-match.jpg` |
| `customer-search--desktop-1440x900--light--results.jpg` | `docs/baseline/screenshots/customer-search--desktop-1440x900--light--results.jpg` |
| `dashboard--desktop-1440x900--light--default.jpg` | `docs/baseline/screenshots/dashboard--desktop-1440x900--light--default.jpg` |
| `dashboard--mobile-390x844--light--default.jpg` | `docs/baseline/screenshots/dashboard--mobile-390x844--light--default.jpg` |
| `dashboard--tablet-768x1024--light--default.jpg` | `docs/baseline/screenshots/dashboard--tablet-768x1024--light--default.jpg` |
| `dropdown-profile-menu--desktop-1440x900--light--open.jpg` | `docs/baseline/screenshots/dropdown-profile-menu--desktop-1440x900--light--open.jpg` |
| `journey-customer-view-mirror--desktop-1440x900--light--offers-and-plans.jpg` | `docs/baseline/screenshots/journey-customer-view-mirror--desktop-1440x900--light--offers-and-plans.jpg` |
| `journey-new-connection--desktop-1440x900--dark--step1-scanned-dirty.jpg` | `docs/baseline/screenshots/journey-new-connection--desktop-1440x900--dark--step1-scanned-dirty.jpg` |
| `journey-new-connection--desktop-1440x900--light--step1-scanned-dirty.jpg` | `docs/baseline/screenshots/journey-new-connection--desktop-1440x900--light--step1-scanned-dirty.jpg` |
| `journey-new-connection--desktop-1440x900--light--step1-start.jpg` | `docs/baseline/screenshots/journey-new-connection--desktop-1440x900--light--step1-start.jpg` |
| `journey-new-connection--mobile-390x844--light--step1-id-type-selected.jpg` | `docs/baseline/screenshots/journey-new-connection--mobile-390x844--light--step1-id-type-selected.jpg` |
| `journey-new-connection--tablet-768x1024--dark--step1-id-type-selected-upload.jpg` | `docs/baseline/screenshots/journey-new-connection--tablet-768x1024--dark--step1-id-type-selected-upload.jpg` |
| `journey-new-connection--tablet-768x1024--light--step1-id-type-selected-upload.jpg` | `docs/baseline/screenshots/journey-new-connection--tablet-768x1024--light--step1-id-type-selected-upload.jpg` |
| `journey-new-postpaid--desktop-1440x900--light--step4-offers-and-plans.jpg` | `docs/baseline/screenshots/journey-new-postpaid--desktop-1440x900--light--step4-offers-and-plans.jpg` |
| `lead-details--desktop-1440x900--dark--default.jpg` | `docs/baseline/screenshots/lead-details--desktop-1440x900--dark--default.jpg` |
| `lead-details--desktop-1440x900--dark--drawer-reject-select-open.jpg` | `docs/baseline/screenshots/lead-details--desktop-1440x900--dark--drawer-reject-select-open.jpg` |
| `lead-details--desktop-1440x900--light--drawer-open-edit-description.jpg` | `docs/baseline/screenshots/lead-details--desktop-1440x900--light--drawer-open-edit-description.jpg` |
| `lead-details--desktop-1440x900--light--error-not-found.jpg` | `docs/baseline/screenshots/lead-details--desktop-1440x900--light--error-not-found.jpg` |
| `leads--desktop-1440x900--light--list.jpg` | `docs/baseline/screenshots/leads--desktop-1440x900--light--list.jpg` |
| `login--desktop-1440x900--light--default.jpg` | `docs/baseline/screenshots/login--desktop-1440x900--light--default.jpg` |
| `login--desktop-1440x900--light--validation-error.jpg` | `docs/baseline/screenshots/login--desktop-1440x900--light--validation-error.jpg` |
| `login--mobile-390x844--light--default.jpg` | `docs/baseline/screenshots/login--mobile-390x844--light--default.jpg` |
| `login--tablet-768x1024--light--default.jpg` | `docs/baseline/screenshots/login--tablet-768x1024--light--default.jpg` |
| `modal-leave-journey--desktop-1440x900--dark--open.jpg` | `docs/baseline/screenshots/modal-leave-journey--desktop-1440x900--dark--open.jpg` |
| `modal-leave-journey--desktop-1440x900--light--open.jpg` | `docs/baseline/screenshots/modal-leave-journey--desktop-1440x900--light--open.jpg` |
| `not-found--desktop-1440x900--light--error-page.jpg` | `docs/baseline/screenshots/not-found--desktop-1440x900--light--error-page.jpg` |
| `orders--desktop-1440x900--dark--table.jpg` | `docs/baseline/screenshots/orders--desktop-1440x900--dark--table.jpg` |
| `orders--desktop-1440x900--light--table.jpg` | `docs/baseline/screenshots/orders--desktop-1440x900--light--table.jpg` |
| `orders--tablet-1024x768--light--table-overlapping-cells.jpg` | `docs/baseline/screenshots/orders--tablet-1024x768--light--table-overlapping-cells.jpg` |
| `orders--tablet-768x1024--light--table-overlapping-cells.jpg` | `docs/baseline/screenshots/orders--tablet-768x1024--light--table-overlapping-cells.jpg` |
| `profile--desktop-1440x900--dark--password-form-validation-error.jpg` | `docs/baseline/screenshots/profile--desktop-1440x900--dark--password-form-validation-error.jpg` |
| `profile--desktop-1440x900--light--password-form-success-toast.jpg` | `docs/baseline/screenshots/profile--desktop-1440x900--light--password-form-success-toast.jpg` |
| `profile--desktop-1440x900--light--password-form-validation-error.jpg` | `docs/baseline/screenshots/profile--desktop-1440x900--light--password-form-validation-error.jpg` |

Not captured, and why:
- **Hover, keyboard focus-visible, pressed:** the preview tool has no pointer-hover or keyboard-driven capture. Computed styles were read instead for the dark/light field borders; hover/active/focus rules are recorded from CSS (section 3).
- **Loading states:** "Loading lead…" lasts about 585 ms (observed with a mutation observer: appears, then replaced by the lead); too brief to screenshot. Login "Signing in…" likewise.
- **Dark:** Dashboard, Customer 360, Customer Search, Support. **Tablet dark:** only the journey.
- **Screens not visited:** Administration, Tasks, Tickets/Support detail, Bill Formatter, Sales, the Fibre/Home, MNP, SIM-swap, prepaid and service-change journeys, the specialised phone/QID/MSISDN inputs (covered only by their own tests), Pager interaction, Customer 360 sub-sections beyond the overview.
- **Non-determinism in captures:** the dashboard greeting ("Good morning" by clock), date, queue/task counts, and the login news carousel (live content, rotating) differ between runs; mock data otherwise deterministic. Captures were not masked.

## 14. Coverage gaps and risks for the shadcn/ui migration

- **No runtime component or browser test exists.** Focus order, overlay behaviour, keyboard handling and the leave prompt are only characterised by static assertions and by this manual observation. A replacement of Modal/Drawer/Select/Tabs with Radix versions will change focus, outside-click, scroll-lock, `aria-labelledby` and typeahead behaviour; none of that is covered by an automated test today. Adding Playwright + axe is the recommended next step before Phase 3.
- **Exact-markup tests** (`ui.test.mjs`, `baselineContracts`, source regexes in many files) will fail on purpose when classes or elements change; each failure needs a deliberate decision.
- **Behaviour that the app owns and shadcn does not have:** the searchable combobox (filtering), the Input wrapper (label/helper/error/numeric keypad/addons), read-only focus rules, phone/QID inputs, signature pad, the leave-journey guard, route announcer and the tablet scale.
- **Outside click differs** between the app's Modal (closes) and Drawer (does not); Radix Dialog closes both by default.
- **Several existing defects** (sections 5, 7) would be carried over or silently fixed by a migration; fixing them is a separate decision.
- **Flakiness:** none observed in the automated suite (three full runs). The live observations depend on the dev server and a viewport emulator with approximate sizing.
