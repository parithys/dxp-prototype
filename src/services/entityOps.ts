// The entity operations for code outside React (engines, submit helpers, effects): the store's dispatch bound to the API layer.
// Screens use the hooks in entityHooks.ts. Nothing else in the app talks to the mock data engine - it is the mock back end behind
// services/mockData.ts.
import { store } from '../stores/store';
import { currentAgentId } from '../stores/currentAgent';
import { apiSlice } from './apiSlice';
import { createEntityOps } from './entityWrites';
import type { EntityKind, EntityRecord } from './types';

export const entityOps = createEntityOps(store.dispatch, currentAgentId);

/**
 * A kind's records: the cached list (read once, then shared), or fetched; `fresh` reads it again first (a check that must judge the
 * records as they are now). A copy of the array - callers may sort or filter it freely.
 */
export async function listEntities<T = EntityRecord>(kind: EntityKind, options: { fresh?: boolean } = {}): Promise<T[]> {
  const rows = await store.dispatch(apiSlice.endpoints.listEntities.initiate(kind, { subscribe: false, forceRefetch: options.fresh })).unwrap();
  return [...rows] as unknown as T[];
}

/** One record by id, or undefined when there is none. */
export async function getEntity<T = EntityRecord>(kind: EntityKind, id: string, idField?: string): Promise<T | undefined> {
  const row = await store.dispatch(apiSlice.endpoints.getEntity.initiate({ kind, id, idField }, { subscribe: false })).unwrap();
  return (row ?? undefined) as T | undefined;
}

/** What is cached for a kind right now (undefined until it has been read). For reads that must not wait. */
export const cachedEntities = <T = EntityRecord>(kind: EntityKind): T[] | undefined =>
  apiSlice.endpoints.listEntities.select(kind)(store.getState()).data as unknown as T[] | undefined;
