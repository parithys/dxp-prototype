# Phase 5 - protecting the specialised components

> shadcn/ui is a set of presentation primitives, not a mandatory replacement for every component. A specialised component is **retained** unless a
> replacement is *proven* to keep every behaviour; the default is retain.

Evidence: the contracts below were read from the source; `tests/protectedComponents.test.mjs` (12 node tests) pins what needs no browser and
`e2e/protected.spec.ts` (6 behaviours x desktop / tablet / mobile = 18 browser checks, all passing) pins what does, against the UI Components Library
(Administration, System Administrator), where the app renders each of these components in isolation. `e2e/sweep.spec.ts` (pixels + accessibility tree,
light and dark) already compared those library groups and 20 screens before and after Phase 4.

## Decision matrix

| Component or system | Category | Current implementation | Closest shadcn option | Business logic | Redux / RTK Query | Accessibility risk | Interaction risk | Responsive risk | Test coverage | Decision | Status | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Searchable select (`Select`) | input | `primitives/Select.tsx` - **every** dropdown in the app (69 tags; 80 files reference it); a text field that is a combobox | Radix `Select` (removed, was unused) / `Command` (not installed) | none | none | High (combobox, `aria-activedescendant`) | High (typing, PageUp/Down, Escape that must not close a dialog) | Medium (`openUp`, tinted panel, dark skin) | 17 test files + `protected.spec` | **RETAIN** | Protected | A standard Select has no text filtering and a different keyboard model. The app has no non-searchable dropdown to give a shadcn Select a job. |
| Company / service-location search | input | `domain/CompanySearchInput.tsx`, `ServiceLocationSearchInput.tsx` (on `SearchField`) | `Command` / `Combobox` (not installed) | lookup lists | none | High | High | Medium | partial | **RETAIN** | Protected | Searchable lists with their own result handling; no equivalent installed. |
| `PhoneNumberInput` (+ `ContactPhoneInput`) | domain input | `primitives/PhoneNumberInput.tsx`, `phoneFormat.ts`, `countryDialCodes.ts`; wraps the app `Input` in its addon mode | `Input` | E.164 storage, country list, longest-prefix match, digits-only, length cap, Qatar mobile / landline rules | none (value in via props) | High (country combobox) | High | Medium | 3 test files + `protected.spec` | **RETAIN** | Protected | A plain Input has none of the parsing, formatting, country or cap logic; moving it into consumers would duplicate rules. |
| `QidInput` (`QidTypeSelector`, `QidNumberField`) | domain input | `domain/QidInput.tsx`, `data/idTypes.ts` | `Input` + `Button` | per-type label, keypad, placeholder; scanned number is read-only; Fetch rules | none | Medium | Medium | Medium | 5 test files + unit pin | **COMPOSE** (done in Phase 4) | Composition validated | It already consumes the migrated `Button` (Fetch). Its field is deliberately not the standard Input (`field-box`, barcode icon inside the border). |
| `SignaturePad` | domain control | `primitives/SignaturePad.tsx` (canvas, pointer events, `toDataURL`) | none | ink detection, export | none | High (pointer-only, see defects) | High | High (see defects) | unit pin + `protected.spec` + library sweep | **COMPOSE** (done in Phase 4) | Composition validated | No shadcn primitive draws on a canvas. Only its Clear / Cancel / Done buttons are the migrated `Button`. |
| `DataTable` | data display | `primitives/DataTable.tsx` (+ `Pagination`, `EmptyState`) | `Table` (never installed) | sort rules, paging, row and cell links, plain / framed | none inside; rows come from RTK Query hooks in screens | Medium (`aria-sort`, no `scope`) | Medium | Medium (tablet overlap, see defects) | 4 test files + `protected.spec` + sweep (7 screens) | **RETAIN** | Protected | A shadcn Table is markup only. |
| Tooltip system | overlay | `primitives/Tooltip.tsx`, `TooltipContext` (`TooltipGroup`), `tooltipGroup.ts` (37 tags, 20 files) | Radix / shadcn `Tooltip` (removed, was unused) | none | none | Medium | Medium | touch: shown on focus, no long-press | 1 test file + `protected.spec` | **RETAIN** (+ duplicate removed) | Protected | Portalled, group delay, focusable non-interactive triggers, nav-rail anchoring. A second provider would give two conventions. |
| Notification / toast system | state + overlay | `stores/notificationSlice.ts`, `capabilities/Toasts/Toast.tsx` (mounted once in `App.tsx`; `pushToast` used in 49 files) | Sonner / Radix Toast (Sonner removed, was unused) | keyed replace, history cap 30, auto-dismiss, structured rows, service links, purge by customer | **Redux slice**; `useSubmit` turns failures into toasts | Medium (`role=alert` / `status`, `aria-live`) | Medium (outside click and Escape clear the stack) | fixed stacks top / bottom | `milestones` + unit pin + `protected.spec` | **RETAIN** (+ duplicate removed) | Protected | The bell, the history and 49 callers read this state; a second queue would split it. |
| shadcn `Select` | duplicate | `components/ui/select.tsx` | - | - | - | - | - | - | showcase only | **REMOVE DUPLICATE** | Duplicate removed | Unused outside the showcase; it could only ever be mistaken for the app's searchable Select. |
| shadcn `Tooltip` | duplicate | `components/ui/tooltip.tsx` | - | - | - | - | - | - | showcase only | **REMOVE DUPLICATE** | Duplicate removed | Unused; a second tooltip provider. |
| shadcn `Sonner` (+ the `sonner` package) | duplicate | `components/ui/sonner.tsx` | - | - | - | - | - | - | showcase only | **REMOVE DUPLICATE** | Duplicate removed | Unused second toast system. `sonner` removed from `package.json` and the lock file. |
| shadcn `Dialog`, `DropdownMenu`, `Tabs` | not a duplicate of a protected system | `components/ui/` | - | - | - | - | - | - | showcase only | **DEFER** | Deferred | Candidates for the Modal / Tabs phases; unused, stock look (unthemed). Guarded by a test so they cannot be imported by accident. |
| `SearchField` | input | `primitives/SearchField.tsx` (24 tags) | `Input` | none | none | Medium | Medium | Low | 1 test file | **DEFER** | Deferred | Also the base of the company / location / phone comboboxes; not migrated in Phase 4 for that reason. |

