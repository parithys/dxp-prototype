# VFQ DXP - Next.js architecture

Next.js 16 (App Router, Turbopack), React 19, Tailwind 4. Next.js is the only host and the only router: `react-router-dom` is no longer a
dependency and nothing imports it. This document replaces the original spike report (Vite app, `react-router-dom` aliased to a compat
file, static export); that report's findings that still hold are carried into sections 5-8 and marked *(verified in the spike)*.

Scope rule held through the migration: architecture may change; UX, business rules, capabilities, customer data and journey behaviour may not.

## 1. Architecture

| Area | Now |
|---|---|
| Host | Next.js App Router. `npm run dev` = `next dev` (port 5173, `PORT` overrides), `npm run build` = `tsc -b && next build`, `npm run start` = `next start` |
| Rendering | Browser-only. `app/ClientRoot.tsx` loads `src/next/AppFrame.tsx` with `dynamic(..., { ssr: false })`: the stores read `localStorage` / `sessionStorage` and journeys open windows and channels, so nothing is rendered on the server. No Server Components with data, Server Actions, API routes or middleware |
| Routing | One `app/**/page.tsx` per URL (30 pages + `app/not-found.tsx`). Each page is a thin wrapper naming a screen exported by `src/next/routes.tsx` |
| Shell | `app/layout.tsx` (head tags, `#root`, `src/index.css`) -> `ClientRoot` -> `AppFrame` -> `AppBootstrap` (boot, theme, language, error + login gate) -> `Shell` (sidebar, header, breadcrumbs, announcer, toasts) -> the routed page |
| Navigation API | `src/lib/router.ts` (hooks in `routerHooks.ts`, components in `routerLinks.tsx`): `useNavigate`, `useLocation`, `useSearchParams`, `useParams`, `useBlocker`, `Link`, `NavLink`, `Navigate`, over `next/navigation`. 69 files import it. It imports nothing from the rest of the app (`lib/` is the bottom layer in `tests/architecture.test.mjs`) |
| Data | One RTK Query API layer (`src/services/apiSlice.ts`): every read and write of a record, and the sign-in news, goes through its endpoints (`listEntities`, `getEntity`, `createEntity`, `updateEntity`, `removeEntity`, the typed Lead endpoints, `getNews`). Prototype endpoints are `queryFn`s over `services/mockData.ts`, which reads `public/mock-data/*.json` through `engines/mockDataEngine` - the mock back end, imported by nothing but `src/services` (architecture test). `public/config/*.json` is static application configuration, loaded once at boot by `engines/configEngine`. No server |
| Build flags | `NEXT_PUBLIC_*` (`.env.example`); `src/lib/buildEnv.ts` and `src/lib/basePath.ts` are the only readers. Vite is kept only as the test harness's SSR loader (`tests/harness.mjs`, `vite.config.ts`) |
| Deploy | A Node host (`npm run start`) behind a reverse proxy (`deploy/nginx.conf`). No `index.html` fallback: Next resolves every URL itself, so a refresh on `/customer/CUST-1001` works |

### Route files

`src/next/routes.tsx` keeps what `src/router.tsx` used to: the screen, its props and its `RequireFeature` guard for each URL; the
workspaces and journeys are `lazy()`, while the dashboard, module screens and screen registry stay eager. A route file adds a URL, never behaviour.

| URL | Screen | Guard |
|---|---|---|
| `/` | Dashboard | - |
| `/customer-search`, `/leads`, `/operations`, `/sales`, `/support`, `/orders`, `/bill-formatter`, `/profile`, `/ticket-history` | the workspace of that name | - |
| `/new-connections`, `/mobile`, `/mobile/[category]`, `/fibre-home`, `/fibre-home/[category]` | `ProductLinePage` | - |
| `/mobile/start-connection`, `/mobile/start-connection/existing/[customerId]` | `NewConnectionWizard` | `postpaid.new-postpaid-wizard` |
| `/fibre-home/start-connection/existing/[customerId]` | `NewConnectionWizard` (home) | `fixedline.new-fixed-line-wizard` |
| `/mobile/change-postpaid-plan`, `/mobile/change-prepaid-pack`, `/mobile/add-addon` | the line-change wizards | `mobile.change-postpaid-plan`, `mobile.change-prepaid-pack`, `mobile.add-addon` |
| `/customer/[customerId]` | Customer 360 / Business 360 | - |
| `/billing-account/[billingProfileId]` | Billing account | - |
| `/tasks`, `/tasks/[taskId]` | Task list / detail | - |
| `/administration` | Administration | `workspace.admin-role-access-viewer` |
| `/trouble-ticketing-complaints/approval-queue`, `.../approval-review` | Ticket approval | - |
| `/[moduleSlug]`, `/[moduleSlug]/[screenSlug]` | `ModuleScreenList`, `ScreenRouteResolver` (the 213-screen catalogue) | - |
| anything else | `app/not-found.tsx` -> `NotFound` | - |

