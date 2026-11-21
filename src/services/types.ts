// The request and response shapes of the API layer. One place, so the prototype handlers (mockData.ts) and the real backend share them:
// swapping an endpoint from `queryFn` to `query` changes how it is fetched, never what it returns.
export type { Lead } from '../modules/lead-management/types';
import type { Lead } from '../modules/lead-management/types';

/** Filters and paging for the lead list. Omit `page` to receive every match. */
export interface GetLeadsArgs {
  /** Exact lead status, e.g. 'New' or 'Contacted'. */
  status?: string;
  /** Matches the lead id, the contact name, the mobile number or the service needed (case-insensitive). */
  search?: string;
  /** 1-based. Used together with `pageSize`. */
  page?: number;
  pageSize?: number;
}

export interface LeadPage {
  items: Lead[];
  /** Matches before paging. */
  total: number;
  /** The page returned (1 when the whole list was asked for). */
  page: number;
  /** Rows per page; equals `total` when the whole list was asked for. */
  pageSize: number;
}

export type NewLead = Lead;

export interface UpdateLeadArgs {
  leadId: string;
  patch: Partial<Omit<Lead, 'leadId'>>;
}

// ---------------------------------------------------------------- entities (every mock-data kind)
import type { EntityKind } from '../engines/mockDataEngine';
export type { EntityKind };

/** A record of any kind, as the mock data holds it. Screens narrow it to their own type where they read it. */
export type EntityRecord = Record<string, unknown>;

export interface GetEntityArgs {
  kind: EntityKind;
  id: string;
  /** The record's id field; guessed from the first key ending in "Id" when omitted. */
  idField?: string;
}

export interface CreateEntityArgs {
  kind: EntityKind;
  record: EntityRecord;
  /** The agent the write is stamped to (audit rows). */
  by: string;
}

export interface CreateEntityResult {
  created: EntityRecord;
  /** Audit-trail rows the write produced (an ID document added to a customer is a change to their information). */
  auditRows: EntityRecord[];
}

export interface UpdateEntityArgs {
  kind: EntityKind;
  idField: string;
  id: string;
  patch: EntityRecord;
  /** Who changed it and how, for the audit trail of a customer's information. */
  audit: { by: string; how?: string };
}

export interface UpdateEntityResult {
  /** False when no record has that id: nothing changed. */
  changed: boolean;
  auditRows: EntityRecord[];
}

export interface RemoveEntityArgs {
  kind: EntityKind;
  idField: string;
  id: string;
}

/** What the rest of the app writes and reads records with - the same calls the entity store offered, now served by the API layer. */
export interface EntityOps {
  /** Loads a list once; `force` reads it again (a screen that must show what other screens just wrote). */
  loadKind(kind: EntityKind, force?: boolean): Promise<void>;
  createRecord(kind: EntityKind, record: EntityRecord): Promise<void>;
  /** A write to a customer's information (customer, contact, address, ID document) is also written to the audit trail: what changed, old and new value, by whom and `how`. */
  updateRecord(kind: EntityKind, idField: string, id: string, patch: EntityRecord, audit?: { how?: string; by?: string }): Promise<void>;
  removeRecord(kind: EntityKind, idField: string, id: string): Promise<void>;
}

// ---------------------------------------------------------------- sign-in news
export interface NewsItem {
  id: number;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  summary: string;
  /** The article's own page on vodafone.qa. */
  url: string;
  /** The banner, served from this app (/news/...). */
  image: string;
}
