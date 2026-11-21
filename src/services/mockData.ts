// The prototype's API back end: handlers that answer the API layer's requests from the app's mock data (public/mock-data through
// engines/mockDataEngine) - the one source of truth for sample records, so nothing is duplicated here. Replaced wholesale by the real
// backend: apiSlice.ts swaps each `queryFn: mock(handler)` for a `query` and this file is deleted.
import * as mockDataEngine from '../engines/mockDataEngine';
import { customerChangeAuditRows, idDocumentAddedAuditRow } from '../engines/customerChangeAudit';
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
  RemoveEntityArgs,
  UpdateEntityArgs,
  UpdateEntityResult,
  UpdateLeadArgs,
} from './types';

// Re-exported so the application's start-up can seed the mock data without reaching past the API layer.
export { seedMockData } from '../engines/mockDataEngine';

// Every call here takes the mock data engine's own simulated network latency (a random 200-600 ms, engines/mockDataEngine.ts), so the
// loading states of every screen can be seen and checked; the API layer adds none on top.

/** A failure the real API would report with an HTTP status. */
export class MockApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// The engine holds untyped JSON rows; this is the one place they are read as leads.
const asLead = (row: Record<string, unknown>): Lead => row as unknown as Lead;
const toRow = (lead: Partial<Lead>): Record<string, unknown> => ({ ...lead });

export async function listLeads(args: GetLeadsArgs = {}): Promise<LeadPage> {
  const all = await mockDataEngine.list<Lead>('leads');
  const needle = args.search?.trim().toLowerCase();
  const matches = all.filter(
    (l) =>
      (!args.status || l.status === args.status) &&
      (!needle || [l.leadId, l.contactName, l.mobileNumber, l.serviceNeeded].some((v) => v?.toLowerCase().includes(needle)))
  );
  if (args.page === undefined || args.pageSize === undefined) return { items: matches, total: matches.length, page: 1, pageSize: matches.length };
  const start = (Math.max(1, args.page) - 1) * args.pageSize;
  return { items: matches.slice(start, start + args.pageSize), total: matches.length, page: args.page, pageSize: args.pageSize };
}

export async function getLead(leadId: string): Promise<Lead> {
  const lead = await mockDataEngine.get<Lead>('leads', leadId, 'leadId');
  if (!lead) throw new MockApiError(404, `No lead ${leadId}`);
  return lead;
}

export async function createLead(lead: NewLead): Promise<Lead> {
  return asLead(await mockDataEngine.create('leads', toRow(lead)));
}

export async function updateLead({ leadId, patch }: UpdateLeadArgs): Promise<Lead> {
  const updated = await mockDataEngine.update('leads', leadId, toRow(patch), 'leadId');
  if (!updated) throw new MockApiError(404, `No lead ${leadId}`);
  return asLead(updated);
}

// ---------------------------------------------------------------- any kind of record
export const listEntities = (kind: EntityKind): Promise<EntityRecord[]> => mockDataEngine.list(kind);

export async function getEntity({ kind, id, idField }: GetEntityArgs): Promise<EntityRecord | null> {
  return (await mockDataEngine.get<EntityRecord>(kind, id, idField)) ?? null;
}

export async function createEntity({ kind, record, by }: CreateEntityArgs): Promise<CreateEntityResult> {
  const created = await mockDataEngine.create(kind, record);
  // An ID document added to a customer is a change to their information: it goes to the audit trail.
  const added = kind === 'identity-documents' ? idDocumentAddedAuditRow(record, by, 'Added from MOI / ID capture') : undefined;
  if (added) await mockDataEngine.create('audit-trail', added);
  return { created, auditRows: added ? [added] : [] };
}

export async function updateEntity({ kind, idField, id, patch, audit }: UpdateEntityArgs): Promise<UpdateEntityResult> {
  const before = await mockDataEngine.get<EntityRecord>(kind, id, idField);
  const updated = await mockDataEngine.update(kind, id, patch, idField);
  // Nothing was updated (no record has that id): the caller must not claim a change the engine did not make.
  if (updated === undefined) return { changed: false, auditRows: [] };
  const auditRows = before ? customerChangeAuditRows({ kind, before, patch, by: audit.by, how: audit.how ?? 'Edited by agent' }) : [];
  for (const row of auditRows) await mockDataEngine.create('audit-trail', row);
  return { changed: true, auditRows };
}

export async function removeEntity({ kind, idField, id }: RemoveEntityArgs): Promise<boolean> {
  return mockDataEngine.remove(kind, id, idField);
}
