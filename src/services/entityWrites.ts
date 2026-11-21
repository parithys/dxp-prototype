// What the app writes and reads records with, over the API layer: createEntityOps(dispatch) gives the entity operations bound to a
// dispatch (React screens get it from useEntityOps, everything else from entityOps.ts). A successful write patches the cached list at
// once - a screen shows what was just saved without waiting for the refetch the write's tag invalidation starts - and only extends a list
// that has been loaded (creating into an unloaded kind must not cache just the new record: the next read takes the full list).
import { apiSlice } from './apiSlice';
import type { EntityKind, EntityOps, EntityRecord } from './types';
import type { AppDispatch } from '../stores/store';

type Dispatch = AppDispatch;

const patchList = (dispatch: Dispatch, kind: EntityKind, recipe: (list: EntityRecord[]) => EntityRecord[] | void) =>
  dispatch(apiSlice.util.updateQueryData('listEntities', kind, (list) => recipe(list)));

export function createEntityOps(dispatch: Dispatch, agentId: () => string): EntityOps {
  return {
    async loadKind(kind, force = false) {
      await dispatch(apiSlice.endpoints.listEntities.initiate(kind, { subscribe: false, forceRefetch: force })).unwrap();
    },

    async createRecord(kind, record) {
      const { created, auditRows } = await dispatch(apiSlice.endpoints.createEntity.initiate({ kind, record, by: agentId() })).unwrap();
      patchList(dispatch, kind, (list) => void list.push(created));
      if (auditRows.length) patchList(dispatch, 'audit-trail', (list) => void list.push(...auditRows));
    },

    async updateRecord(kind, idField, id, patch, audit) {
      const { changed, auditRows } = await dispatch(
        apiSlice.endpoints.updateEntity.initiate({ kind, idField, id, patch, audit: { by: audit?.by ?? agentId(), how: audit?.how } })
      ).unwrap();
      // Nothing was updated (no record has that id): the cache must not claim a change the engine did not make.
      if (!changed) return;
      patchList(dispatch, kind, (list) => list.map((r) => (r[idField] === id ? { ...r, ...patch } : r)));
      if (auditRows.length) patchList(dispatch, 'audit-trail', (list) => void list.push(...auditRows));
    },

    async removeRecord(kind, idField, id) {
      await dispatch(apiSlice.endpoints.removeEntity.initiate({ kind, idField, id })).unwrap();
      patchList(dispatch, kind, (list) => list.filter((r) => r[idField] !== id));
    },
  };
}
