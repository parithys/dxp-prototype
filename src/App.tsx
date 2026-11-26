import { DevInfoOverlay } from './workspace/administration/DevInfoOverlay';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Button, ErrorBoundary } from 'dxp-ui';
import { configActions } from './stores/configSlice';

import { Sidebar } from './navigation/Sidebar';
import { Breadcrumbs } from './navigation/Breadcrumbs';
import { PersonaSwitcher } from './navigation/PersonaSwitcher';
import { UniversalSearchShortcut } from './navigation/UniversalSearchButton';
import { ToastContainer } from './capabilities';
import { LoginPage } from './auth/LoginPage';
import { MAIN_ID, useRouteAnnouncer } from './navigation/useRouteAnnouncer';
import { useRouteScroll } from './navigation/useRouteScroll';
import { useAction, useAppSelector } from './stores/hooks';
import { appPath } from './lib/basePath';

// The application's host-independent pieces: AppBootstrap (boot, theme, language, error and login gates) and Shell (sidebar, header,
// announcer, toasts around the page). src/next/AppFrame.tsx wires them around the page Next.js routes to.

/** Boots the configuration, applies the theme, and shows the error or login screen until a signed-in session exists. */
export function AppBootstrap({ children }: { children: ReactNode }) {
  const ready = useAppSelector((s) => s.config.ready);
  const error = useAppSelector((s) => s.config.error);
  const boot = useAction(configActions.boot);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const theme = useAppSelector((s) => s.theme.theme);

  useEffect(() => {
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  if (error) {
    return (
      <div className="p-8 space-y-3" role="alert">
        <p className="text-danger font-medium">The application could not start.</p>
        <p className="text-fg-2">Check your connection and try again.</p>
        <Button onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    );
  }

  if (!ready) {
    return <div className="p-8 text-fg-2">Loading VFQ DXP…</div>;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

/** The signed-in frame: skip link, sidebar, top bar, breadcrumbs and toasts around `children` (the routed page). */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hash = typeof window === 'undefined' ? '' : window.location.hash;
  useRouteScroll(pathname, hash);
  const routeAnnouncement = useRouteAnnouncer(pathname);
  return (
    <>
      {/* First tab stop: jump past the sidebar and the top bar (WCAG 2.4.1). Visible only while focused. */}
      <a
        href={`#${MAIN_ID}`}
        className="no-print skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(MAIN_ID)?.focus();
        }}
      >
        Skip to main content
      </a>
      <p className="sr-only" role="status" aria-live="polite">
        {routeAnnouncement}
      </p>
      <DevInfoOverlay />
      <div className="flex h-screen">
        <div className="no-print contents">
          <Sidebar />
        </div>
        <div className="fill-column overflow-hidden">
          <div className="no-print contents">
            <PersonaSwitcher />
            <Breadcrumbs />
          </div>
          {/* relative: <main> is the scroll container, so it must anchor absolutely positioned descendants (e.g. the visually
              hidden file inputs). Otherwise they resolve against the viewport and land a full scroll-offset below their
              card, inflating the scrollable height. */}
          <main id={MAIN_ID} tabIndex={-1} className="app-main">
            <ErrorBoundary resetKey={pathname} homeHref={appPath('/')}>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <UniversalSearchShortcut />
      <div className="no-print contents">
        <ToastContainer />
      </div>
    </>
  );
}
