// A KID (the Kahramaa ID of a unit) that already carries a service, or already has an order on its way. New Home Connection asks the agent to proceed or cancel when the KID is in use,
// collects a Tenancy Document, sends the order to the Fulfilment team and, once approved, disconnects the existing connection and releases its inventory; and it never lets a second order
// start on a KID that has one in progress, whoever the customer is. Pure: reads the unit and the orders given.

/** The service a unit already has, as the Service Feasibility response reports it. */
export interface ExistingService {
  /** The service's fixed line number. */
  fln: string;
  status: 'Active' | 'Suspended';
  /** The PON (passive optical network) port the service is on. */
  pon: string;
}

/** What an order records of the connection it will replace: kept from submission, finished on approval. */
export interface ExistingConnection extends ExistingService {
  kid: string;
  /** 'To Be Disconnected' from submission; 'Disconnected' once the order is approved and the connection is gone. */
  state: 'To Be Disconnected' | 'Disconnected';
  /** The inventory released with the disconnection (set on approval). */
  releasedInventory?: string[];
}

/** The inventory an approved disconnection releases, across the components that hold it. */
export const RELEASED_INVENTORY = ['KID', 'PON port', 'Fixed line number', 'Fibre ONT / CPE', 'Billing service record'] as const;

/** An order on its way: submitted and not yet decided or completed. A draft is not (it is not an order until it is submitted). */
export const ORDER_IN_PROGRESS_STATUSES: ReadonlySet<string> = new Set(['Submitted for Approval', 'Missing Information', 'Pending', 'Open', 'In Progress']);

interface OrderLike {
  orderId: string;
  kid?: string;
  status?: string;
  existingConnection?: { kid?: string; state?: string };
}

/** The order already in progress for this KID, whoever it is for (the same customer or another), or undefined. */
export function orderInProgressForKid(orders: readonly OrderLike[], kid: string | undefined, exceptOrderId?: string): OrderLike | undefined {
  if (!kid) return undefined;
  return orders.find((o) => o.orderId !== exceptOrderId && o.kid === kid && ORDER_IN_PROGRESS_STATUSES.has(o.status ?? ''));
}

/** The service still on this unit's KID: reported by the feasibility response and not yet disconnected by an approved order. */
export function kidInUseOf(unit: { kid: string; existingService?: ExistingService }, orders: readonly OrderLike[]): ExistingService | undefined {
  if (!unit.existingService) return undefined;
  const gone = orders.some((o) => o.existingConnection?.kid === unit.kid && o.existingConnection.state === 'Disconnected');
  return gone ? undefined : unit.existingService;
}
