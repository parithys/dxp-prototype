# Story conventions

Storybook is the catalogue of the application's own components. These rules keep it that way.

**Scope.** The design system - tokens, colours, typography, spacing, icons, the shadcn/ui base components and the field / display primitives - is the `dxp-ui` package (`dxp-ui-library`) and is documented in ITS Storybook (one page per component, `dxp-ui-library/stories/CONVENTIONS.md`). Stories here cover what the application builds on top: domain components, patterns, capabilities, business components, documents, example screens and the few application-level foundations (application icons, brand files, application accessibility, Arabic sizing). A story for a design-system component does not belong here; a change to one is made in `dxp-ui-library`.

## Single source of truth
- A story **imports the production component** from `src/` (`../../src/components/...`, `../../src/capabilities`) or a design-system component from the package (`import { Button } from 'dxp-ui'`). It never copies, wraps-with-new-styling or re-implements one.
- No Storybook-only CSS. No new classes in `src/app-components.css` (or the design system's CSS) for a story. Use the app's semantic classes (`stack`, `cluster`, `grid-2-up`, `caption-muted`, `title`, `notice-*` ...) only for **layout around** specimens (see `_shared/layout.tsx`). No hex colours, no `style={{ color }}`; a literal inside a `style` is allowed only for a demo container width (`style={{ maxWidth: 480 }}`).
- Never change a production component, its props or its behaviour to make a story work. If a component cannot be rendered in isolation, say so in the story's docs and report it in your final message - do not patch `src/`.
- Do not invent variants or props. A control or story exists only for something the component supports (read the component's source and its call sites).
- Data comes from the app: `public/mock-data`, `public/config` (served by Storybook at `/`), the app's engines and stores. Small literal fixtures are fine when a component takes plain props.

## Files and titles
- One file per component or per closely related family: `storybook/<category>/<Name>.stories.tsx`. Optional `<Name>.mdx` only for prose that does not fit the docs block.
- `title` uses the category path: `Primitives/Button`, `Primitives/Data Display/Data Table`, `Forms/Input`, `Navigation/Tabs`, `Feedback & Status/Toast`, `Documents/File Upload`, `Business Components/Plan Card`, `Patterns/Eligibility Check`, `Application Examples/Order Summary`. Categories (top level, fixed order): Foundations, Primitives, Forms, Navigation, Feedback & Status, Documents, Business Components, Patterns, Application Examples. Do not create another top-level group. Do not list one component in two categories unless the stories show materially different uses.
- Directory: a story of a component in the app's `src/components/primitives` (the application tags and card parts) lives in `storybook/primitives/<Component>.stories.tsx`, whatever its `title` category. Everything else goes by category: `foundations/ forms/ navigation/ feedback/ documents/ business/ patterns/ examples/`. There is no Primitives Map here: it lists the design system's primitives and is in the library's Storybook.

## File shape (CSF3, Storybook 10)
```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from 'dxp-ui';
import { docsParameters } from '../_shared/docs';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  parameters: { ...docsParameters({ purpose: '...', source: 'src/components/patterns/...', variants: [...], states: [...], events: [...], usage: [...], accessibility: [...] }) },
  argTypes: { variant: { control: 'select', options: ['default', 'secondary'], description: '...' }, size: {...}, disabled: { control: 'boolean' }, onClick: { action: 'clicked' } },
  args: { children: 'Continue', onClick: fn() },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
```
- `tags: ['autodocs']` is global (preview.tsx); do not repeat it. Add `parameters.docs` via `docsParameters(...)` (purpose, variants, states, events, usage, validation, accessibility, devices, restrictions - only the sections that are true; no filler). The props table comes from the component's types.
- **Controls**: `argTypes` only for props the component supports; give each a `description`; use `control: 'select'` with the component's real options, `boolean`, `text`. Hide non-serialisable props with `control: false` / `table: { disable: true }`. Callback props: `fn()` in `args` (shows in Actions).
- **Stories**: `Default`, then one story per real variant, then one per applicable state: Hover, Focus, Active/Pressed, Selected/Unselected, Disabled, Read-only, Required/Optional, Empty/Populated, Loading, Success, Warning, Error/Validation error, Completed - only those that apply. A combined overview story (`AllVariants`, `AllStates`) uses `_shared/layout.tsx` and renders the real component many times.
- **State stories** that need hover/focus/pressed use a `play` function with `userEvent` (`hover`, `tab`, `pointer({ keys: '[MouseLeft>]', target })`), so the browser's real `:hover`/`:focus-visible` styles show - never a forced class.
- **Interactive stories** hold local state in a `render` function (`useState`) and pass the component's real handlers; they must work when clicked in the canvas. Add a `play` that exercises the behaviour and asserts (`expect(...)`) - open/close, select/deselect, type/validate, tab switch, keyboard (Arrow/Enter/Escape/Tab), file choose, toast appears, page change.
- **Device-specific** behaviour (Web vs Tablet): where a component takes a `device` prop, show both (`SideBySide`). Where it detects the device itself (lib/deviceType.ts), write `Web` and `Tablet` stories and document that the toolbar's **Device** switch (or `?device=tablet`) selects the experience; do not fake it with a copy.
- **Responsive**: stories that change by width set `parameters.viewport.defaultViewport` (`tablet`, `mobile`) in dedicated stories (`Tablet`, `Mobile`).
- **Accessibility**: `parameters.a11y` stays default. Note keyboard behaviour and labels in the docs block. Add a keyboard `play` for interactive controls. If a real component fails an a11y rule, do not fix it in `src/`; record it in the story docs under Restrictions and in your final report.
- Imports: value imports from `src/` only; type imports with `import type`. `noUnusedLocals` is on. No `any` unless a real prop type forces it. No `console.log`.
- Stories must not depend on each other or on journey state. Reset anything stored (notifications: `store.dispatch(notificationActions...)` through the app's own actions; localStorage keys) at the start of a story that needs a clean slate.

## Checking your work
Run `npm run storybook:typecheck` (real Storybook types; `storybook:typecheck:stubs` where Storybook is not installed). It type-checks every story against the real components with stub Storybook typings; it must report **no errors in your files**. You cannot run Storybook itself - so keep stories simple, deterministic and conservative with Storybook APIs (only `Meta`, `StoryObj`, `Decorator` from `@storybook/react-vite`; `fn, expect, userEvent, within, waitFor` from `storybook/test`; `action` from `storybook/actions`).
