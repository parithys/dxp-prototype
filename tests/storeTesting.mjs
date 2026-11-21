// The Redux store, as the tests reach it: the same singleton the app modules loaded through the harness use.
import React from 'react';
import { Provider } from 'react-redux';
import { load } from './harness.mjs';
import { registerRenderStore } from './routerContext.mjs';

/** { store, patch(sliceName, partialState), wrap(element) } - `patch` seeds a slice with a known starting state; `wrap` gives a rendered element the store (what <Provider> does in the app). */
export async function storeApi() {
  const m = await load('/src/stores/store.ts');
  registerRenderStore(m.store);
  return {
    store: m.store,
    patch: (slice, patch) => m.store.dispatch(m.patchSliceState({ slice, patch })),
    wrap: (element) => React.createElement(Provider, { store: m.store }, element),
  };
}
