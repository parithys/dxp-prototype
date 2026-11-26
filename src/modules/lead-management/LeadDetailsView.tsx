import { useEffect, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { useSearchParams } from '../../lib/router';
import { useGetLeadQuery, useUpdateLeadMutation } from '../../services/apiSlice';
import type { UpdateLeadArgs } from '../../services/types';
import { notificationActions } from '../../stores/notificationSlice';
import { Badge, Button, Card, DateInput, EntityMissing, Input, Select, Textarea } from 'dxp-ui';
import { Drawer } from '../../capabilities';
import { useSubmitGuard } from '../../hooks/useSubmit';
import { useAction } from '../../stores/hooks';
import { listEntities } from '../../services/entityOps';

interface RejectReason {
  reasonCode: string;
  reasonLabel: string;
}
interface Agent {
  userId: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
}

// SCR-141 Lead Details View + its four evidenced sub-actions:
// SCR-145 Reject Lead modal, SCR-146 Lead Owner reassignment picker,
// SCR-148 Description edit popup, SCR-149 CallBack Date/Time picker.
// The callback is stored as one YYYY-MM-DDTHH:mm text; the drawer edits its date and time parts separately, either of which may still be empty.
const dateOf = (callback: string) => callback.split('T')[0];
const timeOf = (callback: string) => (callback.split('T')[1] ?? '').slice(0, 5);
const joinCallback = (date: string, time: string) => (date || time ? `${date}T${time}` : '');

export function LeadDetailsView() {
  const [params] = useSearchParams();
  const leadId = params.get('id');
  // The lead comes from the API layer (RTK Query): this one lead, cached, with its own loading and error state. Never another lead -
  // acting on the wrong one (reject, reassign) is worse than an error.
  const { data: lead, isLoading, isError, error, refetch } = useGetLeadQuery(leadId ?? skipToken);
  const [updateLeadMutation] = useUpdateLeadMutation();
  const updateLead = (patch: UpdateLeadArgs['patch']) => updateLeadMutation({ leadId: lead!.leadId, patch }).unwrap();
  const pushToast = useAction(notificationActions.pushToast);
  const { guard } = useSubmitGuard();

  const [reasons, setReasons] = useState<RejectReason[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [modal, setModal] = useState<'reject' | 'reassign' | 'description' | 'callback' | null>(null);
  const [rejectCode, setRejectCode] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [callbackDraft, setCallbackDraft] = useState('');

  useEffect(() => {
    listEntities<RejectReason>('reject-reasons').then(setReasons);
    listEntities<Agent>('users-agents').then(setAgents);
  }, []);

  if (!lead) {
    // Loading, failed and not found are three different screens. A 404 from the API is "not found"; any other failure offers a retry.
    const notFound = isError && typeof error === 'object' && 'status' in error && error.status === 404;
    return <EntityMissing what="lead" loading={isLoading} error={isError && !notFound} onRetry={() => void refetch()} backTo="/leads" backLabel="Back to leads" />;
  }

  const filteredAgents = agents.filter((a) => a.lastName.toLowerCase().includes(ownerFilter.toLowerCase()));

  const submitReject = () =>
    guard(async () => {
      await updateLead({
        status: 'Rejected',
        rejectReasonCode: rejectCode,
        rejectComment,
      });
      pushToast('warning', `Lead ${lead.leadId} rejected: ${reasons.find((r) => r.reasonCode === rejectCode)?.reasonLabel ?? rejectCode}`);
      setModal(null);
    });

  const submitReassign = (agent: Agent) =>
    guard(async () => {
      await updateLead({ ownerId: agent.userId });
      pushToast('success', `Lead ${lead.leadId} reassigned to ${agent.firstName} ${agent.lastName}`);
      setModal(null);
    });

  const submitDescription = () =>
    guard(async () => {
      await updateLead({ description: descriptionDraft });
      pushToast('success', 'Description updated.');
      setModal(null);
    });

  const submitCallback = () =>
    guard(async () => {
      await updateLead({ callbackDate: callbackDraft, status: 'In Progress', subStatus: 'Call Back' });
      pushToast('success', `Callback set for ${callbackDraft} - Lead Status auto-transitioned to In Progress / Call Back.`);
      setModal(null);
    });

  return (
    <div className="p-8 w-full">
      <div className="split-pane">
        <div className="flex-1 min-w-0 space-y-6">
          <Card className="p-5">
            <div className="row mb-1">
              <h1 className="title title-xl">Lead {lead.leadId}</h1>
              <Badge variant={lead.status === 'Rejected' ? 'danger' : 'outlined-red'}>{lead.status}</Badge>
            </div>
            <p className="text-fg-2">{lead.serviceNeeded} - owned by {lead.ownerId}</p>
          </Card>

          <dl className="pair-grid text-[length:var(--fs-body)] card p-5">
            <div>
              <dt className="text-[length:var(--fs-caption)] text-fg">Sub Status</dt>
              <dd className="text-fg">{lead.subStatus ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-[length:var(--fs-caption)] text-fg">Callback Date</dt>
              <dd className="text-fg">{lead.callbackDate ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-[length:var(--fs-caption)] text-fg">Fixed Pre-Sales</dt>
              <dd className="text-fg">{lead.fixedPreSalesRequested ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-[length:var(--fs-caption)] text-fg">Created Via</dt>
              <dd className="text-fg">{lead.createdVia}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[length:var(--fs-caption)] text-fg">Description</dt>
              <dd className="text-fg">{lead.description ?? '-'}</dd>
            </div>
          </dl>
        </div>

        <div className="split-pane-side">
          <Card className="p-5">
            <h2 className="title title-md mb-3">Actions</h2>
            <div className="stack gap-2">
              <Button
                className="w-full justify-center"
                onClick={() => { setDescriptionDraft(lead.description ?? ''); setModal('description'); }}
              >
                Edit Description
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center"
                onClick={() => { setCallbackDraft(lead.callbackDate ?? ''); setModal('callback'); }}
              >
                Set Callback
              </Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => setModal('reassign')}>
                Reassign Owner
              </Button>
              <Button
                variant="secondary"
                className="btn-danger-block"
                onClick={() => setModal('reject')}
              >
                Reject
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="title title-md mb-3">Overview</h2>
            <div className="space-y-3 text-[length:var(--fs-body)]">
              <div className="split-nowrap gap-2">
                <span className="text-muted">Status</span>
                <Badge variant={lead.status === 'Rejected' ? 'danger' : 'outlined-red'}>{lead.status}</Badge>
              </div>
              <div className="split-nowrap gap-2">
                <span className="text-muted">Lead #</span>
                <span className="text-accent font-medium">{lead.leadId}</span>
              </div>
              <div className="split-nowrap gap-2">
                <span className="text-muted">Service Needed</span>
                <span className="text-fg text-right">{lead.serviceNeeded}</span>
              </div>
              <div className="split-nowrap gap-2">
                <span className="text-muted">Owner</span>
                <span className="text-fg">{lead.ownerId}</span>
              </div>
              {lead.contactName && (
                <div className="split-nowrap gap-2">
                  <span className="text-muted">Contact</span>
                  <span className="text-fg">{lead.contactName}</span>
                </div>
              )}
              {lead.mobileNumber && (
                <div className="split-nowrap gap-2">
                  <span className="text-muted">Mobile</span>
                  <span className="text-fg">{lead.mobileNumber}</span>
                </div>
              )}
              <div className="split-nowrap gap-2">
                <span className="text-muted">Created Via</span>
                <span className="text-fg">{lead.createdVia}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Drawer open={modal === 'reject'} onClose={() => setModal(null)} title="Reject Lead">
        <div className="space-y-3">
          <Select
            label="Reject Reason Code"
            value={rejectCode}
            onChange={(e) => setRejectCode(e.target.value)}
            placeholder="Select a reason"
            options={reasons.map((r) => ({ value: r.reasonCode, label: r.reasonLabel }))}
          />
          <Textarea label="Reject Comment" value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} />
        </div>
        <div className="actions-end mt-6">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
          <Button onClick={submitReject} disabled={!rejectCode}>Confirm Rejection</Button>
        </div>
      </Drawer>

      <Drawer open={modal === 'reassign'} onClose={() => setModal(null)} title="Lead Owner">
        <Input aria-label="Filter by Last Name" placeholder="Filter by Last Name" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} />
        <div className="mt-3 scroll-list max-h-64">
          {filteredAgents.map((a) => (
            <button type="button"
              key={a.userId}
              onClick={() => submitReassign(a)}
              className="row-pick"
            >
              <span className="text-fg">{a.firstName} {a.lastName}</span>
              <span className="caption-muted">{a.jobTitle}</span>
            </button>
          ))}
          {filteredAgents.length === 0 && <p className="text-muted py-3 text-center">No matching candidates.</p>}
        </div>
      </Drawer>

      <Drawer
        open={modal === 'description'}
        onClose={() => setModal(null)}
        title="Description"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={submitDescription}>Save Description</Button>
          </>
        }
      >
        <Textarea aria-label="Description" value={descriptionDraft} onChange={(e) => setDescriptionDraft(e.target.value)} />
      </Drawer>

      <Drawer
        open={modal === 'callback'}
        onClose={() => setModal(null)}
        title="CallBack Date/Time"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={submitCallback} disabled={callbackDraft.length < 16}>Done</Button>
          </>
        }
      >
        {/* Stored as before (YYYY-MM-DDTHH:mm); the date is the app's date field, the time its own. */}
        <div className="fields-2">
          <DateInput label="Callback Date" format="iso" value={dateOf(callbackDraft)} onChange={(e) => setCallbackDraft(joinCallback(e.target.value, timeOf(callbackDraft)))} />
          <Input label="Callback Time" type="time" value={timeOf(callbackDraft)} onChange={(e) => setCallbackDraft(joinCallback(dateOf(callbackDraft), e.target.value))} />
        </div>
      </Drawer>
    </div>
  );
}