Next prefers a static folder over a dynamic one, which reproduces react-router's ranking (`/mobile/start-connection` beats `/mobile/[category]`
beats `/[moduleSlug]/[screenSlug]`). The three legacy "New Prepaid Tablet step" paths are `redirects()` in `next.config.mjs`, not pages.

### What the navigation layer adds over Next

| Need | How it is met |
|---|---|
| `location.state` (journey launch context: `startFresh`, `launch`, `resumeOrderId`, `navJourney`) | Next has no per-entry state. Kept per URL in `sessionStorage`; consumed by `navigate(url, { replace: true, state: null })`, as the journeys already do |
| `useBlocker` (the "Leave this journey?" prompt) | Intercepts navigation made through the layer (`navigate`, `Link`, `setSearchParams`). Reload and tab close get the browser's own `beforeunload` prompt when the guard would block a departure |
| Redirect / active link | `Navigate`, `NavLink` |

## 2. Generated references that read the routes

The route table is read from `app/` (not from a router file) by `tests/routeTable.mjs` and, for the Python generators, `reference/scripts/_next_routes.py`,
which render `<Route path=... element=...>` lines from the page folders and `src/next/routes.tsx`. A page that names a screen
`routes.tsx` does not export aborts the generator. Consumers: `build_persona_feature_matrix.py` (every nav destination needs a page),
`build_ui_component_route_inventory.py`, `build_reusable_capabilities_inventory.py`, `build_ui_component_inventory.py`, and the source-guard tests
(`journeyAccess`, `journeyCatalogue`, `newConnection`, `scanCustomer`). `tests/nextRouting.test.mjs` asserts that nothing imports `react-router`, every
page has a screen, URLs are unique, and every nav-manifest destination resolves to a page other than the module catch-all.

Render tests run screens outside a Next app through `tests/routerContext.mjs`, which fills the App Router's own contexts (replacing `MemoryRouter`).

### Data access (the API layer)

Screens read records with `useEntityRecords(kind)` / `useEntityLoading` / `useEntityError` / `useKindPending` / `useEntityLists` (`services/entityHooks.ts`, over the generated `useListEntitiesQuery`), and write with `useEntityOps()` (`createRecord`, `updateRecord`, `removeRecord`, `loadKind`). Code outside React uses `entityOps` and `listEntities` / `getEntity` (`services/entityOps.ts`). A list is cached for the session (`keepUnusedDataFor: Infinity`); every write invalidates its kind's tag, and also patches the cached list at once so a screen never waits for the refetch. Writes to customer information produce the audit-trail rows in the handler (`services/mockData.ts`), not in the screen. Latency is the mock engine's own (200-600 ms); the API layer adds none. To go live, replace each `queryFn: mock(handler)` with a `query` (the swap is documented in `apiSlice.ts`) and delete `services/mockData.ts`.

## 3. State ownership (A-F) *(verified in the spike)*

| Category | Owner | Persistence | Survives a route change |
|---|---|---|---|
| A Application | `configStore`, `authStore`, `themeStore`, `sidebarStore`, `regionStore`, `notificationStore`, `qnomyQueueStore` | local storage (auth, theme, sidebar, region) | yes |
| B Customer | `customerContextStore` (`customer`, `recentCustomerIds`, `journey`), `customerVerificationStore` | `customer` in localStorage, `journey` in sessionStorage | yes |
| C Persona/role | `personaStore` (`activePersonaId`, versioned migration) | localStorage | yes |
| D Journey | `workflowStore` (drafts per wizard id), journey lock in `customerContextStore.journey` | sessionStorage | yes |
| E Capability | inside the draft `values` (`contact`, `eligibility`, `caf`, `billingAccount`, `simDetails`, `launchCustomerId`) | with the draft | yes |
| F Page-local | React `useState` | none | no (by design) |

