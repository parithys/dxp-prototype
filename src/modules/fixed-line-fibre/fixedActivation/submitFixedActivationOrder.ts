import { storedAddressLine } from '../../../components/patterns/addressFromBilling';
import { representativeAttachments, representativeConfirmation, representativeOrderFields } from '../../new-connection/representativeOrder';
import { accountTypeForJourney } from '../../../engines/creditLimit';
import { saveLinkedIdDocument } from '../../new-connection/saveLinkedIdDocument';
import { contactIdentityOrderFields } from '../../new-connection/contactIdentityOrderFields';
import { saveCustomerSalutation } from '../../new-connection/saveCustomerSalutation';
import { idScanAttachments } from '../../new-connection/idScanAttachments';
import { COLLECTION_TEAM_ROLE, emailVerification, maskEmail, persistBillingAccount } from '../../../capabilities';
import { orderTerms, primaryContactMobile } from '../../../capabilities';
import { decisionRecord, needsCreditControl } from '../../../engines/connectionEligibility';
import type { GuidedContactValue } from '../../../capabilities';
import { assertEligibilityChecked } from '../../../engines/eligibilityGuard';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { BillingAccountValue } from '../../../capabilities';
import type { CheckoutTotals } from '../../../components/patterns/checkoutSummaryModel';
import type { WinCashPaymentValue } from '../../../components/patterns/WinCashPaymentStep';
import { isFutureDated } from '../../../capabilities';
import type { AppointmentBookingValue } from '../../../capabilities';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { logActivity, newActivityId } from '../../../engines/activityEngine';
import type { ActivityInput } from '../../../engines/activityEngine';

import type { CustomerTypeValue } from '../../../capabilities';
import type { ConfirmedOrder } from '../../../capabilities';
import { isB2B2COrder } from '../../new-connection/approvalRouting';
import { homeProductLabel } from '../../new-connection/products';
import type { HomeProduct } from '../../new-connection/products';
import { billingAddressLine } from '../../../engines/billingAddress';
import { extenderCharge, type HomeExtendersSelection } from '../../../engines/homeExtenders';
import { FIXED_JOURNEY_LABEL, isFwaService, serviceTypeLabel, type FixedInstallationValue } from './fixedActivationModel';
import { currentAgentId } from '../../../stores/currentAgent';
import { orderInProgressForKid, type ExistingConnection, type ExistingService } from '../../../engines/kidInUse';
import type { EntityOps } from '../../../services/types';
import { listEntities } from '../../../services/entityOps';
import { activationModeOf, validatedDevices } from './activationMode';

/** The team that decides an order replacing a connection on a KID in use (the job title the approval queue knows it by). */
const FULFILMENT_TEAM_ROLE = 'Back Office Fulfilment';

type EntityStore = EntityOps;

/**
 * Submits a Fixed Activation (CBU) order: writes the order and its installation appointment, records the
 * Completed activity (plus a workflow event when the order is held for approval) and builds the order-submitted
 * screen's content. Held for approval when eligibility routed it there, the identity was typed in by hand, or the
 * customer is B2B2C.
 */

/**
 * Submits a Fixed Activation (CBU) order: writes the order and its installation appointment, records the
 * Completed activity (plus a workflow event when the order is held for approval) and builds the order-submitted
 * screen's content. Held for approval when eligibility routed it there, the identity was typed in by hand, or the
 * customer is B2B2C.
 */
