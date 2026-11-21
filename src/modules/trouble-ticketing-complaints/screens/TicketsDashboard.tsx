import { useRestrictedCustomers } from '../../../hooks/useRestrictedCustomers';
import { RestrictedRowsNotice } from '../../../components/patterns/RestrictedRowsNotice';
import { badgeVariantFor, isSlaStopped } from '../../../lib/statusTone';
import { TabStrip, DataTable, Badge, Button, Select, Checkbox, ErrorBanner, SearchField, Card } from 'dxp-ui';
import { useNavigate, useSearchParams } from '../../../lib/router';
import { PageHeader } from '../../../components/patterns/PageHeader';
import { useMemo, useState } from 'react';
import { notificationActions } from '../../../stores/notificationSlice';
import { evaluateRule } from '../../../engines/ruleEngine';
import { downloadCsv } from '../../../engines/csvExport';
import { TicketCreationModal } from '../../../components/patterns/TicketCreationModal';
import type { NewTicketValue } from '../../../components/patterns/TicketCreationModal';
import { TICKET_STATUSES, buildNewTicketRecord } from '../../../data/reference/ticketReferenceData';
import { useTicketSlaEscalationSweep } from '../slaEscalationSweep';
import { useAction } from '../../../stores/hooks';
import { currentAgentId } from '../../../stores/currentAgent';
import { useEntityError, useEntityOps, useEntityRecords, useKindPending } from '../../../services/entityHooks';

const CURRENT_AGENT = 'Current Agent';

interface Activity {
  type: 'Manual' | 'Auto';
  description: string;
  createdAt: string;
  createdBy: string;
  open: boolean;
}
interface Ticket {
  ticketId: string;
  customerId: string;
  status: string;
  category: string;
  actualIssue?: string;
  queue: string;
  priority: string;
  assignedTo?: string | null;
  assignedAt?: string | null;
  slaDueAt?: string;
  escalations?: { escalatedBy: string }[];
  activities?: Activity[];
  closedAt?: string | null;
}

function ragVariant(ticket: Ticket): 'success' | 'warning' | 'danger' | 'filled-neutral' {
  const rule = evaluateRule('BR-349', { slaDueAt: ticket.slaDueAt, status: ticket.status });
  if (!ticket.slaDueAt || isSlaStopped(ticket.status)) return 'filled-neutral';
  if (!rule.pass) return 'danger';
  return rule.message?.includes('Amber') ? 'warning' : 'success';
}

// SCR-211: Tickets Dashboard. Extended per the Trouble Ticket BRSD gap
// analysis (2026-09-11) to close MPRA_001_VEW-01/02/03/06 (list filters,
// Excel export, My/All Trouble Tickets views, RAG status indicator) and
// ESC-09 ("escalated to me" filter) - "My Team's Trouble Tickets" is not
// modelled since no team-roster entity exists anywhere in this app to
// resolve it from; only the two views this schema can actually support
// (My / All) are built, rather than a fabricated team grouping.
interface TicketsDashboardProps {
  /** False when embedded in a parent that already provides padding
   * (SupportWorkspace's Tabs) - mirrors OrderApprovalQueue/MySalesOrders'
   * own `padded` prop convention. */
  /** False when embedded in a parent that already provides padding
   * (SupportWorkspace's Tabs) - mirrors OrderApprovalQueue/MySalesOrders'
   * own `padded` prop convention. */
  padded?: boolean;
}

