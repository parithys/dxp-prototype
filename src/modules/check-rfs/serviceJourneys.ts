import { PRODUCT_LINES, type Journey } from '../../navigation/journeyCatalogue';
import { resolveJourneyTarget } from '../../navigation/journeyTarget';
import type { ServiceKey } from '../../data/reference/serviceAvailabilityData';

// Which journey each available service starts from the Service Availability result. These are the catalogue's own journeys (New Home Connection covers
// fibre, fixed line, FWA and 5G Home; New Connection is the mobile one), so the entry point, feature gate and path are read from the catalogue, never restated.
const START_JOURNEY: Record<ServiceKey, string> = { fibre: 'fib-new-home', fwa: 'fib-new-home', mbb: 'mob-new-connection' };

export interface ServiceStart {
  journey: Journey;
  to: string;
}

/** The journey a service starts and where it leads; undefined when the catalogue has no such journey or no working entry for it. */
export function serviceStart(service: ServiceKey): ServiceStart | undefined {
  const journey = PRODUCT_LINES.flatMap((l) => l.categories.flatMap((c) => c.journeys)).find((j) => j.id === START_JOURNEY[service]);
  const to = journey && resolveJourneyTarget(journey);
  return journey && to ? { journey, to } : undefined;
}
