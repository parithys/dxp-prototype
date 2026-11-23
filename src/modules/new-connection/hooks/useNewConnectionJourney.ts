import { useEffect, useState } from 'react';
import { useParams } from '../../../lib/router';
import { applyCrossSalesDecision, useCustomerBenefits, useJourneySession } from '../../../capabilities';
import type { CrossSalesValue } from '../../../capabilities';
import { HOME_WIZARD_ID_BY_FLOW, WIZARD_ID_BY_FLOW } from '../newConnectionModel';
import type { ConnectionJourney, NewConnectionFlow, Product, ConfirmedOrder } from '../newConnectionModel';
import type { FamilyLine, FamilyOrder } from '../../../engines/familyPackage';
import { isPlanOfferedTo } from '../../../components/patterns/postpaidPlanModel';
import { listEntities } from '../../../services/entityOps';

// New Connection's journey state: the shared journey session (customer lock, draft, confirmed order) under its own
// wizard id, plus what is specific to this journey - the fetched plan catalogue, the customer's benefits and how an
// accepted offer is applied.
/** The kind of plan an offer's journey sells: a New Prepaid offer a prepaid plan, a New Fixed Line offer a fixed-line plan, an FWA offer a 5G Home plan, every other a postpaid one. */
const planKindOfOffer = (journey: string | undefined) =>
  journey === 'new-prepaid' ? 'Prepaid Plan' : journey === 'new-fixed-line' ? 'Fixed Line Plan' : journey === 'new-fwa' ? 'FWA 5G Home Plan' : 'Postpaid Plan';

export function useNewConnectionJourney(flow: NewConnectionFlow, journey: ConnectionJourney = 'connection') {
  const { customerId: existingCustomerId } = useParams<{ customerId: string }>();
  // The Existing flow's draft belongs to ONE customer: keyed by the customer id, so a draft left by another
  // customer's journey (same browser session) can never carry its applicant name, identity or eligibility into this one.
  const ids = journey === 'home' ? HOME_WIZARD_ID_BY_FLOW : WIZARD_ID_BY_FLOW;
  const WIZARD_ID = flow === 'existing' && existingCustomerId ? `${ids.existing}-${existingCustomerId}` : ids[flow];
  const session = useJourneySession<ConfirmedOrder>({ wizardId: WIZARD_ID, flow, existingCustomerId });
  // Discounts follow the customer this journey is for: the route's customer, or the one the identity check resolved.
  const benefitsOnRecord = useCustomerBenefits(flow === 'existing' ? existingCustomerId : session.draftCustomerId);
  // A new customer holds no benefit (an existing-customer discount such as Loyalty is not offered); unknown stays unknown only while a customer is being loaded.
  const customerBenefits = session.draftIsNewCustomer ? [] : benefitsOnRecord;
  // Fetched once at the wizard level (2026-09-28) rather than inside a single step, so Number Selection can resolve
  // the selected plan's MRC for BR-115's star-number entitlement without re-fetching the catalogue the plan step reads.
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    listEntities<Product>('products').then(setProducts);
  }, []);
  // Every Family Package line on record: a Family Plan can only start a package for a customer who holds none (engines/familyPackage.familyStartCheck).
  const [familyLines, setFamilyLines] = useState<FamilyLine[]>([]);
  // The orders those lines were placed on: a connection can be added to a package only once Primary Line 1's order is approved.
  const [familyOrders, setFamilyOrders] = useState<FamilyOrder[]>([]);
  useEffect(() => {
    listEntities<FamilyLine>('family-package-lines').then(setFamilyLines);
    listEntities<FamilyOrder>('orders').then(setFamilyOrders);
  }, []);
  // An accepted offer's plan is the first linked one of the offer's own kind that this customer may have (a nationality promotion is theirs only): a New
  // Prepaid offer takes a prepaid plan, every other offer a postpaid one. A linked product of another kind, a fixed-line or add-on product, or a plan of
  // another nationality, is never taken as the order's plan.
  const applyCrossSales = (setValue: (field: string, value: unknown) => void, v: CrossSalesValue) =>
    applyCrossSalesDecision(
      setValue,
      v,
      products.filter((p) => p.type === planKindOfOffer(v.journey) && isPlanOfferedTo(p, session.draftNationality))
    );
  return { ...session, existingCustomerId, WIZARD_ID, customerBenefits, products, familyLines, familyOrders, applyCrossSales };
}
