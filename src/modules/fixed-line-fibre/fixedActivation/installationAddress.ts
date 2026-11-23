import { AVAILABILITY_BUILDINGS, type AvailabilityBuilding, type AvailabilityUnit } from '../../../data/reference/serviceAvailabilityData';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';

/**
 * New Home Connection's Installation Address (asked after Number Selection for Fibre, after SIM Selection for FWA). Where the order came from Check RFS the address is not typed:
 *  - the selected KID names a unit in the RFS data (and, where UIM holds the KID, its service point), and the whole address is populated from them and cannot be edited;
 *  - with no KID (the agent searched a building and chose no unit) the address is captured manually: Zone, Street and Building come from the RFS check and cannot be edited, the Area is
 *    derived from them, and the agent gives the Unit / Apartment / Flat Number (mandatory) and may give Floor, PO Number, City, Country and an Address Description.
 */
export type HomeAddressValue = ZsbAddressValue & { city?: string; buildingName?: string };

/** A service point UIM holds for a KID (kid-service-points). */
export interface UimServicePoint {
  id: string;
  vfid?: string;
  zone?: string;
  street?: string;
  building?: string;
  city?: string;
  poBox?: string;
  country?: string;
  area?: string;
  addressLine?: string;
}

export type InstallationAddressSource =
  | { mode: 'populated'; source: 'RFS' | 'UIM'; kid: string; address: HomeAddressValue }
  | { mode: 'manual'; address: HomeAddressValue };

type Zsb = { zone?: string; streetNo?: string; buildingNo?: string };

/** The RFS building at a zone / street / building. */
export const buildingAt = (a: Zsb | undefined, buildings: readonly AvailabilityBuilding[] = AVAILABILITY_BUILDINGS): AvailabilityBuilding | undefined =>
  a?.zone && a.streetNo && a.buildingNo ? buildings.find((b) => b.zone === a.zone && b.street === a.streetNo && b.building === a.buildingNo) : undefined;

/** The Area the Zone, Street and Building determine (the RFS building's area); undefined when no building matches - never guessed. */
export const deriveArea = (a: Zsb | undefined, buildings: readonly AvailabilityBuilding[] = AVAILABILITY_BUILDINGS): string | undefined => buildingAt(a, buildings)?.area;

/** The RFS building and unit a KID names. */
export function unitOfKid(kid: string | undefined, buildings: readonly AvailabilityBuilding[] = AVAILABILITY_BUILDINGS): { building: AvailabilityBuilding; unit: AvailabilityUnit } | undefined {
  if (!kid) return undefined;
  for (const building of buildings) {
    const unit = building.units.find((u) => u.kid === kid);
    if (unit) return { building, unit };
  }
  return undefined;
}

/**
 * Where the address comes from. With a KID the RFS data names the unit, so the whole address is populated (and UIM adds what it holds - PO Number, City, Country - when it has the KID);
 * without one the address is captured manually from the Zone / Street / Building the RFS check gave.
 */
export function resolveInstallationAddress(values: Record<string, unknown>, uim: readonly UimServicePoint[] = [], buildings: readonly AvailabilityBuilding[] = AVAILABILITY_BUILDINGS): InstallationAddressSource {
  const kid = (values.rfsCheck as { kid?: string } | undefined)?.kid;
  const found = unitOfKid(kid, buildings);
  if (kid && found) {
    const { building, unit } = found;
    const point = uim.find((p) => p.id === kid && (!p.vfid || p.vfid === unit.vfid)) ?? uim.find((p) => p.id === kid);
    const address: HomeAddressValue = {
      zone: building.zone,
      streetNo: building.street,
      buildingNo: building.building,
      aptFlatUnit: unit.unit,
      floor: unit.floor,
      area: building.area,
      buildingName: building.name,
      kidLocationId: unit.kid,
      vodafoneId: unit.vfid,
      ...(point?.city ? { city: point.city } : {}),
      ...(point?.poBox ? { poBox: point.poBox } : {}),
      ...(point?.country ? { country: point.country } : {}),
      ...(point?.addressLine ? { addressLine: point.addressLine } : {}),
    };
    return { mode: 'populated', source: point ? 'UIM' : 'RFS', kid: kid, address };
  }
  const given = (values.address as HomeAddressValue | undefined) ?? {};
  return { mode: 'manual', address: { ...given, area: deriveArea(given, buildings) ?? given.area } };
}

/** Populated: nothing to ask. Manual: the Zone, Street and Building the RFS check gave, and the Unit / Apartment / Flat Number. */
export function isInstallationAddressValid(values: Record<string, unknown>): boolean {
  const resolved = resolveInstallationAddress(values);
  if (resolved.mode === 'populated') return true;
  const a = (values.address as HomeAddressValue | undefined) ?? {};
  return Boolean(a.zone && a.streetNo && a.buildingNo && a.aptFlatUnit?.trim());
}
