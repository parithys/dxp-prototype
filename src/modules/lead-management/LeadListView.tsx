import { badgeVariantFor } from '../../lib/statusTone';
import { useNavigate } from '../../lib/router';
import { useGetLeadsQuery } from '../../services/apiSlice';
import { Badge, Button, DataTable, ErrorBanner, PageHeader } from 'dxp-ui';
import type { Lead } from './types';

export type LeadScope = 'my' | 'created' | 'team' | 'all' | 'contact';

const SCOPE_TITLES: Record<LeadScope, string> = {
  my: 'My Leads',
  created: 'My Created Leads',
  team: "Manage Leads - My Team's Leads",
  all: 'All Leads Across Org',
  contact: 'Contact Record - Leads Sub-Tab',
};

// Pattern 14: Lead List + Owner/Status Management - a family of scoped list
// views (My Leads / My Created Leads / Team Leads / All Leads / Contact-scoped)
// over the same Lead entity, sharing a grid shape (SCR-141–150).
export function LeadListView({ scope }: { scope: LeadScope }) {
  const navigate = useNavigate();
  // The leads come from the API layer (RTK Query): cached, with its own loading and error state.
  const { data, isLoading, isError, isFetching, refetch } = useGetLeadsQuery();
  const leads = data?.items ?? [];
  const loadError = isError ? 'We could not load the leads just now. Please try again.' : undefined;

  const filtered = leads.filter((l) => {
    // Lead ownerIds in the seed data are agent codes (USR-xxxx), not role ids,
    // so there is nothing here to compare the active role against - the "my"
    // scope is presentational in this seed set. Written plainly rather than as
    // `l.ownerId === activePersonaId || true`, which read like a real filter
    // while always being true.
    if (scope === 'my') return true;
    if (scope === 'created') return l.createdVia?.includes('Tablet') ?? true;
    return true; // team/all/contact scopes: no further evidenced filter distinct from "all" in this thin seed set
  });

  return (
    <div className="p-8">
      <PageHeader title={<>{SCOPE_TITLES[scope]}</>} description={<>{filtered.length} lead(s).</>} />
      <ErrorBanner message={loadError} />
      {isError && (
        <div className="mb-4">
          <Button variant="secondary" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            Try again
          </Button>
        </div>
      )}
      <DataTable<Lead>
        columns={[
          { key: 'leadId', header: 'Lead #' },
          { key: 'serviceNeeded', header: 'Service Needed' },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <Badge variant={badgeVariantFor(row.status)}>{row.status}</Badge>,
          },
          { key: 'ownerId', header: 'Owner' },
          { key: 'callbackDate', header: 'Callback Date' },
        ]}
        rows={filtered}
        rowKey={(row) => row.leadId}
        onRowClick={(row) => navigate(`/lead-management/lead-details-view?id=${row.leadId}`)}
        emptyMessage="No leads in this view."
        loading={isLoading}
      />
    </div>
  );
}
