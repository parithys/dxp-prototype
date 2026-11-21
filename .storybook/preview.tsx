// Every story renders inside the application's own providers, tokens and styles - nothing here restyles a component.
//   - src/index.css: Tailwind, the design system's CSS (dxp-ui preset / components / tooltip), app-components.css, tablet.css - the app's one stylesheet.
//   - the app's Redux store, booted and signed in the way the login page does it, so components that read config, persona or mock data work.
//   - the app's ToastContainer, so notification stories show the real toast.
//   - toolbar globals: Theme (light/dark, the `.dark` class AppBootstrap toggles) and Device (web/tablet, `data-device` and the app's own
//     device detection, lib/deviceType.ts).
import '../src/index.css';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';
import { Provider } from 'react-redux';
import { store } from '../src/stores/store';
import { configActions } from '../src/stores/configSlice';
import { authActions } from '../src/stores/authSlice';
import { personaActions } from '../src/stores/personaSlice';
import { pickProfileForRole } from '../src/engines/agentProfileEngine';
import { ToastContainer } from '../src/capabilities';
import { applyDemoContentSetting } from '../src/data/synthetic/syntheticMarker';
import { trackInputModality } from 'dxp-ui';

// The app's router layer sends "Back" through window.history.go(-1) (lib/routerHooks.ts). In Storybook that would navigate the preview page away
// (and close the test runner's page), so history traversal is logged like the other navigation (`storybook:navigate`, see mocks/nextNavigation.ts), not performed.
const traverse = (kind: string, delta?: number) => window.dispatchEvent(new CustomEvent('storybook:navigate', { detail: { kind, delta } }));
window.history.go = (delta?: number) => traverse('go', delta);
window.history.back = () => traverse('back');
window.history.forward = () => traverse('forward');

const DEMO_ROLE = 'ROLE-01';
const DEMO_STAFF_ID = 'VFQ12341';

let booting: Promise<void> | undefined;
let booted = false;
/** Boots config + mock data once, then signs in the demo role (Retail Sales), exactly as LoginPage does. */
function bootOnce(): Promise<void> {
  booting ??= (async () => {
    await store.dispatch(configActions.boot());
    if (!store.getState().auth.isAuthenticated) {
      const profile = await pickProfileForRole(DEMO_ROLE);
      store.dispatch(personaActions.setActivePersona(DEMO_ROLE));
      store.dispatch(authActions.signIn(DEMO_STAFF_ID, profile));
    }
    applyDemoContentSetting();
    booted = true;
  })();
  return booting;
}

function AppFrame({ children, toasts = true }: { children: ReactNode; toasts?: boolean }) {
  const [ready, setReady] = useState(booted);
  useEffect(() => {
    let live = true;
    void bootOnce().then(() => live && setReady(true));
    // The app's own rule: a selected tab wears no focus ring after a mouse click (lib/inputModality.ts).
    const stopTracking = trackInputModality();
    return () => {
      live = false;
      stopTracking();
    };
  }, []);
  if (!ready) return <p className="body-text text-muted">Loading the application's configuration and sample data…</p>;
  return (
    <>
      {children}
      {toasts && <ToastContainer />}
    </>
  );
}

/** Applies the toolbar's Theme and Device. The device is read once per page by the app (lib/deviceType.ts), so a change reloads the preview. */
const withGlobals: Decorator = (Story, context) => {
  const theme = (context.globals.theme as string | undefined) ?? 'light';
  const device = (context.globals.device as string | undefined) ?? 'web';
  document.documentElement.classList.toggle('dark', theme === 'dark');
  if (device === 'tablet') document.documentElement.dataset.device = 'tablet';
  else delete document.documentElement.dataset.device;
  try {
    if (window.sessionStorage.getItem('dxp-device') !== device) {
      window.sessionStorage.setItem('dxp-device', device);
      // The app's detectDeviceType() caches its answer for the page's life; reload so every component reads the chosen device.
      // Not under the Vitest browser runner (test-storybook): it fails a test whose page reloads, so there every story keeps the browser's own device.
      const underTestRunner = '__vitest_browser__' in window || '__vitest_worker__' in window;
      if (!underTestRunner && window.sessionStorage.getItem('sb-device-applied')) window.location.reload();
    }
    window.sessionStorage.setItem('sb-device-applied', '1');
  } catch {
    /* storage blocked: the browser's own device is used */
  }
  return (
    // A story that renders the app Shell (which mounts its own ToastContainer) sets `parameters.ownToastContainer` so toasts are not shown twice.
    <Provider store={store}>
      <AppFrame toasts={!context.parameters.ownToastContainer}>
        <Story />
      </AppFrame>
    </Provider>
  );
};

const preview: Preview = {
  decorators: [withGlobals],
  // The boot finishes BEFORE a story renders, so a story's play function (and the test runner) never meets the loading placeholder.
  loaders: [
    async () => {
      await bootOnce();
      return {};
    },
  ],
  tags: ['autodocs'],
  globalTypes: {
    theme: { description: 'Colour theme (the app\'s `.dark` class)', toolbar: { title: 'Theme', icon: 'circlehollow', items: [{ value: 'light', title: 'Light' }, { value: 'dark', title: 'Dark' }], dynamicTitle: true } },
    device: { description: 'Device the app detects: Web (pointer) or Tablet (touch)', toolbar: { title: 'Device', icon: 'tablet', items: [{ value: 'web', title: 'Web' }, { value: 'tablet', title: 'Tablet' }], dynamicTitle: true } },
  },
  initialGlobals: { theme: 'light', device: 'web' },
  parameters: {
    layout: 'padded',
    controls: { expanded: true, matchers: { color: /(background|color)$/i, date: /Date$/ } },
    // The app has no neutral Storybook background: the page background is the app's own (--bg), so the canvas switch is off.
    backgrounds: { disable: true },
    viewport: {
      options: {
        desktop: { name: 'Desktop (1440 x 900)', styles: { width: '1440px', height: '900px' }, type: 'desktop' },
        tablet: { name: 'Tablet (768 x 1024)', styles: { width: '768px', height: '1024px' }, type: 'tablet' },
        mobile: { name: 'Mobile (390 x 844)', styles: { width: '390px', height: '844px' }, type: 'mobile' },
      },
    },
    a11y: { test: 'todo' },
    docs: { toc: true },
    options: {
      storySort: {
        order: ['Introduction', 'Foundations', 'Primitives', 'Forms', 'Navigation', 'Feedback & Status', 'Documents', 'Business Components', 'Patterns', 'Application Examples'],
      },
    },
  },
};

export default preview;
