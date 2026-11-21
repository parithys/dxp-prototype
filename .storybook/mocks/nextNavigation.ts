// Stand-in for `next/navigation` in Storybook ONLY (aliased in .storybook/main.ts). The application's router layer (src/lib/routerHooks.ts) calls
// useRouter / usePathname / useSearchParams / useParams from Next's App Router; Storybook has no App Router, so these read and write the preview
// iframe's own URL instead of throwing. Navigation a story triggers is logged to the Actions panel via the `storybook:navigate` event, not performed.
import { useMemo } from 'react';

const emit = (kind: string, url?: string) => window.dispatchEvent(new CustomEvent('storybook:navigate', { detail: { kind, url } }));

export function useRouter() {
  return useMemo(
    () => ({
      push: (url: string) => emit('push', url),
      replace: (url: string) => emit('replace', url),
      back: () => emit('back'),
      forward: () => emit('forward'),
      refresh: () => emit('refresh'),
      prefetch: () => undefined,
    }),
    []
  );
}
export function usePathname(): string {
  return typeof window === 'undefined' ? '/' : (new URLSearchParams(window.location.search).get('path') ?? '/');
}
export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
}
export function useParams(): Record<string, string | string[]> {
  return {};
}
export function redirect(): never {
  throw new Error('redirect() is not available in Storybook');
}
export function notFound(): never {
  throw new Error('notFound() is not available in Storybook');
}
