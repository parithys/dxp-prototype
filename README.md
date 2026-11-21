# VFQ DXP

A working prototype of the Vodafone Qatar (VFQ) Digital Experience Platform for retail and contact-centre agents: guided sales and service journeys, a Customer 360 view and the work queues around them. It runs entirely in the browser against synthetic data, so no backend is needed.

Built with React 19, TypeScript, Next.js (App Router), Tailwind CSS 4 and Redux Toolkit.

## Run it

Needs Node.js 22 or later.

```bash
npm install
npm run dev:all    # web http://localhost:5180/, tablet :5174, mobile :5175
```

One app, three fixed addresses: the web dev server on 5180, and the tablet and mobile views on 5174 and 5175, which show that same
running app inside a device frame (one dev server - Next.js 16 will not start a second one in the same folder).

| Command | View | URL |
|---|---|---|
| `npm run dev:all` | All three at once (the usual way to run it) | the three URLs below |
| `npm run dev` | Web | http://localhost:5180/ |
| `npm run dev:tablet` (= `view:tablet`) | Tablet frame, needs `dev` running | http://localhost:5174/ |
| `npm run dev:mobile` (= `view:mobile`) | Mobile frame, needs `dev` running | http://localhost:5175/ |

Set `PORT` / `TABLET_PORT` / `MOBILE_PORT` to move one (`PORT=6000 npm run dev`).

With the servers running, `npm run open:tablet`, `open:mobile`, `open:web` or `open:all` open Chrome windows pre-sized to each device
(tablet 820x1180, mobile 390x844, web 1440x900) so no DevTools is needed. Each view opens in its own throwaway Chrome profile, so its
sign-in is separate. Set `CHROME_PATH` if Chrome is not in its usual place. A sized window has a mouse, so touch-only behaviour
(the tablet device type) still needs DevTools device emulation or a real device.

**Tablet and mobile views (portrait / landscape):** with `npm run dev` running, `npm run view:tablet` serves http://localhost:5174/ and
`npm run view:mobile` serves http://localhost:5175/ (`TABLET_PORT` / `MOBILE_PORT` to move them): the running app inside a device frame with
Portrait / Landscape (or **Rotate**, key `R`), a device picker (tablet: iPad mini, iPad Air 11", iPad Pro 11" / 13", Galaxy Tab S9; mobile:
iPhone SE, iPhone 15, iPhone 15 Pro Max, Pixel 8, Galaxy S24), Fit / 100% zoom and Reload. The choice is kept in the address
(`?device=ipad-pro-11&orientation=landscape`). Both frame the one dev server (found on 5180, 5173 or 5181-5185, or `APP_URL`), so edits and the sign-in
show at once - unlike `dev:tablet` / `dev:mobile`, which Next.js 16 refuses to start beside `dev` ("Another next dev server is already running").
Touch and the device user agent are not emulated (`scripts/device-view.mjs`).

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (web, port 5180) |
| `npm test` | The automated suite (about 150 tests, no browser needed) |
| `npm run lint` | Lint with oxlint |
| `npm run build` | Type-check and production build into `.next/` |
| `npm run start` | Serve the production build (Node host, port 5173) |

### Login news

The sign-in screen's "Latest Updates" are the newest items of https://www.vodafone.qa/en/investor-relations/news (title, date, summary, banner and the article's own link), kept in `public/news/` by `scripts/sync-news.mjs`. Nothing there is edited by hand. The sync runs before `npm run dev` and `npm run build` (and keeps the last snapshot if the site cannot be reached), or on demand with `npm run sync:news` (`-- --limit=8` for a different count). It needs Node 22.15 or later for `--use-system-ca`, so the machine's certificate store is trusted. In CI or a scheduled job, run `npm run sync:news` to pick up new articles.

### Signing in

All 26 demo roles share one placeholder password, `Vodafone@123`. Staff IDs run `VFQ12341` to `VFQ12366`. The role matrix (which role has which ID, features and menu) is in `reference/outputs/Persona_Feature_Applicability_Matrix_Reference.xlsx`.

### Build settings

`NEXT_PUBLIC_SHOW_DEMO=false` hides demo-only UI (scanner simulators, specimen ID cards) for a production build. It is shown by default. See `.env.example`.

