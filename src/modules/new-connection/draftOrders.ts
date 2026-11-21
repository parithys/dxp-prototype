/**
 * Draft Orders for the Mobile Postpaid Activation journey: after the customer is identified, the agent is offered the drafts THEY saved for THAT customer, to
 * resume one or to start a new Product Selection. A draft is an order with status 'Draft' (orders.json) that carries the journey's saved values and step; its
 * task (tasks.json, taskType 'Draft Order') carries who it is assigned to, when it last changed and the agent's comment.
 */
type Rec = Record<string, unknown>;

export interface DraftOrderRecord {
  orderId: string;
  orderType?: string;
  status?: string;
  customerId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  draftWizardId?: string;
  draftStepKey?: string;
  draftValues?: Rec;
}

export interface DraftTaskRecord {
  taskId: string;
  relatedOrderId?: string;
  assignedAgentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  draftComment?: string;
}

/** One draft as the agent sees it: what tells it apart from the others. Anything the draft does not carry is left undefined, never invented. */
export interface DraftOrderOption {
  orderId: string;
  orderType?: string;
  createdAt?: string;
  /** When it last changed: its task's update time, else its own, else when it was created. */
  modifiedAt?: string;
  /** The journey step the draft was saved on (the step key). */
  stepKey?: string;
  planId?: string;
  msisdn?: string;
  comment?: string;
  order: DraftOrderRecord;
}

/** The wizard whose drafts these are (the New Connection journey; Mobile Postpaid Activation runs inside it). */
export const NEW_CONNECTION_WIZARD_ID = 'new-connection';

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);

/** The customer a draft is for: stamped on the order, else the customer the journey had identified when it was saved. */
export function draftOrderCustomerId(o: DraftOrderRecord): string | undefined {
  return text(o.customerId) ?? text((o.draftValues?.eligibility as { customerId?: unknown } | undefined)?.customerId);
}

/** The agent who created a draft: stamped on the order, else the agent its task is assigned to (the same agent, written in the same save). */
export function draftOrderAgentId(o: DraftOrderRecord, tasks: DraftTaskRecord[]): string | undefined {
  return text(o.createdBy) ?? text(tasks.find((t) => t.relatedOrderId === o.orderId)?.assignedAgentId);
}

/** The order type a Mobile Postpaid Activation order carries (submitNewConnectionOrder), and the generic type of a New Connection draft saved before any product was chosen. */
export const POSTPAID_ORDER_TYPE = 'New Postpaid Activation';
export const UNDECIDED_ORDER_TYPE = 'New Connection';

/**
 * A Mobile Postpaid draft: the journey saved its product as Postpaid; or it saved none and the draft is a Postpaid order by its own type (an earlier draft
 * shape) or is still undecided (saved before Product Selection). A draft that names any other product, or an order type this journey does not write, is not.
 */
export function isPostpaidDraft(o: DraftOrderRecord): boolean {
  const product = o.draftValues?.product;
  if (product !== undefined) return product === 'postpaid';
  return o.orderType === POSTPAID_ORDER_TYPE || o.orderType === UNDECIDED_ORDER_TYPE;
}

/**
 * The drafts to offer: status Draft, from this journey, for THIS customer AND created by THIS agent, for Mobile Postpaid. A draft of another customer, or of the
 * same customer by another agent, is never offered. Newest change first.
 */
export function applicableDraftOrders(
  orders: DraftOrderRecord[],
  tasks: DraftTaskRecord[],
  who: { customerId: string | undefined; agentId: string | undefined }
): DraftOrderOption[] {
  if (!who.customerId || !who.agentId) return [];
  return orders
    .filter(
      (o) =>
        o.status === 'Draft' &&
        o.draftWizardId === NEW_CONNECTION_WIZARD_ID &&
        draftOrderCustomerId(o) === who.customerId &&
        draftOrderAgentId(o, tasks) === who.agentId &&
        isPostpaidDraft(o)
    )
    .map((o) => {
      const task = tasks.find((t) => t.relatedOrderId === o.orderId);
      const v = o.draftValues ?? {};
      return {
        orderId: o.orderId,
        orderType: text(o.orderType),
        createdAt: text(o.createdAt) ?? text(task?.createdAt),
        modifiedAt: text(task?.updatedAt) ?? text(o.updatedAt) ?? text(o.createdAt) ?? text(task?.createdAt),
        stepKey: text(o.draftStepKey),
        planId: text(v.productId),
        msisdn: text(v.msisdn),
        comment: text(task?.draftComment),
        order: o,
      };
    })
    .sort((a, b) => (b.modifiedAt ?? '').localeCompare(a.modifiedAt ?? ''));
}

/** What the journey identified at Customer Verification just now: it is not taken from the saved draft, which may be out of date (the customer was identified again). */
const FRESH_FROM_VERIFICATION = ['eligibility', 'customerType'] as const;

/**
 * The values a resumed journey holds: the draft's saved values, over what Customer Verification has already produced in this session. The identification
 * and the eligibility result are the fresh ones (the customer's status may have changed since the draft was saved); the contact details the agent added
 * earlier are kept under the fresh identification; everything else - the plan, add-ons, number, address ... - is the draft's.
 */
export function resumedDraftValues(saved: Rec, current: Rec, orderType?: string): Rec {
  const merged: Rec = { ...current, ...saved };
  merged.contact = { ...((saved.contact as Rec | undefined) ?? {}), ...((current.contact as Rec | undefined) ?? {}) };
  for (const key of FRESH_FROM_VERIFICATION) if (current[key] !== undefined) merged[key] = current[key];
  // A draft of an earlier shape, saved as a Postpaid order but without the product as a value of its own, is Postpaid; one saved before any product was chosen
  // stays undecided (the agent still chooses it).
  if (merged.product === undefined && orderType === POSTPAID_ORDER_TYPE) merged.product = 'postpaid';
  return merged;
}
