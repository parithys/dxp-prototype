// Persistence for the Redux slices, in the exact envelope the app has always written - `{ state, version }` under the same `vfq-` key -
// so a browser that already holds saved state keeps it, `resetApplicationState` (which clears by the `vfq-` prefix) still covers every
// slice, and another tab can read the signed-in flag from the auth key (authSlice). Imports nothing from the app.

/** localStorage-shaped storage: a slice that spans two lifetimes supplies its own (customerContextSlice). */
export interface PersistStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface PersistConfig<S> {
  key: string;
  /** Default: localStorage. */
  storage?: 'local' | 'session' | PersistStorage;
  /** Compared with the stored version only when the stored payload carries a numeric one; a payload saved before versioning is used as is. */
  version?: number;
  /** What is written; default is the whole slice. */
  partialize?: (state: S) => unknown;
  /** Runs when the stored version differs from `version`. Without it a version mismatch discards the stored state. */
  migrate?: (persisted: unknown, storedVersion: number) => unknown;
  /** Combines what was read with the slice's defaults; default is `{ ...current, ...persisted }`. */
  merge?: (persisted: unknown, current: S) => S;
}

function storageOf(cfg: { storage?: PersistConfig<unknown>['storage'] }): PersistStorage | null {
  try {
    if (typeof cfg.storage === 'object') return cfg.storage;
    const s = cfg.storage === 'session' ? globalThis.sessionStorage : globalThis.localStorage;
    return s ?? null;
  } catch {
    return null; // storage blocked
  }
}

/** The slice's starting state: its defaults overlaid with whatever the browser saved, read once at start-up. */
export function hydrateSlice<S>(initial: S, cfg: PersistConfig<S>): S {
  const merge = cfg.merge ?? ((persisted: unknown, current: S) => ({ ...current, ...(persisted as object) }) as S);
  try {
    const raw = storageOf(cfg)?.getItem(cfg.key);
    if (!raw) return initial;
    const stored = JSON.parse(raw) as { state?: unknown; version?: number };
    let persisted: unknown = stored.state;
    if (typeof stored.version === 'number' && stored.version !== (cfg.version ?? 0)) {
      persisted = cfg.migrate ? cfg.migrate(stored.state, stored.version) : undefined;
    }
    return persisted === undefined ? merge(undefined, initial) : merge(persisted, initial);
  } catch {
    return initial; // unreadable saved state is ignored, never fatal
  }
}

interface Subscribable<R> {
  getState: () => R;
  subscribe: (listener: () => void) => () => void;
}

/** Writes a slice back to storage whenever it changes (by reference), as the app's persisted stores always did. */
export function persistSlices<R extends Record<string, unknown>>(store: Subscribable<R>, configs: { [K in keyof R]?: PersistConfig<R[K]> }): void {
  const last = {} as Partial<R>;
  for (const k of Object.keys(configs) as (keyof R)[]) last[k] = store.getState()[k];
  store.subscribe(() => {
    const state = store.getState();
    for (const k of Object.keys(configs) as (keyof R)[]) {
      if (state[k] === last[k]) continue;
      last[k] = state[k];
      const cfg = configs[k] as PersistConfig<R[typeof k]>;
      try {
        storageOf(cfg)?.setItem(cfg.key, JSON.stringify({ state: cfg.partialize ? cfg.partialize(state[k]) : state[k], version: cfg.version ?? 0 }));
      } catch {
        /* storage full or blocked: the in-memory state still works */
      }
    }
  });
}
