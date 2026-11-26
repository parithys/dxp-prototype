---
name: promote-to-library
description: Promote a reusable UI component, helper, hook, class or token from the prototype into the dxp-ui-library (../dxp-ui-library) so the library stays the single source of truth for reusable UI and Storybook. Use when the user says "promote X to the library", "move this to dxp-ui", "sync my prototype changes to the library", "I added/changed a component in the prototype", or when tests/libraryBoundary.test.mjs fails because generic UI was left in src/components, src/lib or src/hooks. Pass a component name, a path, or nothing (then review the working-tree diff for candidates).
---

# Promote to library

The design system and its Storybook live only in `../dxp-ui-library` (`@vfq/dxp-ui`, imported here as `dxp-ui`). This repository keeps journeys, routes, business logic, mock data, Redux/RTK Query and its own classes. This skill moves the generic part of a change from here into the library, then makes the prototype consume it. It acts only when asked; it never commits, tags, publishes or bumps `dxpUi.version` without an explicit request.

Library rules and the checklist live in `../dxp-ui-library/README.md` ("Promote a component from an application"). Read it first if anything below is unclear.

## 0. Preconditions
- Confirm `../dxp-ui-library` is readable/writable (if not, request access to that directory) and `node_modules/dxp-ui` exists here.
- Argument given: that component/path. No argument: run `git status` / `git diff --stat` and `node --test tests/libraryBoundary.test.mjs` and list candidates (files under `src/components`, `src/lib`, `src/hooks` that import only `react`, `dxp-ui` or other such files). Show the list and ask which to promote.

## 1. Classify (decide before moving anything)
For each candidate, read the file and its call sites:
- **Generic** (props/callbacks only; no store, router, `services/`, `engines/`, `data/`, mock data) -> promote.
- **Generic after a small decoupling** (one app import that can become a prop, callback or provider; hard-coded currency/locale/links/copy) -> decouple, then promote. `LinkProvider`/`useLink` is the pattern for links; formatters take currency/locale as parameters.
- **Product-keyed** (keyed to this product's data: telco line types, ID documents, plans, billing fields, QID/CAF/MSISDN wording) or app-coupled -> do NOT promote. Tell the user why. If it is generic-looking but product-keyed, it goes on `KEEP_IN_APP` in `tests/libraryBoundary.test.mjs` with a reason (> 15 chars).
Ask the user (AskUserQuestion) for borderline cases; do not guess.

## 2. Move into the library
1. Component -> `../dxp-ui-library/src/components/primitives/<Name>.tsx` (shadcn base control -> `src/components/ui/`); helper -> `src/lib/`; hook -> `src/hooks/`. Imports inside the library are relative, never `'dxp-ui'`, never an app path.
2. No business wording in comments, defaults or copy: neutral text, every user-visible string a prop with a neutral default.
3. Classes: move each class the component uses from `src/app-components.css` / `src/tablet.css` into `../dxp-ui-library/src/styles/components.css` as one semantic `.name { @apply ...; }` rule (inside `@layer components`). Move the tokens it reads (`--x` defined only in `src/app-tokens.css`) into `../dxp-ui-library/src/styles/tokens.css` (light block, and the `:root.dark` block if it has a dark value; a raw colour constant across themes goes in `CONSTANT_ACROSS_THEMES` in the library's `tests/tokens.test.mjs`). Never copy long utility strings: max 3 utilities per `className` beyond semantic classes (the budget test enforces it). A class the library does not use itself but the app does goes in `CONSUMER_API` in the library's `tests/semanticCssDuplicates.test.mjs`.
4. Export from `../dxp-ui-library/src/index.ts` (alphabetical among the primitives block).
5. Story: `../dxp-ui-library/stories/<category>/<Name>.stories.tsx`, CSF3, `docsParameters(...)` from `../_shared/docs`, layout helpers from `../_shared/layout`, imports from `../../src/...` only, title in a fixed category (Foundations, Primitives, Forms, Navigation, Feedback & Status), unique title, `source:` naming the file. Add the file to `stories/foundations/primitivesMap.json` (`kind`: page | section | internal | helper | style). Port an existing prototype story from git history if one exists.
6. Tests: assertions that read the moved file's source cannot stay here. Put them in `../dxp-ui-library/tests/movedComponents.test.mjs`. Prototype tests that `load('/src/...')` the moved file should `await import('dxp-ui')` instead (the package is loaded natively; use that instance when sharing module state).
7. `CHANGELOG.md` (`[Unreleased]`): Added/Changed entry.

## 3. Verify the library
In `../dxp-ui-library`: `npm run typecheck`, `npx oxlint --deny-warnings`, `npm test`, `npm run build`. (`npm run build-storybook` needs local port binding; if the sandbox blocks it, say so and give the command.) Fix failures at the source; never weaken a guard.

## 4. Switch the prototype to the library
1. Sync the build: `cd ../dxp-ui-library && node scripts/dev-sync.mjs --once` (copies `dist` into `node_modules/dxp-ui`; keep it a real copy, never `npm link`).
2. Rewrite every import of the moved file to `'dxp-ui'` (merge into an existing `import {...} from 'dxp-ui'`); delete the prototype copy and its now-unused CSS/tokens; repoint `src/capabilities/registry.json` and `src/workspace/administration/componentCatalogue.generated.json` paths if they name the file.
3. Run `npx tsc -b`, `npx oxlint`, `npm test`. `npm run build` and `npm run test:e2e` cannot run in the sandbox (local port binding): tell the user to run them in their terminal, plus the visual sweep (`e2e/sweep.spec.ts`) when CSS moved.
4. If the dev preview is running, reload and check the affected screen for console errors and computed styles.

## 5. Report
List: what moved (files, classes, tokens, story), what stayed and why, tests changed, check results with real numbers, and what the user must still do: pack/release the library (`npm run build && npm pack`, then `npm run lib:install -- <tarball>` in the prototype), bump `dxpUi.version`, run the build and e2e. Do not commit, tag or publish unless asked.

## Never
- Move product-keyed or app-coupled code into the library, or add an app import to it.
- Edit `node_modules/dxp-ui` by hand (it is overwritten on every sync/install).
- Keep a generic component in the prototype "because it was quicker".
