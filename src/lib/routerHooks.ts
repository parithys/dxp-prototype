'use client';
// The application's navigation layer, over the Next.js App Router (the only router). Same names and call shapes the screens already use
// (useNavigate, Link, useLocation, useSearchParams, useParams, NavLink, Navigate, useBlocker), so a screen never imports a router package.
//
// What Next does not give, and how it is bridged here:
//   location.state   the journey's launch context ({ startFresh, launch, resumeOrderId, navJourney }) - Next has no per-entry state.
//                    Kept per URL in sessionStorage and cleared by `navigate(url, { replace: true, state: null })`, the way the
//                    journeys already consume it. (Back to an entry whose state was never consumed re-delivers it.)
//   useBlocker       the "leave this journey?" prompt. Intercepts navigation made through this module (navigate, Link, setSearchParams)
//                    and, for a reload or tab close, the browser's own beforeunload prompt. Browser Back/Forward CANNOT be intercepted
//                    in the App Router - a documented gap.
// Imports nothing from the rest of the app (architecture test: lib is the bottom layer).

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useParams as useNextParams, usePathname, useRouter, useSearchParams as useNextSearchParams } from 'next/navigation';

// ---------------------------------------------------------------- location state, per URL
const STATE_KEY = 'vfq-next-nav-state';
let navSeq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readStates(): Record<string, unknown> {
  try {
    return JSON.parse(sessionStorage.getItem(STATE_KEY) ?? '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}
function setUrlState(url: string, state: unknown) {
  try {
    const all = readStates();
    if (state === undefined || state === null) delete all[url];
    else all[url] = state;
    sessionStorage.setItem(STATE_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: the state simply does not survive */
  }
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const useNavSeq = () => useSyncExternalStore(subscribe, () => navSeq, () => 0);

// ---------------------------------------------------------------- blockers
interface Loc {
  pathname: string;
  search: string;
}
type BlockerFn = (args: { currentLocation: Loc; nextLocation: Loc }) => boolean;
const blockers = new Set<{ fn: BlockerFn; block: (proceed: () => void) => void }>();

const splitUrl = (url: string): Loc => {
  const [pathname, search = ''] = url.split('?');
  return { pathname, search: search ? `?${search}` : '' };
};

function runBlockers(url: string, go: () => void): boolean {
  const next = splitUrl(url);
  const current: Loc = { pathname: window.location.pathname, search: window.location.search };
  for (const b of blockers) {
    if (b.fn({ currentLocation: current, nextLocation: next })) {
      b.block(go);
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- navigation
export type NavigateFunction = (to: string | number, options?: { replace?: boolean; state?: unknown }) => void;

export function useNavigate(): NavigateFunction {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  });
  return useCallback<NavigateFunction>((to, options) => {
    if (typeof to === 'number') {
      window.history.go(to);
      return;
    }
    const url = to.startsWith('?') ? `${window.location.pathname}${to}` : to;
    const go = () => {
      navSeq += 1;
      setUrlState(url, options?.state);
      // Next's own scroll-to-top is off: the shell owns the scroll rule (navigation/useRouteScroll.ts: the same page keeps its position, a
      // different page opens at the top). Left on, Next also resets <main> for a query-string change on the same page.
      if (options?.replace) routerRef.current.replace(url, { scroll: false });
      else routerRef.current.push(url, { scroll: false });
      emit();
    };
    // A replace that only consumes state is never a departure.
    if (options?.replace && splitUrl(url).pathname === window.location.pathname) return go();
    if (!runBlockers(url, go)) go();
  }, []);
}

export function useLocation() {
  const pathname = usePathname();
  const params = useNextSearchParams();
  const seq = useNavSeq();
  const search = params.toString() ? `?${params.toString()}` : '';
  const state = typeof window === 'undefined' ? null : (readStates()[`${pathname}${search}`] ?? null);
  return { pathname, search, hash: '', state, key: `${pathname}${search}#${seq}` };
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string> | ((p: URLSearchParams) => URLSearchParams), opts?: { replace?: boolean }) => void] {
  const current = useNextSearchParams();
  const pathname = usePathname();
  const navigate = useNavigate();
  const params = new URLSearchParams(current.toString());
  const set = useCallback(
    (next: URLSearchParams | Record<string, string> | ((p: URLSearchParams) => URLSearchParams), opts?: { replace?: boolean }) => {
      const base = new URLSearchParams(window.location.search);
      const resolved = typeof next === 'function' ? next(base) : next instanceof URLSearchParams ? next : new URLSearchParams(next);
      const qs = resolved.toString();
      navigate(`${pathname}${qs ? `?${qs}` : ''}`, { replace: opts?.replace });
    },
    [navigate, pathname]
  );
  return [params, set];
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string>>(): T {
  const next = useNextParams() as Record<string, string | string[]>;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(next ?? {})) flat[k] = Array.isArray(v) ? v.join('/') : v;
  return flat as T;
}

export function useBlocker(fn: BlockerFn) {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    const entry = { fn: ((a) => fnRef.current(a)) as BlockerFn, block: (proceed: () => void) => setPending(() => proceed) };
    blockers.add(entry);
    return () => void blockers.delete(entry);
  }, []);
  // A reload or tab close cannot be routed through navigate(): ask the browser, when the guard would stop a departure from here.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      const here: Loc = { pathname: window.location.pathname, search: window.location.search };
      if (!fnRef.current({ currentLocation: here, nextLocation: { pathname: '/', search: '' } })) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);
  return {
    state: pending ? ('blocked' as const) : ('unblocked' as const),
    proceed: () => {
      const go = pending;
      setPending(null);
      // The blocker must not stop the very navigation it just allowed.
      const held = [...blockers];
      held.forEach((b) => blockers.delete(b));
      go?.();
      setTimeout(() => held.forEach((b) => blockers.add(b)), 0);
    },
    reset: () => setPending(null),
  };
}
