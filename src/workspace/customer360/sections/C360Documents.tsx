import { useMemo, useState } from 'react';
import { Icon, maskAllButLast4, TabStrip } from 'dxp-ui';
import type { Customer360Data } from '../../../engines/customer360Engine';
import type { CustomerService } from '../../../engines/customerServicesEngine';
import { customerDocumentRows, filterDocuments, type CustomerDocumentRow, type DocumentFilter } from '../../../engines/customerDocuments';
import { DetailRows, GridTable, Panel, Pill, TabPage, ViewPill } from './C360Kit';
import { IC, fmtDate } from './c360KitModel';

const dash = (v: string | undefined | null) => (v === undefined || v === null || v === '' ? '-' : v);

/** Active is green, Archived grey; a record with no status shows "-" (unknown), not a status it was never given. */
function StatusCell({ status }: { status: CustomerDocumentRow['status'] }) {
  return status ? <Pill tone={status === 'Active' ? 'green' : 'grey'}>{status}</Pill> : <span className="text-muted">-</span>;
}

/**
 * The Customer 360 "Documents" tab: the identity documents and Customer Acquisition Forms on file for the customer, with a filter for All / Active /
 * Archived. Archived documents stay viewable - an agent opens any row to see its details. A number is masked in the table and shown in full once the row
 * is opened.
 */
export function C360Documents({ data }: { data: Customer360Data; services: CustomerService[]; goToTab?: (key: string) => void }) {
  const [filter, setFilter] = useState<DocumentFilter>('all');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const all = useMemo(() => customerDocumentRows(data.identityDocuments, data.cafForms), [data.identityDocuments, data.cafForms]);
  const rows = filterDocuments(all, filter);
  const selected = rows.find((r) => r.id === selectedId) ?? undefined;
  const counts = { all: all.length, active: filterDocuments(all, 'active').length, archived: filterDocuments(all, 'archived').length };

  return (
    <TabPage icon={IC.file} tone="blue" title="Documents" subtitle="Identity documents and signed forms on file, including archived ones">
      <TabStrip
        variant="filter"
        label="Document Status"
        active={filter}
        onChange={(f) => {
          setFilter(f);
          setSelectedId(undefined);
        }}
        items={[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'active', label: 'Active', count: counts.active },
          { key: 'archived', label: 'Archived', count: counts.archived },
        ]}
      />
      <div className="fields @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
        <section className="card overflow-hidden">
          <GridTable
            rows={rows}
            rowKey={(r) => r.id}
            selectedKey={selected?.id}
            onSelect={(r) => setSelectedId(r.id)}
            empty={filter === 'archived' ? 'No archived documents on file.' : filter === 'active' ? 'No active documents on file.' : 'No documents on file.'}
            cols={[
              { key: 'n', header: '#', render: (_r, i) => i + 1 },
              { key: 'doc', header: 'Document', render: (r) => r.title },
              { key: 'kind', header: 'Type', render: (r) => r.kind },
              { key: 'ref', header: 'Number / Reference', render: (r) => <span className="whitespace-nowrap">{r.kind === 'Identity Document' ? maskAllButLast4(r.reference) : r.reference}</span> },
              { key: 'status', header: 'Status', render: (r) => <StatusCell status={r.status} /> },
              { key: 'up', header: 'Uploaded', render: (r) => <span className="whitespace-nowrap">{dash(fmtDate(r.uploadedAt))}</span> },
              {
                key: 'actions',
                header: 'Actions',
                render: (r) => (
                  <span onClick={(e) => e.stopPropagation()}>
                    <ViewPill onClick={() => setSelectedId(r.id)} />
                  </span>
                ),
              },
            ]}
          />
        </section>

        <Panel icon={IC.file} title="Document Details" action={selected ? <StatusCell status={selected.status} /> : undefined}>
          {selected ? (
            <div className="space-y-3">
              <div className="row min-w-0">
                <span className="icon-box-accent">
                  <Icon path={IC.file} className="size-6 " />
                </span>
                <div className="min-w-0">
                  <div className="title title-md break-words">{selected.title}</div>
                  <div className="caption-secondary break-words">{selected.kind}</div>
                </div>
              </div>
              {selected.status === 'Archived' && <p className="notice-info">This document is archived. It is kept on file for reference.</p>}
              <DetailRows rows={selected.details.map((d) => ({ label: d.label, value: /^\d{4}-\d{2}-\d{2}/.test(d.value) ? dash(fmtDate(d.value)) : d.value }))} />
            </div>
          ) : (
            <p className="empty-note">Select a document to see its details.</p>
          )}
        </Panel>
      </div>
    </TabPage>
  );
}
