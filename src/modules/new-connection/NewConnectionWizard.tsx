import { POSTPAID_MILESTONES, SUBMITTED_FOR_APPROVAL_MESSAGE, postpaidMilestonesApply } from './milestones';
import { useRestrictedCustomers } from '../../hooks/useRestrictedCustomers';
import { RestrictedCustomerNotice } from '../../components/patterns/RestrictedCustomerNotice';
import { canViewCustomerSegment } from '../../engines/agentPrivilegeEngine';

import { reachMilestoneOnEvent } from '../../components/patterns/wizard/useJourneyMilestones';
import type { JourneyMilestones } from '../../engines/milestoneEngine';
import { useEffect, useState } from 'react';
import { useLocation } from '../../lib/router';
import { familyLineContextOf } from './familyStart';
import { existingCustomerPath } from '../../navigation/journeyPaths';
import { customerContextActions } from '../../stores/customerContextSlice';
import { workflowActions, selectDraft } from '../../stores/workflowSlice';
import { DemoFaultPanel } from '../../components/patterns/DemoFaultPanel';
import type { ConnectionJourney, NewConnectionFlow } from './newConnectionModel';
import { submitNewConnectionOrder } from './submitNewConnectionOrder';
import { useNewConnectionJourney } from './hooks/useNewConnectionJourney';
import { buildConnectionSteps } from './connectionSteps';
import { submitPrepaidOrder } from '../mobile-prepaid/screens/submitPrepaidOrder';
import { submitFixedActivationOrder } from '../fixed-line-fibre/fixedActivation/submitFixedActivationOrder';
import { submitMnpOrder } from '../mnp-fnp-porting/screens/submitMnpOrder';
import { detectDeviceType } from 'dxp-ui';
import { homeProductLabel, productLabel } from './products';
import { homeOffersPassingThrough, productStepIndex } from './steps/productChoice';
import type { ConnectionProduct, HomeProduct } from './products';
import {
  ActivationComplete,
  GuidedActivationWizard,
  JourneyCustomerBadge,
  DRAFT_ORDERS_PATH,
  POST_EXIT_DESTINATION,
} from '../../capabilities';
import type { ConfirmedOrder, CrossSalesValue } from '../../capabilities';
import { store } from '../../stores/store';
import { DraftOrdersPrompt } from './steps/DraftOrdersPrompt';
import { HomeDraftOrdersPrompt } from './steps/HomeDraftOrdersPrompt';
import { HOME_DERIVED_KEYS } from './draftOrders';
import { canUseFeature } from '../../engines/personaEngine';
import { COMMON_CONTACT_FEATURE } from '../../engines/navigationEngine';
import { useAppSelector } from '../../stores/hooks';
import { useEntityOps } from '../../services/entityHooks';
import { listEntities } from '../../services/entityOps';

// New Connection: ONE continuous journey for every new connection. It begins with Customer Verification - ID scan, MOI
// validation, the eligibility checks common to every product, special discounts - and, once the customer is identified, the
// agent chooses the product by the customer's intent (Product Selection). The journey then continues in this same wizard
// with that product's steps: the draft, the customer lock and the title never change, and nothing exits or restarts.
// `initialProduct` is for an entry point that already names the product (a Prepaid or Fixed Line link): Identification still
// comes first, then the product step passes itself over (Back returns to it).
// Mobile Postpaid Activation's milestones (see milestones.ts); they apply while the product is Postpaid or not yet chosen.
const POSTPAID_MILESTONE_CONFIG: JourneyMilestones = { defs: POSTPAID_MILESTONES, applies: postpaidMilestonesApply };

