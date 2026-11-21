# Native button migration, by role (status rule v4)

Source of truth for the numbers: `reference/outputs/UI_Component_Inventory_Reference.xlsx` -> **Button Triage** (every native `<button>`, its role, five checks and
planned action) and **Migration Summary**; regenerate with `python3 reference/scripts/build_ui_component_inventory.py`. History records "Status rule = v4".

## Decisions
- **Themed stock names, no `bare`.** `Button` has the stock `link` and `ghost` variants and the `icon` / `icon-sm` sizes, themed to the app (`link` = the `.link` text
  link, `ghost` + `icon` = the 36px icon button). An icon size requires `aria-label` or `aria-labelledby` (type-enforced). Stock utility styles were NOT restored
  verbatim: they would outrank the semantic classes (component layer < utilities) and restyle every converted control.
- **Disclosures and menu controls stay native** (`aria-expanded`, `aria-haspopup`, menu item, tab, switch), icon-only or text.
- **Clickable cards / list rows stay native** and must pass the v4 checks; a failing one goes on the fix list, not into a conversion PR.
- `react/button-has-type` (oxlint) enforces `type`.

## v4 checks (`button_conformance`)
explicit `type` | accessible name (visible text, `aria-label`, `aria-labelledby`, or sr-only text) | no nested interactive element (tags, `onClick`, `role`, `tabIndex`
inside) | focus: not suppressed without a token ring, no literal focus colour, and the global `:focus-visible` rule uses `--focus-outline` | carries a semantic class.
The repo has no `--ring` token: its focus tokens are `--focus-outline` and `--focus-ring`.
Static analysis sees only class strings written in the same file and handlers defined in it (a prop callback `onOpen` is not seen as navigation).

## Counts (129 native buttons outside the protected components; 11 more sit inside them and stay)
| Role | Buttons | Action |
|---|---|---|
| navigates | 10 | `<a>` / router Link |
| link-styled action | 24 | Button `variant="link"` |
| icon-only control | 21 -> 16 (5 are `aria-expanded` disclosures) | Button `ghost` + `icon` |
| clickable card / list row | 30 | keep native (all pass) |
| disclosure / menu control | 25 | keep native (all pass) |
| other (pills, option tiles, pager cells, segments) | 24 | undecided |

