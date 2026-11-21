// How screens read and write records: hooks over the API layer's generated query and mutation hooks.
import { useEffect, useMemo } from 'react';
import { shallowEqual } from 'react-redux';
import { useAppDispatch, useAppSelector } from '../stores/hooks';
import { currentAgentId } from '../stores/currentAgent';
import { apiSlice, useListEntitiesQuery } from './apiSlice';
import { createEntityOps } from './entityWrites';
import type { EntityKind, EntityOps, EntityRecord } from './types';

const LOAD_FAILED = 'We could not load this list just now. Please try again.';

/** A kind's records, or undefined until they have arrived. Reading is subscribing: the list loads on first use and is shared by every screen. */
export function useEntityRecords<T = EntityRecord>(kind: EntityKind): T[] | undefined {
  return useListEntitiesQuery(kind).data as unknown as T[] | undefined;
}

/** True while a kind's list is on its way for the first time (a refresh of a list already on screen is not "loading"). */
export const useEntityLoading = (kind: EntityKind): boolean => useListEntitiesQuery(kind).isLoading;

/** A plain-language message when the list could not be loaded, else undefined. */
export const useEntityError = (kind: EntityKind): string | undefined => (useListEntitiesQuery(kind).isError ? LOAD_FAILED : undefined);

/** True until a kind has been loaded (never loaded, or loading now) - what a detail screen needs to tell "loading" from "not found". */
export function useKindPending(kind: EntityKind): boolean {
  const { isLoading, isError, data } = useListEntitiesQuery(kind);
  return isLoading || (data === undefined && !isError);
}

/** Reads a kind's list again now (a screen that must show what other screens just wrote). */
export function useReloadEntities(): (kind: EntityKind) => Promise<void> {
  const ops = useEntityOps();
  return (kind) => ops.loadKind(kind, true);
}

/** Create, update and remove records (and load a kind), stamped to the signed-in agent. Stable between renders. */
export function useEntityOps(): EntityOps {
  const dispatch = useAppDispatch();
  return useMemo(() => createEntityOps(dispatch, currentAgentId), [dispatch]);
}

/**
 * Several kinds at once, for a screen that reads a fixed set of lists (a dashboard): subscribes to each, and returns the records, the
 * first-load flags and the load errors by kind - the same answers useEntityRecords / useEntityLoading / useEntityError give one at a time.
 * `kinds` must be a constant list (it is the dependency of the subscription).
 */
export function useEntityLists(kinds: readonly EntityKind[]): {
  records: Partial<Record<EntityKind, EntityRecord[]>>;
  loading: Partial<Record<EntityKind, boolean>>;
  errors: Partial<Record<EntityKind, string>>;
} {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const subscriptions = kinds.map((kind) => dispatch(apiSlice.endpoints.listEntities.initiate(kind)));
    return () => subscriptions.forEach((s) => s.unsubscribe());
  }, [dispatch, kinds]);
  // One flat object of the cached values, compared entry by entry, so the screen renders again only when one of them changes.
  const flat = useAppSelector((s) => {
    const out: Record<string, unknown> = {};
    for (const kind of kinds) {
      const q = apiSlice.endpoints.listEntities.select(kind)(s);
      out[`${kind}#data`] = q.data;
      out[`${kind}#loading`] = q.status === 'pending' && q.data === undefined;
      out[`${kind}#error`] = q.isError;
    }
    return out;
  }, shallowEqual);
  return useMemo(() => {
    const records: Partial<Record<EntityKind, EntityRecord[]>> = {};
    const loading: Partial<Record<EntityKind, boolean>> = {};
    const errors: Partial<Record<EntityKind, string>> = {};
    for (const kind of kinds) {
      records[kind] = flat[`${kind}#data`] as EntityRecord[] | undefined;
      loading[kind] = Boolean(flat[`${kind}#loading`]);
      errors[kind] = flat[`${kind}#error`] ? LOAD_FAILED : undefined;
    }
    return { records, loading, errors };
  }, [flat, kinds]);
}
