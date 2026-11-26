import { useEffect, useState } from 'react';
import { customerContextActions } from '../../stores/customerContextSlice';
import {
  ActivationComplete,
  DRAFT_ORDERS_PATH,
  GuidedActivationWizard,
  JourneyCustomerBadge,
  POST_EXIT_DESTINATION,
  useCustomerBenefits,
  useJourneySession,
} from '../../capabilities';
import type { ConfirmedOrder } from '../../capabilities';
import { detectDeviceType, type WizardStep } from 'dxp-ui';
import type { Product } from '../new-connection/newConnectionModel';
import type { ServiceChangeContext } from './serviceChangeSteps';
import { store } from '../../stores/store';
import type { EntityOps } from '../../services/types';
import { useEntityOps } from '../../services/entityHooks';
import { listEntities } from '../../services/entityOps';

/**
 * The journey shell of the journeys that change an existing mobile line (Change Postpaid Plan, Change Prepaid Pack, Add Add-On,
 * Prepaid to Postpaid): the shared journey session (customer lock, draft, confirmed order), the plan catalogue and the customer's
 * benefits for the steps, the wizard and, once submitted, the shared Activation Complete page. A journey supplies its steps and its order.
 */

/**
 * The journey shell of the journeys that change an existing mobile line (Change Postpaid Plan, Change Prepaid Pack, Add Add-On,
 * Prepaid to Postpaid): the shared journey session (customer lock, draft, confirmed order), the plan catalogue and the customer's
 * benefits for the steps, the wizard and, once submitted, the shared Activation Complete page. A journey supplies its steps and its order.
 */
export function ServiceChangeWizard({
  wizardId,
  title,
  buildSteps,
  submit,
}: {
  wizardId: string;
  title: string;
  buildSteps: (ctx: ServiceChangeContext) => WizardStep[];
  submit: (values: Record<string, unknown>, deps: { createRecord: EntityOps['createRecord']; updateRecord: EntityOps['updateRecord'] }) => Promise<ConfirmedOrder>;
}) {
  const { navigate, createRecord, confirmedOrder, setConfirmedOrder, isMirrorWindow, draftStep, draftCustomerId, heldByAnotherJourney, guardedContactChange } =
    useJourneySession<ConfirmedOrder>({ wizardId, flow: 'new' });
  const updateRecord = useEntityOps().updateRecord;
  const customerBenefits = useCustomerBenefits(draftCustomerId);
  const [device] = useState(detectDeviceType);
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    void listEntities<Product>('products').then(setProducts);
  }, []);

  if (heldByAnotherJourney && !isMirrorWindow) return null; // redirecting to the journey that holds the customer
  if (confirmedOrder) return <ActivationComplete order={confirmedOrder} service={confirmedOrder.service} showActivityId={!isMirrorWindow} allowCustomerView={device === 'web'} />;

  return (
    <div className="min-h-full flex flex-col" data-device={device}>
      <GuidedActivationWizard
        wizardId={wizardId}
        allowCustomerView={device === 'web'}
        title={title}
        draftActionLabel={title}
        // Not on Customer Verification (step 0, always the first step): the customer is only confirmed there.
        titleAside={(draftStep ?? 0) > 0 ? <JourneyCustomerBadge wizardId={wizardId} /> : undefined}
        onAbandon={() => navigate(POST_EXIT_DESTINATION)}
        hideAbandonFrom="payment"
        onSaveExit={() => navigate(DRAFT_ORDERS_PATH)}
        steps={buildSteps({ flow: 'new', existingCustomerId: undefined, guardedContactChange, products, customerBenefits })}
        onSubmit={async (values) => {
          const confirmed = await submit(values, { createRecord, updateRecord });
          setConfirmedOrder(confirmed);
          // Kept with the customer context so the Activity Final page returns until Close Activity.
          store.dispatch(customerContextActions.patchJourney(wizardId, { finalOrder: confirmed as unknown as Record<string, unknown> }));
        }}
      />
    </div>
  );
}