## Contracts (what each component does today)

### Searchable select
- **API:** `{ label, error, helperText, options: {value,label}[], value, onChange(e), disabled, required, id, dark, aria-label, openUp, tintedPanel }`; `searchable` and `placeholder` are accepted and ignored.
- **Behaviour:** filtering is local (`label` includes the typed text, case-insensitive); no debounce, no remote search, no groups, no multi-select, no virtualisation. Typing never changes the value, only choosing a row does; leaving the field with unchosen text restores the chosen label. `onChange` receives a synthetic `{ target: { value } }` (every caller reads only `e.target.value`).
- **Keyboard:** open on focus / click / ArrowDown / ArrowUp / Enter; ArrowUp / Down move, PageUp / Down move 8, Enter chooses, Escape closes the list only (stops propagation so a surrounding Modal or Drawer stays open), Tab closes; Home / End and characters belong to the text field.
- **ARIA:** `role=combobox`, `aria-haspopup=listbox`, `aria-expanded`, `aria-controls`, `aria-autocomplete=list`, `aria-activedescendant`, `aria-required`, `aria-invalid`, `aria-describedby`; list `role=listbox`, rows `role=option`.
- **Responsive / dark:** an absolutely positioned panel (`top-full`, or `openUp`); a dark skin for the login page; `tintedPanel` for drawers.

### PhoneNumberInput
- **Stored value:** always E.164 (dial code + digits); the field shows the digits, with the dial code in a country combobox inside its left edge.
- **Rules:** digits only (`replace(/\D/g, '')`), capped at `min(maxNationalDigits, 15 - dial digits)`; changing the country rewrites the prefix and keeps the digits; the selected country is component state (dial codes are not unique); `fixedIso` pins one country and hides the picker; `maskedDisplay`, `readOnly`, `noAutoFocus`. `formatQatarPhoneForDisplay` ("+974 50350824") is presentation only. Qatar mobile `^[3567]\d{7}$`, landline `^4\d{7}$`.
- **ARIA / keyboard:** `inputMode=tel`, `autoComplete=tel-national`; the country trigger is a `role=combobox` named "Country calling code, currently Qatar +974"; its list is a `role=listbox`.

