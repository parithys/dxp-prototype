import { EntityMissing } from '../../../components/patterns/EntityMissing';
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from '../../../lib/router';
import { DataTable, Badge, Button, ErrorBanner, Select, Textarea } from 'dxp-ui';
import { Drawer } from '../../../capabilities';
import { useSubmitGuard } from '../../../hooks/useSubmit';
import { notificationActions } from '../../../stores/notificationSlice';
import { PageHeader } from '../../../components/patterns/PageHeader';

import { ORDER_AWAITING_DECISION, approvalBlockMessage, isSimSwapAwaitingDecision, simSwapDecisionAuthority } from '../../../engines/approvalAuthority';
import { useAction, useAppSelector } from '../../../stores/hooks';
import { useEntityError, useEntityOps, useEntityRecords, useKindPending } from '../../../services/entityHooks';
import { listEntities } from '../../../services/entityOps';

interface SimSwapOrder {
  simSwapOrderId: string;
  msisdn: string;
  newSimSerialNumber?: string;
  simSwapReason?: string;
  chargeStatus?: string;
  comments?: string;
  status: string;
}
interface RejectReason {
  reasonCode: string;
  reasonLabel: string;
}

// SCR-196: SIM Swap Queue / Order tasks tab - UJ-091: "Open SIM Swap Queue ->
// Order tasks tab -> select order -> Assign to Me -> open via Order ID
// hyperlink -> Approve or Reject." Only one evidenced screenId covers both
// the queue and its detail/approval facet, so this single component switches
// on the `id` query param rather than inventing a separate detail screenId.
export function SimSwapQueueScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get('id');
  const orders = (useEntityRecords('sim-swap-orders') ?? []) as unknown as SimSwapOrder[];
  const loading = useKindPending('sim-swap-orders'); // true until the list has arrived, so the table never flashes "empty" first
  const loadError = useEntityError('sim-swap-orders');
  const updateRecord = useEntityOps().updateRecord;
  const { guard } = useSubmitGuard();
  const pushToast = useAction(notificationActions.pushToast);
  const activePersonaId = useAppSelector((s) => s.persona.activePersonaId);

  const [reasons, setReasons] = useState<RejectReason[]>([]);
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null);
  const [approveComment, setApproveComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');

  useEffect(() => {
    listEntities<RejectReason>('reject-reasons').then(setReasons);
  }, []);

  if (!orderId) {
    const pending = orders.filter((o) => isSimSwapAwaitingDecision(o.status));
    const canWorkQueue = simSwapDecisionAuthority({ personaId: activePersonaId, status: ORDER_AWAITING_DECISION }).mayDecide;
    return (
      <div className="p-8">
        <PageHeader title={<>SIM Swap Queue</>} description={<>Order tasks tab - tasks awaiting SIM Swap approval.</>} />
        <ErrorBanner message={loadError} />
        <DataTable<SimSwapOrder>
          columns={[
            { key: 'simSwapOrderId', header: 'Order #' },
            { key: 'msisdn', header: 'MSISDN' },
            { key: 'simSwapReason', header: 'Reason' },
            { key: 'status', header: 'Status', render: (r) => <Badge variant="warning">{r.status}</Badge> },
            {
              key: 'action',
              header: '',
              render: (r) => (
                <Button variant="secondary" size="sm" onClick={() => navigate(`/sim-number-management/sim-swap-queue-order-tasks-tab?id=${r.simSwapOrderId}`)}>
                  {canWorkQueue ? 'Assign to Me' : 'View'}
                </Button>
              ),
            },
          ]}
          rows={pending}
          rowKey={(r) => r.simSwapOrderId}
          emptyMessage="No SIM Swap requests awaiting approval."
          loading={loading}
        />
      </div>
    );
  }

  const order = orders.find((o) => o.simSwapOrderId === orderId);
  if (!order) {
    return <EntityMissing what="SIM swap order" loading={Boolean(loading)} backTo="/sim-number-management/sim-swap-queue-order-tasks-tab" backLabel="Back to the SIM swap queue" />;
  }

  const authority = simSwapDecisionAuthority({ personaId: activePersonaId, status: order.status });
  const blockMessage = approvalBlockMessage('SIM swap', authority);

  // The buttons are only offered when the SIM swap may be decided; the handlers check the same authority.
  const approve = () =>
    guard(async () => {
      if (!authority.mayDecide) return;
      await updateRecord('sim-swap-orders', 'simSwapOrderId', order.simSwapOrderId, {
        status: 'Approved/Completed',
        approveComment,
      });
      pushToast('success', `SIM Swap ${order.simSwapOrderId} approved - order completed.`);
      navigate('/sim-number-management/sim-swap-queue-order-tasks-tab');
    });

  const reject = () =>
    guard(async () => {
      if (!authority.mayDecide) return;
      const reasonLabel = reasons.find((r) => r.reasonCode === rejectReason)?.reasonLabel ?? rejectReason;
      await updateRecord('sim-swap-orders', 'simSwapOrderId', order.simSwapOrderId, {
        status: 'Cancelled',
        rejectReasonCode: rejectReason,
        rejectComment,
      });
      pushToast('warning', `SIM Swap ${order.simSwapOrderId} dropped as cancelled - ${reasonLabel}.`);
      navigate('/sim-number-management/sim-swap-queue-order-tasks-tab');
    });

  return (
    <div className="p-8 w-full">
      <PageHeader
        title={<>SIM Swap {order.simSwapOrderId}</>}
        badges={<><Badge variant="outlined-red">{order.status}</Badge></>}
        description={<>MSISDN: {order.msisdn}</>}
      />

      <dl className="pair-grid text-[length:var(--fs-body)] card p-4 mb-6">
        <div>
          <dt className="text-[length:var(--fs-caption)] text-fg">New SIM Serial</dt>
          <dd className="text-fg">{order.newSimSerialNumber ?? '-'}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--fs-caption)] text-fg">Reason</dt>
          <dd className="text-fg">{order.simSwapReason ?? '-'}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--fs-caption)] text-fg">Charge</dt>
          <dd className="text-fg">{order.chargeStatus ?? '-'}</dd>
        </div>
        <div>
          <dt className="text-[length:var(--fs-caption)] text-fg">Comments</dt>
          <dd className="text-fg">{order.comments ?? '-'}</dd>
        </div>
      </dl>

      {blockMessage && (
        <div className="mb-4 notice-warning cell-body text-[var(--warn-text)]">{blockMessage}</div>
      )}
      {/* Decision buttons only while the swap is awaiting a decision and only for the roles that work this queue. */}
      {authority.mayDecide && (
        <div className="wrap-loose gap-2">
          <Button onClick={() => setModal('approve')}>
            Approve
          </Button>
          <Button variant="secondary" className="!text-danger !border-danger" onClick={() => setModal('reject')}>
            Reject
          </Button>
        </div>
      )}

      <Drawer open={modal === 'approve'} onClose={() => setModal(null)} title="Approve SIM Swap">
        <Textarea label="Comments" value={approveComment} onChange={(e) => setApproveComment(e.target.value)} />
        <div className="actions-end mt-6">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
          <Button onClick={approve}>Approve SIM Swap</Button>
        </div>
      </Drawer>

      <Drawer open={modal === 'reject'} onClose={() => setModal(null)} title="Reject Task">
        <div className="space-y-3">
          <Select
            label="Rejection Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Select a reason"
            options={reasons.map((r) => ({ value: r.reasonCode, label: r.reasonLabel }))}
          />
          <Textarea label="Comments" value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} />
        </div>
        <div className="actions-end mt-6">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="destructive" onClick={reject} disabled={!rejectReason}>Drop Order</Button>
        </div>
      </Drawer>
    </div>
  );
}
