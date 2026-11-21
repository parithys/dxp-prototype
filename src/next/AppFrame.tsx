'use client';
// The Next.js host of the application: what the app shell does, around the page Next routes to. The pieces are the
// application's own (AppBootstrap: boot, theme, language, login gate; Shell: sidebar, header, breadcrumbs, toasts) - nothing here
// decides a screen, a rule or a customer.
import { Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import '../modules/registerAllScreens';
import { AppBootstrap, Shell } from '../App';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LinkProvider, Spinner, detectDeviceType, trackInputModality } from 'dxp-ui';
import { Link } from '../lib/router';
import { applyDemoContentSetting } from '../data/synthetic/syntheticMarker';
import { store } from '../stores/store';

export function AppFrame({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyDemoContentSetting();
    // A selected tab keeps no focus ring after a mouse click (see lib/inputModality.ts); a key press brings it back.
    const stopTracking = trackInputModality();
    // Touch devices get finger-sized controls and the tablet layout rules everywhere (tokens.css / tablet.css key off this).
    if (detectDeviceType() === 'tablet') document.documentElement.dataset.device = 'tablet';
    // The customer-view pop-up (?mirror=1) shows the journey content only: no app chrome.
    if (new URLSearchParams(window.location.search).get('mirror') === '1') document.documentElement.classList.add('mirror-window');
    return stopTracking;
  }, []);
  return (
    <Provider store={store}>
      {/* The library's DataTable draws row links through the application's router link (blockers and location state included). */}
      <LinkProvider value={Link}>
      <ErrorBoundary>
        <Suspense fallback={<div className="p-8 text-fg-2">Loading VFQ DXP…</div>}>
          <AppBootstrap>
            <Shell>
              <Suspense fallback={<div className="p-8"><Spinner size={24} label="Loading" /></div>}>{children}</Suspense>
            </Shell>
          </AppBootstrap>
        </Suspense>
      </ErrorBoundary>
      </LinkProvider>
    </Provider>
  );
}
