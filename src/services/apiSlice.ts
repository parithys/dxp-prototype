// The application's API layer: ONE RTK Query slice, and the only way the app reads or writes data. Endpoints are declared once, with
// their request and response types; how each is served is a single line.
//
// PROTOTYPE (today): `queryFn: mock(handler)` answers from the mock data (services/mockData.ts), after the mock engine's simulated network
// latency. BACKEND READY: replace that line with the standard form and delete the handler - the endpoint's types, tags and hook stay as
// they are:
//     listEntities: builder.query<EntityRecord[], EntityKind>({ query: (kind) => `${kind}`, ... })
//     getLead:      builder.query<Lead, string>({ query: (leadId) => `leads/${leadId}`, ... })
//     updateLead:   builder.mutation<Lead, UpdateLeadArgs>({ query: ({ leadId, patch }) => ({ url: `leads/${leadId}`, method: 'PATCH', body: patch }), ... })
//
// Caching: one entry per kind of record for lists, kept for the session (the data is the session's working set); every write to a kind
// invalidates that kind's tag, so lists and typed views of it (leads) read again. Writes made through entityOps/useEntityOps also patch
// the cached list at once, so a screen never waits for the refetch to show what was just saved.
import { createApi, fetchBaseQuery, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { appPath } from '../lib/basePath';
import { MockApiError, createEntity, createLead, getEntity, getLead, listEntities, listLeads, removeEntity, updateEntity, updateLead } from './mockData';
import type {
  CreateEntityArgs,
  CreateEntityResult,
  EntityKind,
  EntityRecord,
  GetEntityArgs,
  GetLeadsArgs,
  Lead,
  LeadPage,
  NewLead,
  NewsItem,
  RemoveEntityArgs,
  UpdateEntityArgs,
  UpdateEntityResult,
  UpdateLeadArgs,
} from './types';

/** Serves an endpoint from a prototype handler; a failure becomes the error shape a real call returns. */
const mock =
  <Arg, Result>(handler: (arg: Arg) => Promise<Result>) =>
  async (arg: Arg): Promise<{ data: Result } | { error: FetchBaseQueryError }> => {
    try {
      return { data: await handler(arg) };
    } catch (err) {
      if (err instanceof MockApiError) return { error: { status: err.status, data: { message: err.message } } };
      return { error: { status: 'CUSTOM_ERROR', error: err instanceof Error ? err.message : String(err) } };
    }
  };

/** Everything stored under one kind of record: its lists, its rows, and its typed views. */
export const entityTag = (kind: EntityKind) => ({ type: 'Entity', id: kind }) as const;

/** The mock data is the session's working set: a cached read stays for the whole session (no expiry timer; writes invalidate it). */
const SESSION_SECONDS = Infinity;

const NEWS_PATH = '/news/news.json';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Entity'],
  endpoints: (builder) => ({
    // ---- any kind of record
    listEntities: builder.query<EntityRecord[], EntityKind>({
      queryFn: mock(listEntities),
      providesTags: (_result, _error, kind) => [entityTag(kind)],
      keepUnusedDataFor: SESSION_SECONDS,
    }),
    getEntity: builder.query<EntityRecord | null, GetEntityArgs>({
      queryFn: mock(getEntity),
      providesTags: (_result, _error, { kind }) => [entityTag(kind)],
      keepUnusedDataFor: SESSION_SECONDS,
    }),
    createEntity: builder.mutation<CreateEntityResult, CreateEntityArgs>({
      queryFn: mock(createEntity),
      invalidatesTags: (result, _error, { kind }) => [entityTag(kind), ...(result?.auditRows.length ? [entityTag('audit-trail')] : [])],
    }),
    updateEntity: builder.mutation<UpdateEntityResult, UpdateEntityArgs>({
      queryFn: mock(updateEntity),
      invalidatesTags: (result, _error, { kind }) => (result?.changed ? [entityTag(kind), ...(result.auditRows.length ? [entityTag('audit-trail')] : [])] : []),
    }),
    removeEntity: builder.mutation<boolean, RemoveEntityArgs>({
      queryFn: mock(removeEntity),
      invalidatesTags: (result, _error, { kind }) => (result ? [entityTag(kind)] : []),
    }),

    // ---- leads, typed (list with filters and paging, one lead, writes)
    getLeads: builder.query<LeadPage, GetLeadsArgs | void>({
      queryFn: mock((args: GetLeadsArgs | void) => listLeads(args ?? undefined)),
      providesTags: [entityTag('leads')],
    }),
    getLead: builder.query<Lead, string>({
      queryFn: mock(getLead),
      providesTags: [entityTag('leads')],
    }),
    createLead: builder.mutation<Lead, NewLead>({
      queryFn: mock(createLead),
      invalidatesTags: [entityTag('leads')],
    }),
    updateLead: builder.mutation<Lead, UpdateLeadArgs>({
      queryFn: mock(updateLead),
      invalidatesTags: [entityTag('leads')],
    }),

    // ---- the sign-in screen's latest news (a static file synced by scripts/sync-news.mjs)
    getNews: builder.query<NewsItem[], void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const url = new URL(appPath(NEWS_PATH), globalThis.location?.origin ?? 'http://localhost').href;
        const res = await baseQuery({ url });
        if (res.error) return { error: res.error };
        const items = (res.data as { items?: NewsItem[] } | null)?.items;
        return { data: Array.isArray(items) ? items : [] };
      },
    }),
  }),
});

export const {
  useListEntitiesQuery,
  useGetEntityQuery,
  useCreateEntityMutation,
  useUpdateEntityMutation,
  useRemoveEntityMutation,
  useGetLeadsQuery,
  useGetLeadQuery,
  useCreateLeadMutation,
  useUpdateLeadMutation,
  useGetNewsQuery,
} = apiSlice;