### QidInput
- `QidTypeSelector` (chips, `aria-pressed`, unavailable types shown with `aria-disabled` and a hint) and `QidNumberField` (label, placeholder and keypad come from `ID_TYPES`: QID / GCC / Diplomatic are numeric, Passport / Other are text). A scanned number is `readOnly`, `tabIndex=-1`, with no Fetch (the scan already looked it up); Fetch is disabled until there is a value. Validation and the supported-type rule live in `data/idTypes.ts` and the engines, not in the field.

### SignaturePad
- 480 x 160 canvas; pointer down / move / up / leave draw 2px strokes in the `--signature-ink` token (not the theme); `hasDrawn` gates Clear and Done; `toDataURL()` is the export; `disabled` is `aria-disabled` + dimmed + not drawable; optional Cancel. No undo, no high-DPI scaling, no keyboard alternative, no pointer capture.

### DataTable
- Columns: `key, header, render, numeric, strong, hideHeader, linkTo, sortable, sortValue, cellClassName`. Sorting: asc, desc, unsorted, natural-order `localeCompare`; paging (default 50, `Infinity` = none); `loading`, `emptyMessage` + `emptyAction`; `variant` framed / plain (sticky header, max 70vh); `dense`; `selectedKey`; `onRowClick`. Headers carry `aria-sort`. No filtering, selection, column visibility, resizing, URL sync or virtualisation - screens own those.

### Tooltip system
- `Tooltip({ content, placement, disabled, anchorRef })`: portalled, shows on hover (delay) and on focus, hides on Escape, sets `aria-describedby`, makes non-interactive triggers focusable, flips to stay in the viewport; `TooltipGroup` lets neighbours skip the delay (`--tooltip-group-window`).

### Notification system
- `notification` slice `{ toasts, history }`; `pushToast(kind, message, { key, autoDismissMs, detail, detailLink, rows, brand, reference, tinted })`; a keyed push replaces (same id); history capped at 30; `dismissToast`, `dismissAllToasts`, `markAllRead`, `purgeMentioning`. `ToastContainer` renders one-line toasts under the header and structured cards at the bottom, `role=alert` + `aria-live=assertive` for errors and `status` + `polite` otherwise; an outside pointer-down or Escape clears the stack.

## Existing defects found (recorded, not fixed)
1. **SignaturePad on narrow screens:** the canvas is CSS-scaled (235 px wide at 390, 318 at 768, on a 480-px bitmap) but strokes use `clientX - rect.left` with no 480 / rect.width scaling, so ink lands in the wrong place; no high-DPI handling; no undo; no keyboard or assistive alternative.
2. **DataTable on tablet scale:** cell text overlaps and clips (Phase 2 finding); `<th>` has no `scope`, no caption.
3. **Select:** `Home` / `End` are caret keys inside an open list (by design), so a long list cannot jump to its ends from the keyboard.
4. **Tooltip:** shown on focus and hover only; there is no long-press on touch.

## Governance added
- `// PROTECTED (docs/migration/phase5-specialised-components.md): ...` on the 8 implementation files; a test fails if a marker is removed.
- `tests/protectedComponents.test.mjs`: the application imports none of the shadcn Select / Tooltip / Sonner / Toast / Dialog / Dropdown / Tabs / Table / Command / Popover; no Sonner, Radix Toast, Radix Tooltip provider or second table engine; `ToastContainer` is mounted once; the only `<canvas>` is the signature pad; the installed shadcn set is exactly `button card checkbox dialog dropdown-menu input label tabs textarea`; none of the protected files composes a shadcn primitive.
- `CLAUDE.md` names the protected components and the rule.

## Not done, and why
- No protected component was rewritten; no new composition was added in this phase (SignaturePad and QidInput already consume the migrated `Button`, validated in Phase 4).
- `DataTable`, `Tooltip` and the toast renderer could use themed shadcn presentation (Table, Card) internally; there is no user or maintenance benefit today, so they stay as they are.
- `sonner` was removed from `package.json` and `package-lock.json` by hand (a leaf entry). Run `npm install` locally to prune `node_modules/sonner` and confirm the lock file.