Nothing in A-E lives in the router, so none of it depends on the host. The only router-held state is the URL and the launch context in section 1.
No default, mock or hard-coded customer is substituted anywhere.

## 4. Shared capabilities

Unchanged: the Capability Library under `src/capabilities/` (Customer Identification, Eligibility Gate, Line Selection, Plan Selection, Checkout Summary,
CAF & Signature, Payment, Activation Complete, Guided Activation Wizard, Customer view). No capability logic exists in `app/` or `src/next/`.
Only `GuidedActivationWizard` uses `useBlocker`.

## 5. Persona / role behaviour *(verified in the spike, Next and Vite identical)*

`personaStore` / `personaEngine` are unchanged; `RequireFeature` and the navigation engine read them as before. Mid-journey role switch
(Retail Sales ROLE-01 -> Direct Sales ROLE-03 and back): the app's own "Switch role with a journey in progress?" dialog appears; the journey shows "No access"
for the role without the grant while the customer, journey lock and draft step are retained; switching back restores the step. Roles other than these two
were not tested live.

## 6. Desktop / tablet *(verified in the spike)*

`detectDeviceType()` and everything using it are unchanged; `AppFrame` applies `data-device="tablet"` on touch devices (what `main.tsx` did). Touch: the CAF type
is Touch Screen with a signature pad, Customer view is not offered, the scan control is "Initiate scan". Web: Digital CAF
(`tests/signatureMode.test.mjs`). The device is read once on first use, so a page loaded on a touch device and later resized keeps its first reading.

## 7. Verification of the migration (2026-11-06)

- `npx tsc -b`, `npm run lint` (0 warnings), `npm test` (921 tests, 920 pass, 1 TODO: the CUST-1001 QID mismatch between `customers.json` and `identity-documents.json`).
- `next dev` driven in a browser: sign-in; Dashboard, Customer Search, Leads and Orders by sidebar link; reload on `/customer/CUST-1001` renders Customer 360;
  `/mobile/start-connection` renders; an unknown URL renders Page Not Found; the legacy prepaid URL redirects; the "Leave this journey?" dialog appears when a
  breadcrumb link is clicked after a simulated ID scan, and Abandon proceeds to `/`; no console errors.
- **Not run:** `npm run build` (`next build`). Turbopack's PostCSS step needs a local port, which the Claude sandbox refuses (EPERM); run it in a normal terminal or CI.
- **Not tested:** the `beforeunload` prompt, every route by click (only the ones above), other roles, the Customer view pop-up window, a real tablet, and `next start`.

## 8. Known gaps and risks

1. **Browser Back/Forward cannot be intercepted by the App Router.** Back leaves a journey with no prompt (draft, journey lock and step are preserved). On `main`
   (react-router data router) Back was blocked. This is the one behavioural regression of the migration.
2. **Per-URL state** is a different model from per-history-entry state: Back to an entry whose launch state was never consumed re-delivers it (journeys consume it
   immediately, so not observed), and two entries with the same URL share state.
3. **Needs a Node host.** The static-export hosting (nginx fallback, Azure Static Web Apps, IIS) was removed with `output: 'export'`; `deploy/staticwebapp.config.json` and
   `deploy/web.config` were deleted.
4. Next warns that it ignored a `package-lock.json` outside the repo; `turbopack.root` would silence it.
5. The spike's static-host simulator (`scripts/serve-static.mjs`) was removed: there is no static `out/` to serve.
6. After login the URL is reset to `/`, so a deep link opened while signed out is lost (same as before the migration).
7. CUST-3083 has no postpaid lines, so Change Postpaid Plan correctly stops at Select Line: data, not a defect.

## 9. Rule for changes

A new screen is a new `app/<path>/page.tsx` plus an export in `src/next/routes.tsx`; import routing from `src/lib/router`, never from `next/navigation` for
`useNavigate`-style needs (the layer carries the launch state and the leave prompt). Then regenerate the workbooks listed in `CLAUDE.md`.