## PR sequence (stacked; each re-runs the inventory)
1. `migration/foundation-v4` - inventory v4, size tokens, `<th scope>`, field errors, themed Button, lint rule, probe baseline.
2. `migration/buttons-icon` - the 16 icon-only controls (this document's first conversion).
3. `migration/buttons-link` - the link-styled actions (23 of 24 converted; see below).
4. `migration/buttons-nav` - the navigating buttons become real links (with the keyboard and accessibility-tree spot-check).

## Gates per PR
`npx tsc -b`, `npm run lint`, `npm test`, `npm run build`, the full Playwright suite (pixel + accessibility-tree sweep, overlays, login, a11y), and
`e2e/buttonProbe.spec.ts` - a computed-style snapshot (tag, name, box, look) of every button / link on login, the shell, search, the journey and every library
group, taken BEFORE the PR's conversions and compared after; an intended property change updates the snapshot in the same PR, with the reason. Pixels of the login
page (not in the signed-in sweep) are pinned by `e2e/login.spec.ts`.

## Icon PR: what changed in the probe, and why it is accepted
Sizes are unchanged everywhere (the controls that had no size of their own got `size-auto`, the one with 3 disabled utilities a semantic class
`.icon-button-inert`). Three computed properties differ and are invisible: `display` block -> flex and `justify-content` -> center (the glyph fills its box, or the
carousel dot is an absolutely positioned `::before`), and `border-radius` 0 -> 12px on a transparent control (the focus ring now follows the token ring `btn-icon`
draws). The sweep, overlays and login screenshots are identical.
Not exercised by any test (changed by class reasoning only): the MSISDN "remove filter" chip, the SIM "scan barcode" control, the Q-ticket info icon, the bulk-operation
"remove row" control.
Finding (pre-existing, not changed here): the decorative `<svg>` inside every icon button is exposed as an unnamed `img` in the accessibility tree; fixing it in `Icon`
would change every sweep accessibility baseline.

## Screen-reader checklist (manual: no assistive technology is available to the test machine)
With VoiceOver (Safari) and NVDA (Firefox), for the login page and a customer 360 page: each icon button announces "<label>, button"; the theme toggle and the
show-password control announce the new state/name after activation; the carousel dots announce "Show <title>, button" and the current one is announced as current; Tab
order follows the visual order; no icon is announced as a separate unlabelled image (known: see the finding above). For converted links (nav PR): "<name>, link", and
Enter / Space behaviour as expected for a link.

## Link PR
23 link-styled buttons became `<Button variant="link" className="...">` with their own semantic class kept (`link-on-dark`, `link-action`, `link-block`, `link`, ...).
Checked statically for CSS order (the component layer resolves equal-specificity rules by source order): `.link` (red, underline on hover) is overridden by every
later class that sets a colour (`link-on-dark`, `link-end`, `link-body-strong`, `link-block`, `caption-secondary`) and agrees with the earlier ones (`link-inline`,
`link-action`). The probe, the sweep, the overlays and the login pixels are unchanged; no snapshot was updated.
- **Not converted (decision needed):** the library specimen "Back Button" (`breadcrumb-back back-link`): `.link` would turn its `text-fg` red and add a hover
  underline; it is also a navigation-style control. Stays native, on the fix list.
- **Two telesales links** (`TelesalesBillingSection`, `TelesalesConnectionsSection`) had no semantic class (utilities only: `text-link font-semibold ...`); they gain
  `.link`'s hover underline, the only visible change in this PR.
- **Not exercised by any test** (journey-only states): the QID / passport / CAF / additional-documents links, the plan-card links, the eligibility and cross-sales
  links, the family-package link, the ticket "Add" link, `EntityMissing`.

## Navigation PR
Converted to `<Link to=... state=...>` (the app's router Link: a real `href`, plain click runs the same blockers and location state as `navigate()`, modified clicks
and "copy link" work): the three global-search result groups (the keyboard path Enter / arrows + Enter still navigates itself), the notification menu items, the customer
and enterprise-account search results (the click also records the active customer), the Billing Account "Back to Customer 360" (a link when the customer is known),
the Customer Actions "Start a New Connection" and its reachable journeys, and the product action tiles.
- **Stay buttons on purpose:** the breadcrumb "Back" (`navigate(-1)` is history, not a destination), the same fallback on the Billing Account page, an unreachable
  journey (a disabled button, since a link cannot be disabled), and a product action with no routed destination (keeps the old inert button).
- **Fix found on the way:** `.menu-item` removed the outline with no replacement ring; it now draws an inset token ring on keyboard focus (the only visual change).
- **Probe:** the global-search result rows changed from tag `button` / role button to `a` / link, nothing else; snapshots updated for that reason. The component
  catalogue gained `ActionTile` (512 components), so its library snapshots were refreshed (only the count changed).
- **Spot-check** (`e2e/buttonRoles.spec.ts`): results are `<a href>` with role link, the name is the result text, Enter navigates, clicking clears and closes the search.
- **Not exercised by any test:** the notification menu items (needs unread workflow items), the Customer Actions drawer links, the product action tiles, the Billing
  Account back link.

## Remaining after the three conversions (inventory: 446 Done, 52 Pending, 14 Retained)
All 52 pending components trace to the buttons below and nothing else (no hardcoded value, no other raw element):
- 24 buttons that are pills, option tiles, pager cells, segments and similar widgets with no card / row / link class: **a decision is needed** (keep native like the
  disclosures, or give them a role).
- 2 history-back buttons (`navigate(-1)`): stay native; classed "other".
- 1 link-styled library specimen (`back-link`): stays native (see the link PR).