## What is in it

- **New Connection**: one continuous journey (Customer Identification once, then Postpaid, Prepaid, Fixed Line or MNP in the same wizard), and a separate **New Home Connection** journey (Fibre, Fixed-Line, FWA, 5G Home). Prepaid adapts to the device (Web or Tablet) instead of being a separate journey.
- **MNP Port-In**: NPAS approval and rejection, Confirmed Port-In Date, cancellation, Quick Draft, a Port-In Status screen, a signed MNP Form, a checkout validation gate and SIM reservation.
- **Mobile Services, Fibre & Home Services and New Connections**: the menu and journey pages, with the same four tabs per line.
- **Number Management Portal**: browse Star and Free numbers and reserve one for an identified customer.
- **Customer 360**, tickets and complaints, orders and approvals, leads, tasks and queues.

Journey and screen coverage is documented in `reference/`.

## How it is organised

```
src/
  capabilities/   the Capability Library: each reusable capability (Customer Identification, Number Selection,
                  Plan Selection, Payment ...) has one implementation; journeys import from its barrel
  components/     primitives (design system), domain controls, and multi-step patterns
  engines/        non-UI logic and data access (eligibility, rules, pricing, mock data)
  modules/        one folder per product line or journey
  navigation/     sidebar, breadcrumbs, journey catalogue
  workspace/      Customer 360, tickets, tasks, orders
public/
  config/         roles, features, routes, rules
  mock-data/      the synthetic records the app reads
tests/            node:test suites (journeys, UI guards, design tokens, architecture)
reference/        requirements, business rules, journeys, screen catalogue and the generator scripts
deploy/           nginx, Azure Static Web Apps and IIS configs
```

More detail: [`src/README.md`](src/README.md) (layout and naming), [`src/capabilities/README.md`](src/capabilities/README.md) (the Capability Library) and [`deploy/README.md`](deploy/README.md) (deployment).

## Things to know

- **Synthetic data only.** Customers, IDs, numbers and orders are made up. Changes are kept in memory for the session and are not saved anywhere.
- **Some integrations are simulated**: ID scanning and MOI, WinCash payment, and NPAS. Where an integration is simulated, the screen says so or marks the control as demo only.
- **Generated files are never hand-edited.** The role matrix, customer inventory and capability inventory are produced by scripts in `reference/scripts/`. `CLAUDE.md` lists which script to run after which kind of change.
- **Tests guard the design system.** There are checks for colours and spacing tokens, accessibility markup, import layering and the route catalogue. If a change fails one, read the message: it states the rule.

## Contributing

Run `npm test`, `npm run lint` and `npm run build` before pushing. GitHub Actions runs the same three on every push and pull request.


## Design-system library (`dxp-ui`)

The design system (shadcn/ui components, primitives, tokens, semantic component classes, icons, shared hooks and utilities) is a separate package with its own repository (`dxp-ui-library`, published as `@vfq/dxp-ui`). This repository keeps only the journeys, routes, business logic, mock data and the application's own classes and tokens (`src/app-components.css`, `src/app-tokens.css`, `src/app-base.css`, `src/tablet.css`).

- **The alias:** the app imports the package as `dxp-ui` (`import { Button } from 'dxp-ui'`, `@import "dxp-ui/preset.css"`). The real package name is set once, in `package.json` -> `dxpUi.package`; no source file names the npm scope.
- **Installing it:** `npm install` does not install it (it is not a listed dependency); run `npm run lib:install` afterwards. By default it comes from the registry (`dxpUi.package@dxpUi.version`). To use a packed build: `npm run lib:install -- /path/to/vfq-dxp-ui-0.1.0.tgz` (the library's `npm pack` output), or set `DXP_UI_SOURCE` to a tarball URL or an npm spec. CI does the same (`.github/workflows/ci.yml`).
- **Styles:** `src/index.css` imports `dxp-ui/preset.css`, `components.css` and `tooltip.css`, scans the package build for utilities (`@source`) and adds the app's own CSS.
- **Router link:** `src/next/AppFrame.tsx` gives the library's `DataTable` the application's router `Link` through `LinkProvider`.
- A component the prototype needs that the library lacks is NOT duplicated: it is listed in `LIBRARY_GAPS.md`.
