# Vodafone Qatar DXP - Storybook

The catalogue of the application's own forms, patterns, capabilities, business components, documents and screens. The design system (`dxp-ui`, folder `dxp-ui-library`) has **its own Storybook** (one page per component, tokens, icons, accessibility); this one covers what the application builds on it. It is **standalone** (its own tool chain, run with `npm run storybook`) and **derived from the app**: every story imports the production component from `src/`, and the preview loads the app's own stylesheet (`src/index.css` - Tailwind, the design system's CSS from `dxp-ui` (`preset.css`, `components.css`, `tooltip.css`), `app-components.css`, `tablet.css`), store, config and mock data. Nothing is copied or restyled for Storybook.

## Run it

```bash
npm install                      # installs the Storybook dev dependencies added to package.json
npm run storybook                # dev server on http://localhost:6006 (SB_PORT=... to change)
npm run build-storybook          # static build into storybook-static/
npm run storybook:serve          # serve the static build (http://localhost:6006)
npm run test-storybook           # runs every story's play function + accessibility checks in Chromium (Vitest)
npm run storybook:typecheck      # type-check the stories against the real Storybook types
npx playwright install chromium  # once, before test-storybook
```

Without Storybook installed (e.g. a sandbox with no npm access): `npm run storybook:typecheck:stubs` type-checks the stories against stub typings, and `npm run storybook:coverage` maps components to stories.

## Layout

| Path | What |
| --- | --- |
| `.storybook/main.ts` | Vite config: React + Tailwind v4 plugins, the `@/` alias, `public/` served at `/`, and a stand-in for `next/navigation` (the app's router layer sits on Next's App Router) |
| `.storybook/preview.tsx` | The app's providers (Redux store, booted and signed in as Retail Sales), the real `ToastContainer`, toolbar **Theme** (light/dark) and **Device** (Web/Tablet) |
| `storybook/primitives/` | One story file per component in the app's `src/components/primitives` (the service / connection type tags and the offer card parts). The design-system primitives (Input, Tabs, Modal, ...) and the Primitives Map are in the library's Storybook |
| `storybook/<category>/` | The other stories, by role: `foundations` (application icons, brand files, application accessibility, Arabic sizing, the Introduction), `forms`, `navigation`, `feedback`, `documents`, `business`, `patterns`, `examples` (domain components, capabilities and scenarios) |
| `storybook/_shared/` | `docs.ts` (the fixed documentation block each component carries) and `layout.tsx` (layout helpers using the app's own classes) |
| `storybook/CONVENTIONS.md` | The rules every story follows |
| `storybook/COVERAGE.md` | Generated map: component -> stories |
| `storybook/coverage-exclusions.json` | Application components deliberately without a story, with the reason (design-system coverage is in the library: `dxp-ui-library/stories/COVERAGE.md`) |

## The design system dependency

`dxp-ui` is resolved from `node_modules` like any package. After a change in `dxp-ui-library`, rebuild and reinstall it (`npm run build && npm pack` there, then unpack the tarball into `node_modules/dxp-ui`) before running this Storybook.

## Device and theme

The toolbar's **Device** switch sets the experience the app detects (`lib/deviceType.ts`: Web = pointer, Tablet = touch) and `data-device='tablet'` for `tablet.css`; changing it reloads the preview, because the app reads the device once per page. `?device=tablet` in the iframe URL does the same. **Theme** toggles the `.dark` class the app uses.
