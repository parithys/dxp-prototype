// Renders a screen outside a running Next.js app: the App Router's own contexts, filled with a fixed location and a router that records nothing.
// (next/navigation hooks throw "expected app router to be mounted" without them.) Replaces react-router's MemoryRouter in render tests.
import React from 'react';
import { Provider } from 'react-redux';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { AppRouterContext } = require('next/dist/shared/lib/app-router-context.shared-runtime');
const { PathnameContext, SearchParamsContext, PathParamsContext } = require('next/dist/shared/lib/hooks-client-context.shared-runtime');

let reduxStore = null;
/** Screens that read the store need it when rendered here; storeTesting.mjs registers the app's store. */
export const registerRenderStore = (store) => {
  reduxStore = store;
};

const noop = () => {};
const router = { back: noop, forward: noop, refresh: noop, push: noop, replace: noop, prefetch: noop };

export function NextRouterProvider({ pathname = '/', search = '', children }) {
  const h = React.createElement;
  const inner = h(
    AppRouterContext.Provider, { value: router },
    h(PathnameContext.Provider, { value: pathname },
      h(SearchParamsContext.Provider, { value: new URLSearchParams(search) },
        h(PathParamsContext.Provider, { value: {} }, children))));
  return reduxStore ? h(Provider, { store: reduxStore }, inner) : inner;
}
