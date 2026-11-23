import { useMemo, useState } from 'react';
import { Button, Badge, Modal, FILE } from 'dxp-ui';
import { CARD_IDLE, CARD_SELECTED, SelectedTick } from '../../../components/primitives/offerCardParts';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import { workflowActions } from '../../../stores/workflowSlice';
import { notificationActions } from '../../../stores/notificationSlice';
import { store } from '../../../stores/store';
import { useAction } from '../../../stores/hooks';
import { useEntityRecords } from '../../../services/entityHooks';
import { entityOps, getEntity, listEntities } from '../../../services/entityOps';
import { formatDateTime } from '../../../lib/format';
import { applicableHomeDraftOrders, homeResumedDraftValues, type DraftOrderOption, type DraftOrderRecord, type DraftTaskRecord } from '../draftOrders';
import { DRAFT_CHOICE_KEY } from './DraftOrdersPrompt';

interface DraftChoice {
  /** Who the answer was for: the customer record, else the ID number. */
  customerId: string;
  choice: 'resumed' | 'new';
}

/**
 * New Home Connection's Draft Orders: once the customer is identified (the ID scanned and verified), the drafts THIS agent saved for THIS customer in this journey are offered - resume one,
 * discard one, or start a new Product Selection. Nothing is shown when there are none. A draft cannot be opened without the ID check: this appears only after it. Resuming brings the draft's
 * values in (without what it computed for the CAF and the charges, which are recalculated and signed again) and Continue returns the agent to the step it was saved on; starting new
 * changes no draft. Discarding deletes the draft order and its task. The Mobile Postpaid prompt is a separate component and is not changed.
 */