export function TicketsDashboard({ padded = true }: TicketsDashboardProps) {
  const allTickets = (useEntityRecords('trouble-tickets') ?? []) as unknown as Ticket[];
  // Tickets of a protected-segment customer this role may not see are left out (and counted), never drawn; nothing is listed until customers are known.
  const guard = useRestrictedCustomers();
  const { visible: tickets, hiddenCount } = guard.filter(allTickets, (t) => t.customerId);
  const loading = useKindPending('trouble-tickets'); // true until the list has arrived, so the table never flashes "empty" first
  const loadError = useEntityError('trouble-tickets');
  const createRecord = useEntityOps().createRecord;
  const updateRecord = useEntityOps().updateRecord;
  const pushToast = useAction(notificationActions.pushToast);
  // Opened from a customer (Customer 360 actions): the creation form is already open for that customer.
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(params.get('create') === '1');
  const createForCustomer = params.get('customerId') ?? undefined;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [queueFilter, setQueueFilter] = useState('');
  const [view, setView] = useState<'all' | 'mine' | 'escalated'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  useTicketSlaEscalationSweep();

  const counts = tickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (view === 'mine' && t.assignedTo !== CURRENT_AGENT) return false;
      if (view === 'escalated' && t.status !== 'Escalate') return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (queueFilter && t.queue !== queueFilter) return false;
      if (q && !(t.ticketId.toLowerCase().includes(q) || t.customerId.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || (t.actualIssue ?? '').toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [tickets, search, statusFilter, priorityFilter, queueFilter, view]);

  // Drops selections that scrolled out of the current filter/search rather
  // than carrying them along invisibly - there's no existing selection
  // precedent anywhere else in this codebase to follow here (research
  // confirmed this is the first row-selection UI in the app).
  const filteredIds = filtered.map((t) => t.ticketId).join(',');
  const [prevFilteredIds, setPrevFilteredIds] = useState(filteredIds);
  if (prevFilteredIds !== filteredIds) {
    setPrevFilteredIds(filteredIds);
    const visible = new Set(filteredIds ? filteredIds.split(',') : []);
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }

  const toggleSelected = (ticketId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(ticketId);
      else next.delete(ticketId);
      return next;
    });
  };

  const addBulkActivity = (ticket: Ticket, description: string): Activity[] => [
    ...(ticket.activities ?? []),
    { type: 'Auto', description, createdAt: new Date().toISOString(), createdBy: CURRENT_AGENT, open: false },
  ];

  // Reuses assignToMe's exact rule from TicketDetail.tsx (unassigned + not
  // terminal -> assign to CURRENT_AGENT, Not Solved -> Assigned) and its
  // ungated-ness - single-ticket assign has no capability gate today, so
  // bulk stays consistent rather than introducing a new, unevidenced one.
  const bulkAssign = async () => {
    const targets = filtered.filter((t) => selectedIds.has(t.ticketId));
    const terminal = (t: Ticket) => isSlaStopped(t.status);
    const eligible = targets.filter((t) => !t.assignedTo && !terminal(t));
    await Promise.all(
      eligible.map((t) =>
        updateRecord('trouble-tickets', 'ticketId', t.ticketId, {
          assignedTo: CURRENT_AGENT,
          assignedAt: new Date().toISOString(),
          status: t.status === 'Not Solved' ? 'Assigned' : t.status,
          activities: addBulkActivity(t, `Ticket assigned to ${CURRENT_AGENT} (bulk action).`),
        })
      )
    );
    const skipped = targets.length - eligible.length;
    pushToast('success', `Assigned ${eligible.length} of ${targets.length} selected ticket(s)${skipped ? ` (${skipped} skipped - already assigned or terminal)` : ''}.`);
  };

  // Reuses closeTicket's exact precondition (status === 'Completed' only)
  // for the same consistency reason as bulkAssign above.
  const bulkClose = async () => {
    const targets = filtered.filter((t) => selectedIds.has(t.ticketId));
    const eligible = targets.filter((t) => t.status === 'Completed');
    const closedAt = new Date().toISOString();
    await Promise.all(
      eligible.map((t) =>
        updateRecord('trouble-tickets', 'ticketId', t.ticketId, {
          status: 'Closed',
          closedAt,
          activities: addBulkActivity(t, 'Ticket closed (bulk action) - all activities closed.').map((a) => ({ ...a, open: false })),
        })
      )
    );
    const skipped = targets.length - eligible.length;
    pushToast('success', `Closed ${eligible.length} of ${targets.length} selected ticket(s)${skipped ? ` (${skipped} skipped - not yet Completed)` : ''}.`);
  };

  const createTicket = async (value: NewTicketValue) => {
    const ticketId = `TT-${Date.now().toString().slice(-6)}`;
    await createRecord('trouble-tickets', buildNewTicketRecord({ ticketId, ...value, createdBy: currentAgentId() }));
    pushToast('success', `Ticket ${ticketId} submitted to ${value.queue}.`);
    setModalOpen(false);
  };

  const exportList = () => {
    downloadCsv(
      `trouble-tickets-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((t) => ({
        'Ticket #': t.ticketId,
        Customer: t.customerId,
        Category: t.category,
        Queue: t.queue,
        Priority: t.priority,
        Status: t.status,
        'Assigned To': t.assignedTo ?? '',
      }))
    );
  };

  return (
    <div className={padded ? 'p-8' : ''}>
      <PageHeader
        bleed={padded}
        level={padded ? 1 : 2}
        title="Tickets Dashboard"
        description="Trouble tickets and complaints across all queues."
        actions={
          <Button onClick={() => navigate('/customer-search', { state: { newTicket: true } })}>
            New Ticket
          </Button>
        }
      />

      <div className="pair-grid sm:grid-cols-4 mb-6">
        {TICKET_STATUSES.map((status) => (
          <Card key={status} className="p-4">
            <div className="caption-muted">{status}</div>
            <div className="text-[length:var(--fs-h3)] text-fg font-medium">{counts[status] ?? 0}</div>
          </Card>
        ))}
      </div>

      <TabStrip
        label="Ticket Views"
        items={[
          { key: 'all', label: 'All Tickets' },
          { key: 'mine', label: 'My Tickets' },
          { key: 'escalated', label: 'Escalated to Me' },
        ]}
        active={view}
        onChange={setView}
      />
      <div className="wrap-loose items-end mb-4">
        <div className="ml-auto wrap-loose gap-2 items-end">
          <SearchField
            aria-label="Search ticket #, customer, category, issue"
            placeholder="Search ticket #, customer, category, issue…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            wrapperClassName="w-80"
          />
          <div className="w-40">
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="Status"
              options={TICKET_STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </div>
          <Select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            placeholder="Priority"
            options={['1-ASAP', '2-High', '3-Medium', '4-Low'].map((p) => ({ value: p, label: p }))}
          />
          <Select
            aria-label="Filter by queue"
            value={queueFilter}
            onChange={(e) => setQueueFilter(e.target.value)}
            placeholder="Queue"
            options={['FL Agents', 'Complaints Team'].map((q) => ({ value: q, label: q }))}
          />
          {(search || statusFilter || priorityFilter || queueFilter) && (
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setPriorityFilter('');
                setQueueFilter('');
              }}
            >
              Reset filters
            </Button>
          )}
          <Button variant="secondary" onClick={exportList} disabled={filtered.length === 0}>
            Export (CSV)
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <Card className="row mb-3 p-3">
          <span className="body-text">{selectedIds.size} selected</span>
          <Button variant="secondary" size="sm" onClick={bulkAssign}>Bulk Assign to Me</Button>
          <Button variant="secondary" size="sm" onClick={bulkClose}>Bulk Close</Button>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
        </Card>
      )}

      <ErrorBanner message={loadError} />
      <RestrictedRowsNotice count={hiddenCount} />
      <DataTable<Ticket>
        columns={[
          {
            key: 'select',
            header: '',
            sortable: false,
            cellClassName: '!pr-0 w-10',
            render: (r) => (
              <Checkbox
                className="align-[1px]" // sits where the old inline wrapper did: a button's baseline is 1px lower in a table cell
                aria-label={`Select ticket ${r.ticketId}`}
                checked={selectedIds.has(r.ticketId)}
                onCheckedChange={(checked) => toggleSelected(r.ticketId, (checked === true))}
                onClick={(e) => e.stopPropagation()}
              />
            ),
          },
          {
            key: 'ticketId',
            header: 'Ticket #',
            cellClassName: '!pl-1', // sits right after the checkbox column
            linkTo: (r) => `/trouble-ticketing-complaints/ticket-detail-screen-public-notes-bell-icon-notifications?id=${r.ticketId}`,
          },
          { key: 'customerId', header: 'Customer', linkTo: (r) => (r.customerId ? `/customer/${r.customerId}` : undefined) },
          { key: 'category', header: 'Category' },
          { key: 'queue', header: 'Queue' },
          { key: 'priority', header: 'Priority' },
          { key: 'assignedTo', header: 'Assigned To', render: (r) => r.assignedTo ?? '-' },
          { key: 'status', header: 'Status', render: (r) => <Badge variant={badgeVariantFor(r.status)}>{r.status}</Badge> },
          {
            key: 'rag',
            header: 'SLA',
            render: (r) => <Badge variant={ragVariant(r)}>{ragVariant(r) === 'danger' ? 'Red' : ragVariant(r) === 'warning' ? 'Amber' : ragVariant(r) === 'success' ? 'Green' : '-'}</Badge>,
            sortValue: (r) => ({ danger: 0, warning: 1, success: 2, 'filled-neutral': 3 }[ragVariant(r)]),
          },
        ]}
        rows={filtered}
        rowKey={(r) => r.ticketId}
        emptyMessage="No trouble tickets match the current filters."
        loading={loading || !guard.ready}
      />

      <TicketCreationModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={createTicket} initialCustomerId={createForCustomer} />
    </div>
  );
}
