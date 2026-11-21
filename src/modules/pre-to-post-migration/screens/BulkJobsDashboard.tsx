import { badgeVariantFor } from '../../../lib/statusTone';
import { formatDateTime } from '../../../lib/format';
import { DataTable, Badge, ErrorBanner } from 'dxp-ui';
import { PageHeader } from '../../../components/patterns/PageHeader';
import { useEntityError, useEntityRecords, useKindPending } from '../../../services/entityHooks';

interface BulkJob {
  bulkOrderId: string;
  jobType?: string;
  method?: string;
  msisdn?: string;
  orderIdReference?: string;
  promotionId?: string;
  billLimit?: number;
  overallStatus: string;
  updatedAt?: string;
}

// SCR-183: Bulk Jobs / Bulk Processing screen (TM Bulk Batch List Applet) -
// backend orchestration-status screen shared with the Enterprise/IoT bulk
// adjustment screens (Pattern 17); BR-273: Pre2Post migration orders progress
// asynchronously to Complete via this job queue (job type "PreToPost").
export function BulkJobsDashboard() {
  const jobs = (useEntityRecords('bulk-activation-orders') ?? []) as unknown as BulkJob[];
  const loading = useKindPending('bulk-activation-orders'); // true until the list has arrived, so the table never flashes "empty" first
  const loadError = useEntityError('bulk-activation-orders');

  return (
    <div className="p-8">
      <PageHeader title={<>Bulk Jobs</>} description={<>TM Bulk Batch List Applet - backend bulk processing job status.</>} />
      <ErrorBanner message={loadError} />
      <DataTable<BulkJob>
        columns={[
          { key: 'bulkOrderId', header: 'Job #' },
          { key: 'jobType', header: 'Job Type', render: (r) => r.jobType ?? r.method ?? '-' },
          { key: 'msisdn', header: 'MSISDN / Reference', render: (r) => r.msisdn ?? r.orderIdReference ?? '-' },
          { key: 'promotionId', header: 'Promotion' },
          { key: 'overallStatus', header: 'Status', render: (r) => <Badge variant={badgeVariantFor(r.overallStatus)}>{r.overallStatus}</Badge> },
          { key: 'updatedAt', header: 'Updated', render: (r) => (r.updatedAt ? formatDateTime(r.updatedAt) : '-') },
        ]}
        rows={jobs}
        rowKey={(r) => r.bulkOrderId}
        emptyMessage="No bulk jobs."
        loading={loading}
      />
    </div>
  );
}
