import { listEntities } from '../services/entityOps';

// Whether a customer's location can be served by fibre (RFS = Ready For Service), read from the customer's own address
// and the service-point records (kid-service-points.json). 'unknown' when the customer has no address on file or no
// service point matches it - never assumed either way.

export type FibreServiceability = 'rfs' | 'not-rfs' | 'unknown';

export interface AddressParts {
  zone?: string;
  streetNo?: string;
  buildingNo?: string;
  aptFlatUnit?: string;
}

interface ServicePoint {
  zone?: string;
  street?: string;
  building?: string;
  addressLine?: string;
  rfsStatus?: string;
}
interface AccountAddress extends AddressParts {
  customerId?: string;
  primaryStatus?: string;
}

const digits = (s: string | undefined) => (s ?? '').match(/\d+/g)?.pop();
const filled = (a: AddressParts | undefined): a is AddressParts => Boolean(a?.zone && a.streetNo && a.buildingNo);

export async function resolveFibreServiceability(customerId: string | undefined, entered?: AddressParts): Promise<FibreServiceability> {
  let address: AddressParts | undefined = filled(entered) ? entered : undefined;
  if (!address && customerId) {
    const all = await listEntities<AccountAddress>('addresses');
    const mine = all.filter((a) => a.customerId === customerId);
    address = mine.find((a) => a.primaryStatus === 'Primary' && filled(a)) ?? mine.find(filled);
  }
  if (!address) return 'unknown';
  const points = await listEntities<ServicePoint>('kid-service-points');
  let match = points.filter((p) => p.zone === address.zone && digits(p.street) === address.streetNo && digits(p.building) === address.buildingNo);
  const unit = address.aptFlatUnit?.trim().toLowerCase();
  if (unit) match = match.filter((p) => (p.addressLine ?? '').toLowerCase().includes(unit));
  if (match.length === 0) return 'unknown';
  return match.some((p) => p.rfsStatus === 'RFS') ? 'rfs' : 'not-rfs';
}

/**
 * The serviceability of the location an order was placed from, for the offer on the confirmation page: the address entered in the journey or the customer's own on file
 * (resolveFibreServiceability) and, when neither identifies a service point, the National Address the registry (NAS) holds for a customer who has no record yet. The
 * National Address is only read here, to judge the location; it is never shown to the agent or used to fill an address. Still 'unknown' when nothing matches.
 */
export async function resolveLocationServiceability(customerId: string | undefined, entered: AddressParts | undefined, national: AddressParts | undefined, idNumber?: string): Promise<FibreServiceability> {
  // A walk-in journey carries no customer id even when the presented ID belongs to a customer: that customer's address on file still says where the location is.
  let owner = customerId;
  if (!owner && idNumber) {
    const docs = await listEntities<{ customerId?: string; documentNumber?: string }>('identity-documents');
    owner = docs.find((d) => d.documentNumber === idNumber && d.customerId)?.customerId;
  }
  const own = await resolveFibreServiceability(owner, entered);
  if (own !== 'unknown' || !filled(national)) return own;
  return resolveFibreServiceability(undefined, national);
}