export function NewConnectionWizard({
  flow = 'new',
  journey = 'connection',
  initialProduct: initialProductProp,
  initialValues: initialValuesProp,
  title,
  fixedFooter,
}: {
  flow?: NewConnectionFlow;
  /** 'home' is New Home Connection (Fibre, Fixed-Line, FWA, 5G Home); the default is New Connection. */
  /** 'home' is New Home Connection (Fibre, Fixed-Line, FWA, 5G Home); the default is New Connection. */
  journey?: ConnectionJourney;
  initialProduct?: ConnectionProduct;
  /** Values the entry point already knows for that product (an FWA link starts Fixed Line with the FWA service type). */
  /** Values the entry point already knows for that product (an FWA link starts Fixed Line with the FWA service type). */
  initialValues?: Record<string, unknown>;
  /** The journey's name when an entry point has its own (MNP Port-In, New Prepaid Activation); New Connection is the default. */
  /** The journey's name when an entry point has its own (MNP Port-In, New Prepaid Activation); New Connection is the default. */
  title?: string;
  /** Back/Continue float at the bottom of the viewport in every journey; pass false to leave them under the step card. */
  /** Back/Continue float at the bottom of the viewport in every journey; pass false to leave them under the step card. */
  fixedFooter?: boolean;
}) {
  const {
    navigate,
    existingCustomerId,
    WIZARD_ID,
    createRecord,
    confirmedOrder,
    setConfirmedOrder,
    isMirrorWindow,
    draftStep,
    heldByAnotherJourney,
    guardedContactChange,
    customerBenefits,
    products,
    familyLines,
    familyOrders,
    applyCrossSales,
  } = useNewConnectionJourney(flow, journey);
  const updateRecord = useEntityOps().updateRecord;
  // Add Another Connection starts this journey with the connection type chosen and the package it joins (router state, as the other entry points carry theirs):
  // it is a postpaid line, begun from Customer Verification like any other, and the type and package stay in the draft for every step after. The router state
  // is consumed (and the draft cleared) as the journey opens, so it is held here, and written to the draft again if the clearing took it.
  const location = useLocation();
  const [familyLine, setFamilyLine] = useState(() => familyLineContextOf({ familyLine: (location.state as { familyLine?: unknown } | null)?.familyLine }));
  const initialProduct = initialProductProp ?? (familyLine ? 'postpaid' : undefined);
  const initialValues = familyLine ? { ...initialValuesProp, familyLine } : initialValuesProp;
  // Fixed for the life of the journey, so steps never change under the agent.
  const [device] = useState(detectDeviceType);
  const product = useAppSelector((s) => s.workflow.drafts[WIZARD_ID]?.values?.product) as ConnectionProduct | undefined;
  const homeProduct = useAppSelector((s) => s.workflow.drafts[WIZARD_ID]?.values?.homeProduct) as HomeProduct | undefined;
  const productPreselected = useAppSelector((s) => s.workflow.drafts[WIZARD_ID]?.values?.productPreselected) as boolean | undefined;
  const draftValues = useAppSelector((s) => s.workflow.drafts[WIZARD_ID]?.values);
  const draftOrderId = useAppSelector((s) => s.workflow.drafts[WIZARD_ID]?.draftOrderId);
  const agentId = useAppSelector((s) => s.auth.profile?.userId);
  // The same route is opened again to add a connection (or to start a new journey) while this page still shows the last confirmation: a fresh start leaves the
  // confirmation and takes its own connection type (or none).
  useEffect(() => {
    const st = location.state as { startFresh?: boolean; familyLine?: unknown } | null;
    if (!st?.startFresh) return;
    setFamilyLine(familyLineContextOf({ familyLine: st.familyLine }));
    setConfirmedOrder(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
  // A Check RFS result waits in this draft (`pendingHome`) only for the run that came from Check RFS (it opens with `startFresh` and the result as `startValues`). The page opened any other way
  // (the dashboard, the sidebar) with nobody identified yet is not that run: an old result left in the draft is dropped, so a New Home offer chosen here goes to Check RFS for its own check
  // instead of opening past a Service Feasibility the agent never saw.
  useEffect(() => {
    const st = location.state as { startFresh?: boolean; startValues?: unknown; resumeOrderId?: string } | null;
    if (st?.startFresh || st?.startValues || st?.resumeOrderId) return;
    const values = selectDraft(store.getState(), WIZARD_ID).values;
    if (values.pendingHome === undefined || (values.contact as { moiResult?: unknown } | undefined)?.moiResult) return;
    store.dispatch(workflowActions.patchDraft(WIZARD_ID, { unset: ['pendingHome'] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // New Home Connection has no Contact page of its own: every New Connection journey identifies the customer on the common Contact page (/start-connection), which does the customer-level
  // checks once and leads to Recommended Offers, from where New Home starts. A home journey opened with nobody identified (the journey card, Customer 360, Sales, the home URL) therefore goes
  // there - for the existing customer's route when the customer is known. Not when it is being resumed (a Draft Order re-verifies the ID in place), when it was opened with values carried (from
  // Check RFS or Recommended Offers), when it is already under way, or when the role cannot use the common page (it keeps this journey's own Contact page).
  const personaIdForEntry = useAppSelector((st) => st.persona.activePersonaId);
  const entryState = location.state as { resumeOrderId?: string; startValues?: unknown } | null;
  const homeEntryUnderway = Boolean(entryState?.resumeOrderId || entryState?.startValues || draftValues?.contact || draftOrderId || (draftStep ?? 0) > 0);
  const redirectsToCommonContact = journey === 'home' && !isMirrorWindow && !homeEntryUnderway && Boolean(personaIdForEntry) && canUseFeature(personaIdForEntry!, COMMON_CONTACT_FEATURE);
  useEffect(() => {
    if (!redirectsToCommonContact) return;
    navigate(flow === 'existing' && existingCustomerId ? existingCustomerPath(existingCustomerId) : '/start-connection', { replace: true, state: { startFresh: true } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirectsToCommonContact, flow, existingCustomerId]);
  // A resumed New Home Connection draft (see HomeDraftOrdersPrompt and the Draft Orders list) carries what it computed for the CAF and the charges: an amended order recalculates its charges at
  // Order Summary and is signed again, so none of it is kept. Only a journey that is being resumed (it has the step to return to) is cleaned; a new one has nothing to clean.
  const resumingStepKey = useAppSelector((s) => s.workflow.drafts[WIZARD_ID]?.resumeToStepKey);
  const hasDerived = HOME_DERIVED_KEYS.some((k) => draftValues?.[k] !== undefined);
  useEffect(() => {
    if (journey !== 'home' || !resumingStepKey || !hasDerived || isMirrorWindow) return;
    store.dispatch(workflowActions.patchDraft(WIZARD_ID, { unset: HOME_DERIVED_KEYS }));
  }, [journey, resumingStepKey, hasDerived, isMirrorWindow, WIZARD_ID]);
  // An offer carried from New Connection (Select Offer on a New Home offer) brings the plan it is for once the catalogue is loaded.
  const carriedOffer = draftValues?.offerCarried === true ? (draftValues.crossSales as CrossSalesValue | undefined) : undefined;
  const carriedPlanSet = draftValues?.productId !== undefined;
  useEffect(() => {
    if (!carriedOffer || carriedPlanSet || products.length === 0 || isMirrorWindow) return;
    const set: Record<string, unknown> = {};
    applyCrossSales((field, value) => { set[field] = value; }, carriedOffer);
    store.dispatch(workflowActions.patchDraft(WIZARD_ID, { set: { productId: set.productId } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carriedOffer, carriedPlanSet, products.length, isMirrorWindow, WIZARD_ID]);
  const familyLineInDraft = Boolean(draftValues?.familyLine);
  useEffect(() => {
    if (!familyLine || familyLineInDraft || confirmedOrder || isMirrorWindow) return;
    store.dispatch(workflowActions.patchDraft(WIZARD_ID, { set: { familyLine, product: 'postpaid', productPreselected: true } }));
  }, [familyLine, familyLineInDraft, confirmedOrder, isMirrorWindow, WIZARD_ID]);

  // Existing Customer: the route names the customer, so their name sits under the title from the start.
  const [routeCustomerName, setRouteCustomerName] = useState<string | undefined>();
  // The route names the customer: if they are in a protected segment this role may not see, the journey is blocked here - before the badge, the scanner's
  // card or any other detail of them is drawn.
  const restricted = useRestrictedCustomers();
  useEffect(() => {
    if (flow !== 'existing' || !existingCustomerId) return;
    let cancelled = false;
    void listEntities<{ customerId: string; name: string }>('customers').then((all) => {
      if (!cancelled) setRouteCustomerName(all.find((c) => c.customerId === existingCustomerId && canViewCustomerSegment(store.getState().persona.activePersonaId, (c as { segment?: string }).segment))?.name);
    });
    return () => {
      cancelled = true;
    };
  }, [flow, existingCustomerId]);

  // An entry point that names the product starts the draft with it chosen (an agent's later choice, once identified, is never undone).
  useEffect(() => {
    if (!initialProduct || isMirrorWindow) return;
    const draft = selectDraft(store.getState(), WIZARD_ID);
    // A draft that has not identified anyone yet has nothing to lose: the entry point's product replaces a leftover one.
    const identified = Boolean((draft.values.contact as { moiResult?: unknown } | undefined)?.moiResult);
    if (draft.values.product === undefined || (!identified && draft.values.product !== initialProduct)) {
      store.dispatch(workflowActions.patchDraft(WIZARD_ID, { set: { product: initialProduct, productPreselected: true, ...(initialProduct === 'mnp' ? { mnpType: 'postpaid' } : {}), ...initialValues } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProduct, isMirrorWindow, WIZARD_ID]);

  // The page title names the journey the agent chose (New Postpaid, New Fixed Line, New MNP, New Prepaid) from the screen after the choice
  // onward, and stays for the rest of the journey. On the Product Selection page itself, where the choice is still being made, it stays
  // the generic New Connection - unless an entry point already chose the product.
  const onProductStep = journey !== 'home' && (draftStep ?? 0) === productStepIndex(journey, draftValues ?? {});
  const chosenLabel = productLabel(product);
  const journeyTitle =
    journey === 'home' ? 'New Home Connection' : chosenLabel && (!onProductStep || productPreselected) ? chosenLabel : 'New Connection';

  const [passGaveUp, setPassGaveUp] = useState(false);

  if (heldByAnotherJourney && !isMirrorWindow) return null; // redirecting to the journey that holds the customer
  if (redirectsToCommonContact) return null; // redirecting to the common Contact page: the home journey's own first page is never drawn

  if (confirmedOrder) {
    return (
      <ActivationComplete
        order={confirmedOrder}
        service={confirmedOrder.service}
        showActivityId={!isMirrorWindow}
        allowCustomerView={device === 'web'}
        // Add Another Connection: the chosen type and its package start the New Postpaid journey again for this customer, from Customer Verification.
        onAddConnection={(familyLine) => confirmedOrder.customerId && navigate(existingCustomerPath(confirmedOrder.customerId), { state: { startFresh: true, familyLine } })}
      />
    );
  }

  const confirm = async (values: Record<string, unknown>): Promise<ConfirmedOrder> => {
    switch (values.product as ConnectionProduct | undefined) {
      case 'prepaid':
        return submitPrepaidOrder(values, { createRecord, updateRecord }, device);
      case 'fixed-line':
        return submitFixedActivationOrder(values, { createRecord, updateRecord });
      case 'mnp':
        return submitMnpOrder(values, { createRecord, updateRecord });
      default:
        return submitNewConnectionOrder(values, { flow, createRecord, updateRecord });
    }
  };

  if (flow === 'existing' && existingCustomerId) {
    if (!restricted.ready) return <div className="p-8 text-fg-2" role="status">Loading…</div>;
    if (restricted.isRestricted(existingCustomerId)) {
      return (
        <div className="p-8 max-w-2xl">
          <RestrictedCustomerNotice backTo="/customer-search" backLabel="Back to Customer Search" />
        </div>
      );
    }
  }

  const steps = buildConnectionSteps({
    wizardId: WIZARD_ID,
    journey,
    flow,
    existingCustomerId,
    guardedContactChange,
    applyCrossSales,
    navigate,
    createRecord,
    products,
    familyLines,
    familyOrders,
    customerBenefits,
    device,
  });
  // Mobile Postpaid Activation: once the customer is identified, the Draft Orders this agent saved for them are offered (resume one, or start a new Product Selection).
  // Only while the journey is at Customer Verification, has no saved order of its own yet, and the product is Postpaid or not yet chosen.
  const identifiedCustomerId = (draftValues?.eligibility as { customerId?: string } | undefined)?.customerId;
  const offerDrafts =
    journey === 'connection' && !isMirrorWindow && (draftStep ?? 0) === 0 && !draftOrderId && (initialProduct === undefined || initialProduct === 'postpaid') && (product === undefined || product === 'postpaid');

  // New Home Connection: once the customer is identified (the first page, nothing saved of this journey yet), the agent's own drafts for them are offered.
  const offerHomeDrafts = journey === 'home' && !isMirrorWindow && (draftStep ?? 0) === 0 && !draftOrderId;

  // The home journey's Recommended Offers page, opened with an offer already chosen, only judges eligibility and moves on: it is not drawn meanwhile. Only while it IS the current step - a journey opened
  // on another step (Fiber Instant Activation opens on the device scan, ahead of the offers) draws that step at once. Drawn anyway if the pass-through has not moved on within a few seconds.
  const currentStepKey = steps.filter((st) => !st.skip?.(draftValues ?? {}))[draftStep ?? 0]?.key;
  const passing = journey === 'home' && !isMirrorWindow && currentStepKey === 'homeOffers' && homeOffersPassingThrough(draftValues ?? {});

  return (
    <div className="min-h-full flex flex-col" data-device={device} hidden={passing && !passGaveUp}>
      {passing && !passGaveUp && <PassThroughTimeout onElapsed={() => setPassGaveUp(true)} />}
      {offerDrafts && <DraftOrdersPrompt wizardId={WIZARD_ID} customerId={identifiedCustomerId} agentId={agentId} steps={steps} currentValues={draftValues ?? {}} />}
      {offerHomeDrafts && <HomeDraftOrdersPrompt wizardId={WIZARD_ID} customerId={identifiedCustomerId} agentId={agentId} steps={steps} currentValues={draftValues ?? {}} />}
      <GuidedActivationWizard
        belowPanel={(draftStep ?? 0) === 0 && !isMirrorWindow ? <DemoFaultPanel /> : undefined}
        wizardId={WIZARD_ID}
        fixedFooter={fixedFooter}
        showSelectedAddonsTray={product === 'postpaid'}
        allowCustomerView={device === 'web'} // a second customer-facing window has no use on a tablet or phone
        title={title ?? journeyTitle}
        draftActionLabel={
          product === 'fixed-line' && homeProduct
            ? `${homeProductLabel(homeProduct)} Activation`.replace('New ', '')
            : product
              ? `${productLabel(product)} Activation`.replace('New ', '')
              : journey === 'home'
                ? 'Home Connection'
                : 'New Connection'
        }
        // Not on Customer Verification (step 0, always the first step): the customer is only confirmed there, so naming them in the header is premature.
        titleAside={
          (draftStep ?? 0) > 0 ? (
            <JourneyCustomerBadge
              wizardId={WIZARD_ID}
              routeCustomer={flow === 'existing' ? { name: routeCustomerName, customerId: existingCustomerId } : undefined}
            />
          ) : undefined
        }
        onAbandon={() => navigate(POST_EXIT_DESTINATION)}
        hideAbandonFrom="payment"
        onSaveExit={() => navigate(DRAFT_ORDERS_PATH)}
        steps={steps}
        milestones={journey === 'home' ? undefined : POSTPAID_MILESTONE_CONFIG}
        onSubmit={async (values) => {
          const confirmed = await confirm(values);
          // Milestone 5: the order is in. Held for approval is "submitted", never "approved".
          if (values.product === 'postpaid') {
            reachMilestoneOnEvent(WIZARD_ID, POSTPAID_MILESTONE_CONFIG, values, 'submitted', confirmed.pendingApproval ? SUBMITTED_FOR_APPROVAL_MESSAGE : undefined);
          }
          setConfirmedOrder(confirmed);
          // Kept with the customer context so the Activity Final page returns until Close Activity.
          store.dispatch(customerContextActions.patchJourney(WIZARD_ID, { finalOrder: confirmed as unknown as Record<string, unknown> }));
        }}
      />
    </div>
  );
}

/** Gives up waiting for a pass-through page to move on, so a page that has to be read (a failed check) is shown after a few seconds. */
function PassThroughTimeout({ onElapsed }: { onElapsed: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onElapsed, 5000);
    return () => window.clearTimeout(t);
  }, [onElapsed]);
  return null;
}