export async function submitFixedActivationOrder(
  values: Record<string, unknown>,
  { createRecord, updateRecord }: Pick<EntityStore, 'createRecord'> & Partial<Pick<EntityStore, 'updateRecord'>>
): Promise<ConfirmedOrder> {
  const contact = values.contact as GuidedContactValue;
  assertEligibilityChecked(values);
  const eligibility = values.eligibility as EligibilityResult | undefined;
  const installation = values.installation as FixedInstallationValue | undefined;
  const address = values.address as ZsbAddressValue | undefined;
  // Instant Activation has no installation appointment (the devices are scanned in the journey); a Field Engineer order books one.
  const appointment = values.appointment as AppointmentBookingValue | undefined;
  const activationMode = activationModeOf(values);
  const billingAccount = values.billingAccount as BillingAccountValue | undefined;
  const payment = values.payment as WinCashPaymentValue | undefined;
  const totals = values.checkoutTotals as CheckoutTotals | undefined;
  const products = await listEntities<{ productId: string; name: string; mrcQAR: number }>('products');
  const plan = products.find((p) => p.productId === values.productId);

  const manualIdEntry = Boolean(contact.manualEntry);
  const approvalChecks = eligibility?.checks.filter((c) => c.outcome === 'approval-routing') ?? [];
  const customerType = values.customerType as CustomerTypeValue | undefined;
  // The KID chosen on Check RFS: recorded on the order (a second order cannot start on a KID that has one in progress). A KID that still carried a service (Active or Suspended) when the agent
  // proceeded: the order replaces that connection, so it goes to the Fulfilment Team for approval, and once approved the existing connection is disconnected and its inventory released.
  const rfsCheck = values.rfsCheck as { kid?: string; kidInUse?: ExistingService } | undefined;
  const kidInUse = rfsCheck?.kid && rfsCheck.kidInUse ? rfsCheck.kidInUse : undefined;
  // Judged again at submission (another order may have been submitted for the KID since Check RFS): a KID with an order in progress takes no second one, whoever it is for.
  const blocking = orderInProgressForKid(await listEntities<{ orderId: string; kid?: string; status?: string }>('orders'), rfsCheck?.kid);
  if (blocking) throw new Error(`Order ${blocking.orderId} is already in progress for ${rfsCheck?.kid}. A new order cannot be placed on this KID until it is decided.`);
  const pendingApproval = manualIdEntry || isB2B2COrder(contact, customerType) || Boolean(eligibility?.requiresHrnAdvance) || approvalChecks.length > 0 || Boolean(kidInUse);

  // A customer with no billing account gets the one the journey built, created and set as their default.
  const billingProfileId = await persistBillingAccount(billingAccount, {
    createRecord,
    updateRecord,
    kind: accountTypeForJourney('fixed-line'),
    customerId: eligibility?.customerId,
    idNumber: contact.idNumber,
    contactName: contact.moiResult?.name,
    contactEmail: contact.email,
    contactPhone: primaryContactMobile(contact),
    // The credit limit rules apply to a fixed-line account as to any other new account: the default for the customer, the agent's choice from the card.
    creditLimitQar: eligibility?.defaultCreditLimitQar,
    nationality: eligibility?.nationality,
    segment: eligibility?.segment,
    agentId: currentAgentId() ?? undefined,
    // A new account's bill goes to the Installation Address (in full) unless the agent gave another.
    addressLine: billingAddressLine(address) ?? storedAddressLine(address),
  });

  const orderId = `ORD-${Date.now().toString().slice(-6)}`;
  // The salutation the agent entered is saved to the customer's profile (shown in Customer 360).
  await saveCustomerSalutation(eligibility?.customerId, contact.salutation, updateRecord);
  // A QID linked to an existing customer through their Passport is added to that customer's documents (no duplicate customer).
  await saveLinkedIdDocument(contact.moiResult?.linkedIdUpdate, createRecord);
  await createRecord('orders', {
    orderId,
    orderType: 'New Fixed Line Activation',
    orderSubType: isB2B2COrder(contact, customerType) ? 'B2B2C' : 'Consumer',
    customerType: customerType?.type,
    companyName: customerType?.type === 'b2b2c' ? customerType.company?.companyName : undefined,
    createdAt: new Date().toISOString(),
    status: pendingApproval ? 'Submitted for Approval' : 'Complete',
    customerName: contact.moiResult?.name,
    customerId: eligibility?.customerId,
    idNumber: contact.idNumber,
    customerEmail: contact.email,
    customerSalutation: contact.salutation,
    ...contactIdentityOrderFields(contact),
    customerWorkEmail: contact.workEmail,
    // A new customer's National Address as the NAS returned it: kept with the order, unchanged; the address the customer gave is `address`.
    nationalAddress: contact.moiResult?.nationalAddress,
    // The identity document captured at Customer Verification, as scanned or uploaded.
    attachments: [...idScanAttachments(contact.idType, contact.qidScans, { idNumber: contact.idNumber }), ...representativeAttachments(values)],
    ...representativeOrderFields(values),
    // Which home product was sold (Fibre, Fixed-Line, FWA, 5G Home); the service type below is what the installation uses.
    homeProduct: homeProductLabel(values.homeProduct as HomeProduct | undefined),
    serviceType: serviceTypeLabel(installation?.serviceType),
    installationAddress: address,
    productId: values.productId,
    // The discount the agent gave on the plan (Standard Plans or Special Offers), if any.
    ...(values.discountId ? { discountId: values.discountId } : {}),
    // The plan's add-ons the agent chose (plan-bound add-on records of the home plan); none for an Offers-tab plan.
    addonIds: (values.addonIds as string[] | undefined) ?? [],
    // The IPTV choice, when IPTV is on: the bundle (also in addonIds), the set-top box and the additional boxes.
    ...(values.iptv && (values.iptv as { enabled?: boolean }).enabled ? { iptv: values.iptv } : {}),
    msisdn: values.msisdn,
    devices: values.devices,
    // Wi-Fi Extenders the customer asked for: the quantity, how many the plan included free, and the chargeable units with how they are billed.
    ...(extendersOf(values) ? { extenders: extendersOf(values) } : {}),
    activationMode,
    // Instant Activation: the devices scanned and validated into the cart.
    ...(activationMode === 'instant' ? { scannedDevices: validatedDevices(values).map(({ row, device }) => ({ device: row.label.replace(' Serial Number', ''), serial: device.serial, brand: device.brand, model: device.model })) } : {}),
    // 5G Home (FWA): the Physical SIM allocated to the order and the Indoor Unit's serial number the agent captured.
    ...(isFwaService(values)
      ? {
          simType: (values.simType as { simType?: string } | undefined)?.simType ?? 'Physical',
          simSerial: (values.simType as { simSerial?: string } | undefined)?.simSerial,
          simIccid: (values.simType as { simIccid?: string } | undefined)?.simIccid,
          indoorUnitSerial: (values.indoorUnit as { serialNumber?: string } | undefined)?.serialNumber,
          indoorUnitBrand: (values.indoorUnit as { brand?: string } | undefined)?.brand,
          indoorUnitModel: (values.indoorUnit as { modelNumber?: string } | undefined)?.modelNumber,
        }
      : {}),
    billingProfileId,
    newBillingProfileName: billingAccount?.newAccount?.profileName,
    dueTodayQAR: totals?.dueTodayQar ?? 0,
    monthlyRecurringQAR: plan?.mrcQAR ?? 0,
    ...decisionRecord(eligibility?.connectionDecision),
    ...(needsCreditControl(eligibility?.connectionDecision) ? { approverRole: COLLECTION_TEAM_ROLE } : {}),
    // The Fulfilment Team decides an order that replaces a connection on a KID in use (it wins over the other routes: it is the one that disconnects the existing service).
    ...(kidInUse ? { approverRole: FULFILMENT_TEAM_ROLE } : {}),
    ...(rfsCheck?.kid ? { kid: rfsCheck.kid } : {}),
    ...(kidInUse && rfsCheck?.kid ? { existingConnection: { ...kidInUse, kid: rfsCheck.kid, state: 'To Be Disconnected' } satisfies ExistingConnection } : {}),
    approvalReason: pendingApproval
      ? [manualIdEntry ? 'Identity manually entered' : '', kidInUse ? `KID in use: ${kidInUse.status} service ${kidInUse.fln} on ${kidInUse.pon}` : '', ...approvalChecks.map((c) => c.message?.split('\n')[0] ?? c.id)].filter(Boolean).join(' | ') || undefined
      : undefined,
    createdBy: currentAgentId(),
    sourceChannel: 'Tablet',
  });
  if (appointment) {
    await createRecord('appointments', {
      appointmentId: `APT-${Date.now().toString().slice(-6)}`,
      orderId,
      status: 'pending',
      appointmentDate: appointment.date,
      timeSlot: appointment.timeSlot,
      cluster: appointment.cluster,
      channel: 'Retail Store',
      notes: appointment.comments,
      // What the technician collects at the visit, and the customer's own request for a specific date and time (a later date than the
      // earliest makes the order future-dated).
      documentsToCollect: appointment.documents ?? [],
      ...(appointment.requestSpecific ? { requestedDate: appointment.requestedDate, requestedTime: appointment.requestedTime, futureDated: isFutureDated(appointment) } : {}),
    });
  }

  const activityCtx = { journey: FIXED_JOURNEY_LABEL, orderId, customerId: eligibility?.customerId, customerName: contact.moiResult?.name, idNumber: contact.idNumber };
  // The Completed activity is automatic and carries no comments; it is recorded when the agent hits Done & Exit.
  const activityId = newActivityId();
  const completionActivity: ActivityInput = {
    ...activityCtx,
    activityNumber: activityId,
    trigger: 'completed',
    reason: pendingApproval
      ? `Order ${orderId} submitted and is awaiting approval.`
      : appointment
        ? `Order ${orderId} submitted - installation booked for ${appointment.date} (${appointment.timeSlot})${payment?.reference ? `, WinCash ref ${payment.reference}` : ''}.`
        : `Order ${orderId} submitted - activated instantly, devices scanned in the journey${payment?.reference ? `, WinCash ref ${payment.reference}` : ''}.`,
  };
  if (pendingApproval) {
    await logActivity({ ...activityCtx, trigger: 'workflow-event', name: 'Order Routed for Approval', reason: 'Order requires approval before it can complete.' });
  }

  return {
    orderId,
    activityId,
    completionActivity,
    pendingApproval,
    customerName: contact.moiResult?.name ?? '-',
    ...representativeConfirmation(values),
    customerId: eligibility?.customerId,
    address,
    msisdn: (values.msisdn as string) ?? '-',
    planName: plan?.name ?? '-',
    dueTodayQar: totals?.dueTodayQar ?? 0,
    monthlyRecurringQar: plan?.mrcQAR ?? 0,
    customerEmail: contact.email,
    customerEmailDisplay: contact.moiResult?.isNewCustomer && !contact.moiResult?.createdByAgent && contact.email ? maskEmail(contact.email) : contact.email,
    customerEmailVerified: emailVerification(contact.email, contact.moiResult?.email, Boolean(contact.moiResult && !contact.moiResult.isNewCustomer)).verified,
    terms: orderTerms(values, 'postpaid'),
    service: 'fixed',
  };
}

/** The Wi-Fi Extenders on the order: the quantity, how many the plan included free, the chargeable units and how they are billed; none when the customer asked for none. */
function extendersOf(values: Record<string, unknown>) {
  const e = values.extenders as HomeExtendersSelection | undefined;
  if (!e || !(e.quantity > 0)) return undefined;
  const c = extenderCharge(e);
  return { quantity: e.quantity, free: c.free, chargeable: c.chargeable, billing: c.billing, unitPriceQAR: c.unitQAR };
}
