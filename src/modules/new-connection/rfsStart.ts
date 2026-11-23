import type { AvailabilityStatusKey } from '../../data/reference/serviceAvailabilityData';
import type { FixedInstallationValue, FixedServiceType } from '../fixed-line-fibre/fixedActivation/fixedActivationModel';
import type { HomeProduct } from './products';
import type { ExistingService } from '../../engines/kidInUse';

// What Check RFS hands New Home Connection when the agent starts the connection from a result (the journey's start values), and what the journey makes of it.
// The result is the RFS read-out and the address in one: the journey takes both as given, so it asks for neither again (no Address page, no second RFS read).

/** The service Check RFS found sellable at the location, and where it is. */
export interface RfsHandOff {
  /** 'fibre' for an RFS location; 'fwa' for a 5G Home (FWA) one. */
  service: 'fibre' | 'fwa';
  status: AvailabilityStatusKey;
  /** For an FWA location that offers both: the type the agent chose. */
  fwaType?: 'Indoor' | 'Outdoor';
  buildingName?: string;
  kid?: string;
  vfid?: string;
  /** The service the chosen KID still carries (Active or Suspended) when the agent proceeded: a Tenancy Document is then collected and the order is approved by the Fulfilment Team. */
  kidInUse?: ExistingService;
  address: { zone: string; streetNo: string; buildingNo: string; aptFlatUnit?: string; city?: string };
}

/** What a result carries in the draft (values.rfsCheck): the journey's mark that Check RFS ran, and what it found. */
export type RfsCheckValue = Omit<RfsHandOff, 'address'>;

/** What a page that sends the agent to Check RFS wants the connection to start with (router state `homeStart`): the draft values it already holds, and the step to open at. */
export interface HomeStart {
  values: Record<string, unknown>;
  progressTo: number;
}

/** The `homeStart` a navigation carried. */
export const homeStartOf = (state: unknown): HomeStart | undefined => (state as { homeStart?: HomeStart } | null | undefined)?.homeStart;

/**
 * The FWA service type a result settles: FWA Indoor / Outdoor say it themselves; a location that offers both takes the agent's choice; anything else is unknown (never assumed),
 * and the journey then asks for it.
 */
export function fwaServiceTypeOf(h: Pick<RfsHandOff, 'status' | 'fwaType'>): FixedServiceType | undefined {
  if (h.status === 'FWA_INDOOR') return 'fwa-indoor';
  if (h.status === 'FWA_OUTDOOR') return 'fwa-outdoor';
  if (h.status === 'FWA_BOTH') return h.fwaType === 'Indoor' ? 'fwa-indoor' : h.fwaType === 'Outdoor' ? 'fwa-outdoor' : undefined;
  return undefined;
}

/** The home product a result names: Fibre where fibre is sold, FWA where 5G Home (FWA) is. */
export const homeProductOfRfs = (service: RfsHandOff['service']): HomeProduct => (service === 'fibre' ? 'fibre' : 'fwa');

/** The draft values a result sets: the address as given, the product and its service type, and the RFS verdict already in (so Fibre needs no second read). */
export function rfsDraftValues(h: RfsHandOff): Record<string, unknown> {
  const installation: FixedInstallationValue = h.service === 'fibre' ? { serviceType: 'fiber', rfs: 'rfs' } : { serviceType: fwaServiceTypeOf(h) };
  const { address: _address, ...check } = h;
  return {
    // The check's `city` is the building's area: it is the address's Area, not its (optional) City.
    address: { zone: h.address.zone, streetNo: h.address.streetNo, buildingNo: h.address.buildingNo, aptFlatUnit: h.address.aptFlatUnit, area: h.address.city },
    product: 'fixed-line',
    homeProduct: homeProductOfRfs(h.service),
    installation,
    rfsCheck: check satisfies RfsCheckValue,
  };
}

/** The offers that fit the service Check RFS found: Fibre's are the fixed-line (fibre) offers, 5G Home's the FWA ones. */
export const offerJourneyOfRfs = (service: RfsHandOff['service']): 'new-fixed-line' | 'new-fwa' => (service === 'fibre' ? 'new-fixed-line' : 'new-fwa');

/**
 * New Home Connection began from Check RFS (its result is in the draft) or from a New Home offer sent there: the Address page and the product cards are not asked, because the
 * check named both. True the moment the offer is chosen, before the result arrives, so the pages do not flicker.
 */
export const rfsStarted = (values: Record<string, unknown>): boolean => Boolean(values.rfsCheck || values.offerCarried);
