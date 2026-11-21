// Story helper (not a story): sets the preview iframe's `?path=` so the mocked next/navigation `usePathname()` returns it, as the app's router
// layer would on that page. Navigation a component triggers is dispatched as `storybook:navigate` (see .storybook/mocks/nextNavigation.ts).
import type { Decorator } from '@storybook/react-vite';

export const withPath =
  (path: string): Decorator =>
  (Story) => {
    // Set synchronously, before the first render of the story, so the first paint already reads the path.
    const url = new URL(window.location.href);
    if (url.searchParams.get('path') !== path) {
      url.searchParams.set('path', path);
      window.history.replaceState(window.history.state, '', url);
    }
    return <Story />;
  };

/** Records `storybook:navigate` events into the story's args callback, so clicks on links show in the Actions panel. */
export function listenNavigate(onNavigate: (detail: { kind: string; url?: string; delta?: number }) => void): () => void {
  const handler = (e: Event) => onNavigate((e as CustomEvent<{ kind: string; url?: string; delta?: number }>).detail);
  window.addEventListener('storybook:navigate', handler);
  return () => window.removeEventListener('storybook:navigate', handler);
}