export function HomeDraftOrdersPrompt({
  wizardId,
  customerId,
  agentId,
  steps,
  currentValues,
}: {
  wizardId: string;
  /** The customer identified at Customer Verification; undefined until then (and for a new customer, who has no drafts). */
  customerId: string | undefined;
  agentId: string | undefined;
  /** The journey's steps, to name the stage a draft was saved on. */
  steps: WizardStep[];
  /** The journey's values right now (what Customer Verification has produced). */
  currentValues: Record<string, unknown>;
}) {
  const orders = useEntityRecords<DraftOrderRecord>('orders');
  const tasks = useEntityRecords<DraftTaskRecord>('tasks');
  const products = useEntityRecords<{ productId: string; name?: string }>('products');
  const patchDraft = useAction(workflowActions.patchDraft);
  const pushToast = useAction(notificationActions.pushToast);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);

  const choice = currentValues[DRAFT_CHOICE_KEY] as DraftChoice | undefined;
  // Identified: the ID has been scanned and verified (the registry result is on the contact). A customer without a record yet is known by the ID number.
  const contact = currentValues.contact as { idNumber?: string; moiResult?: unknown } | undefined;
  const idNumber = contact?.moiResult ? contact.idNumber : undefined;
  const who = customerId ?? idNumber;
  const options = useMemo(() => applicableHomeDraftOrders(orders ?? [], tasks ?? [], { customerId, idNumber, agentId }), [orders, tasks, customerId, idNumber, agentId]);
  const open = Boolean(who) && options.length > 0 && choice?.customerId !== who;
  if (!open || !who) return null;

  const chosen = options.find((o) => o.orderId === selectedId) ?? options[0];
  const stepLabel = (key: string | undefined) => steps.find((s) => s.key === key)?.label;
  const planName = (id: string | undefined) => (id ? products?.find((p) => p.productId === id)?.name ?? id : undefined);

  const startNew = () => patchDraft(wizardId, { set: { [DRAFT_CHOICE_KEY]: { customerId: who, choice: 'new' } satisfies DraftChoice } });

  const resume = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // The draft may have been resumed in another window, submitted or discarded since the list was read: it is checked before anything is restored.
      const fresh = await getEntity<DraftOrderRecord>('orders', chosen.orderId);
      if (!fresh || fresh.status !== 'Draft' || !fresh.draftValues) {
        pushToast('error', 'That Draft Order is no longer available.', { detail: 'Choose another, or start a new Product Selection.' });
        setSelectedId(undefined);
        return;
      }
      const stepKey = fresh.draftStepKey;
      const task = (await listEntities<DraftTaskRecord>('tasks')).find((t) => t.relatedOrderId === fresh.orderId);
      const values = { ...homeResumedDraftValues(fresh.draftValues, currentValues), [DRAFT_CHOICE_KEY]: { customerId: who, choice: 'resumed' } satisfies DraftChoice };
      const state = store.getState().workflow.drafts[wizardId];
      store.dispatch(
        workflowActions.hydrateDraft(wizardId, {
          currentStep: state?.currentStep ?? 0,
          maxStepReached: Math.max(state?.maxStepReached ?? 0, 0),
          values,
          // The order this journey now works on: later saves update it, no new order is created.
          draftOrderId: fresh.orderId,
          // Continue (Customer Verification is done) takes the agent back to the step the draft was saved on.
          ...(stepKey && stepKey !== steps[0]?.key ? { resumeToStepKey: stepKey } : {}),
          ...(task ? { resumeTaskId: task.taskId } : {}),
        })
      );
      pushToast('success', `Draft Order ${fresh.orderId} resumed.`, {
        detail: stepKey && stepKey !== steps[0]?.key ? `Continue to return to ${stepLabel(stepKey) ?? 'where it was left'}. The charges are recalculated and the CAF is signed again.` : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  // The Draft Order and its Draft Orders task, removed together (as Abandon Order and the Draft Orders list do).
  const discard = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const tasksNow = await listEntities<DraftTaskRecord>('tasks');
      for (const t of tasksNow.filter((x) => x.relatedOrderId === chosen.orderId)) await entityOps.removeRecord('tasks', 'taskId', t.taskId);
      await entityOps.removeRecord('orders', 'orderId', chosen.orderId);
      setSelectedId(undefined);
      setConfirmDiscard(false);
      pushToast('success', `Draft Order ${chosen.orderId} discarded.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={!confirmDiscard}
        // Closing without choosing is the same as starting new: no draft is loaded and none is changed.
        onClose={startNew}
        title="Draft Orders Found"
        subtitle={`${options.length} saved by you for this customer`}
        icon={FILE}
        widthClassName="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDiscard(true)} disabled={busy}>
              Discard Draft
            </Button>
            <Button variant="secondary" onClick={startNew} disabled={busy}>
              Start New Product Selection
            </Button>
            <Button onClick={() => void resume()} disabled={busy}>
              {busy ? 'Resuming…' : 'Resume Draft Order'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-secondary">Choose a draft to carry on with, discard one, or start a new Product Selection. Starting new leaves your drafts as they are.</p>
          <div role="radiogroup" aria-label="Draft Orders" className="space-y-2">
            {options.map((o) => (
              <DraftOption key={o.orderId} option={o} selected={o.orderId === chosen.orderId} onSelect={() => setSelectedId(o.orderId)} stage={stepLabel(o.stepKey)} plan={planName(o.planId)} />
            ))}
          </div>
        </div>
      </Modal>
      <Modal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard Draft Order?"
        subtitle={chosen.orderId}
        icon={FILE}
        widthClassName="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)} disabled={busy}>
              Keep Draft
            </Button>
            <Button onClick={() => void discard()} disabled={busy}>
              {busy ? 'Discarding…' : 'Discard Draft'}
            </Button>
          </>
        }
      >
        <p className="text-secondary">Everything saved on {chosen.orderId} is deleted. This cannot be undone.</p>
      </Modal>
    </>
  );
}

function DraftOption({ option: o, selected, onSelect, stage, plan }: { option: DraftOrderOption; selected: boolean; onSelect: () => void; stage?: string; plan?: string }) {
  // Only what the draft carries is shown: no empty labels for what it does not.
  const facts: [string, string | undefined][] = [
    ['Journey', o.orderType],
    ['Stage', stage],
    ['Plan', plan],
    ['Number', o.msisdn],
    ['Created', o.createdAt ? formatDateTime(o.createdAt) : undefined],
    ['Last Modified', o.modifiedAt ? formatDateTime(o.modifiedAt) : undefined],
  ];
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className={`card-frame draft-option ${selected ? CARD_SELECTED : CARD_IDLE}`}>
      {selected && <SelectedTick />}
      <span className="row gap-2">
        <span className="title title-md font-semibold">{o.orderId}</span>
        <Badge variant="filled-neutral">Draft</Badge>
      </span>
      <dl className="draft-facts">
        {facts.flatMap(([label, value]) =>
          value ? [
            <div key={label} className="split-nowrap gap-2">
              <dt className="text-fg-2">{label}</dt>
              <dd className="value-end font-medium">{value}</dd>
            </div>,
          ] : []
        )}
      </dl>
      {o.comment && <p className="caption-secondary mt-2 break-words">{o.comment}</p>}
    </button>
  );
}
