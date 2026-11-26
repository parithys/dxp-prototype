import { GTM_ADDRESSES, GTM_ZONES } from '../../data/synthetic/gtmData';
import { AVAILABILITY_BUILDINGS, DEVICE_ZERO_TOUCH, type AvailabilityBuilding, type AvailabilityStatusKey, type AvailabilityUnit } from '../../data/reference/serviceAvailabilityData';

// The pure half of the Check RFS Service Availability card: what the four search modes ask for, whether an entry is valid, and the lookup
// of an entry against the inventory. No React, no I/O - the card renders what these return.

export type SearchModeId = 'zsb' | 'kid' | 'vfid' | 'area';

export interface SearchField {
  id: string;
  label: string;
  required: boolean;
  /** Format hint shown inside the empty field. */
  watermark?: string;
  /** What a filled required field must match; absent = any non-empty text. */
  pattern?: RegExp;
  message?: string;
  numeric?: boolean;
  /** 'area' is the area choice, 'building' the building-name suggestions for that area, 'unit' the units of the building the zone / street / building numbers name. */
  kind?: 'area' | 'building' | 'unit';
  /** The field takes a barcode scan: a reader's output lands in it (the KID and VFID are on the premises' labels). */
  scan?: boolean;
}

export interface SearchMode {
  id: SearchModeId;
  title: string;
  subtitle: string;
  /** How the match is named under a found location ("Matched on ..."). */
  matchedOn: string;
  /** The fields sit in this many columns on a wide screen. */
  columns: 1 | 2 | 4;
  fields: SearchField[];
}

export const SEARCH_MODES: SearchMode[] = [
  { id: 'zsb', title: 'ZSB', subtitle: 'Zone, street & building', matchedOn: 'Zone / Street / Building', columns: 4, fields: [
    { id: 'zone', label: 'Zone Number', required: true, watermark: 'e.g. 55', numeric: true, pattern: /^\d{1,3}$/, message: 'Enter a zone number (1–3 digits).' },
    { id: 'street', label: 'Street Number', required: true, watermark: 'e.g. 830', numeric: true, pattern: /^\d{1,4}$/, message: 'Enter a street number (1–4 digits).' },
    { id: 'building', label: 'Building Number', required: true, watermark: 'e.g. 12', numeric: true, pattern: /^\d{1,4}$/, message: 'Enter a building number (1–4 digits).' },
    { id: 'unit', label: 'Unit / Flat (Optional)', required: false, kind: 'unit' },
  ] },
  { id: 'kid', title: 'KID', subtitle: 'Kahramaa ID', matchedOn: 'Kahramaa ID', columns: 1, fields: [
    { id: 'kid', label: 'Kahramaa ID (KID)', required: true, watermark: 'e.g. KID-12345678-001', scan: true, pattern: /^KID-\d{8}-\w{1,4}$/i, message: 'Use the format KID-########-###.' },
  ] },
  { id: 'vfid', title: 'VFID', subtitle: 'Vodafone ID', matchedOn: 'Vodafone ID', columns: 1, fields: [
    { id: 'vfid', label: 'Vodafone ID (VFID)', required: true, watermark: 'e.g. ABC-1234-A', scan: true, pattern: /^[A-Z]{3}-\d{4}-[A-Z]$/i, message: 'Use the format AAA-####-A.' },
  ] },
  { id: 'area', title: 'Area & Building', subtitle: 'Building name', matchedOn: 'Area & Building Name', columns: 2, fields: [
    { id: 'area', label: 'Area', required: true, kind: 'area' },
    { id: 'bname', label: 'Building Name', required: true, kind: 'building' },
  ] },
];

export type SearchValues = Record<string, string>;

export const modeById = (id: SearchModeId): SearchMode => SEARCH_MODES.find((m) => m.id === id) ?? SEARCH_MODES[0];

const trimmed = (values: SearchValues, id: string) => (values[id] ?? '').trim();

/** The message a filled field breaks, or undefined (an empty field has no message: the Check button just stays off). */
export function fieldError(field: SearchField, values: SearchValues): string | undefined {
  const v = trimmed(values, field.id);
  return v && field.pattern && !field.pattern.test(v) ? field.message : undefined;
}

/** Every required field is filled and matches its format. */
export function isSearchValid(mode: SearchMode, values: SearchValues): boolean {
  return mode.fields.every((f) => {
    if (!f.required) return true;
    const v = trimmed(values, f.id);
    return v !== '' && (!f.pattern || f.pattern.test(v));
  });
}

/** The areas the inventory covers, for the Area choice. */
export const availabilityAreas = (): string[] => [...new Set(AVAILABILITY_BUILDINGS.map((b) => b.area))].sort();

/** The building names to suggest, narrowed to the chosen area. */
export const buildingNames = (area: string | undefined): string[] => AVAILABILITY_BUILDINGS.filter((b) => !area || b.area === area).map((b) => b.name);

/** The Area Name, derived from the building's Zone Number (GTM's zone list); blank for a zone GTM does not know. */
export const areaNameOf = (b: Pick<AvailabilityBuilding, 'zone'>): string => GTM_ZONES[b.zone] ?? '';

/** The Building Name GTM holds for the address - for the flat when GTM has a record of its own for it, else for the building - or '' when it holds none. */
export function buildingNameOf(b: Pick<AvailabilityBuilding, 'zone' | 'street' | 'building'>, unit?: string): string {
  const at = (u: string | undefined) => GTM_ADDRESSES.find((x) => x.zone === b.zone && x.street === b.street && x.building === b.building && x.unit === u);
  return ((unit ? at(unit) : undefined) ?? at(undefined))?.name ?? '';
}

/** The KID of an address searched without a unit: built from its ZSB (zone, street, building, as the real KIDs are), with 0 where a unit's own suffix would be. It has no unit, floor or VFID of its own. */
const addressUnit = (b: AvailabilityBuilding): AvailabilityUnit => ({ unit: '', floor: '-', kid: `KID-${b.zone}${b.street}${b.building}0-0`, vfid: '-', state: 'Available', patch: null, sla: null });

/** The units to offer for the building the zone / street / building numbers name; none when no building in the inventory has those numbers. */
export const unitNames = (values: SearchValues): string[] =>
  AVAILABILITY_BUILDINGS.find((x) => x.zone === trimmed(values, 'zone') && x.street === trimmed(values, 'street') && x.building === trimmed(values, 'building'))?.units.map((u) => u.unit) ?? [];

export interface AvailabilityResult {
  status: AvailabilityStatusKey;
  building?: AvailabilityBuilding;
  units?: AvailabilityUnit[];
  /** Exactly one unit is in play (a KID / VFID hit, or a building with one unit): nothing to choose. */
  single?: boolean;
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();
const unitKey = (s: string) => norm(s).replace('villa ', '');

function findUnit(key: 'kid' | 'vfid', value: string | undefined): AvailabilityResult {
  for (const b of AVAILABILITY_BUILDINGS) {
    const u = b.units.find((x) => norm(x[key]) === norm(value));
    if (u) return { status: b.status, building: b, units: [u], single: true };
  }
  return { status: 'NOT_FOUND' };
}

/** Looks the entry up in the inventory. Nothing matching is NOT_FOUND - never assumed available. */
export function lookupAvailability(modeId: SearchModeId, values: SearchValues): AvailabilityResult {
  switch (modeId) {
    case 'zsb': {
      const b = AVAILABILITY_BUILDINGS.find((x) => x.zone === trimmed(values, 'zone') && x.street === trimmed(values, 'street') && x.building === trimmed(values, 'building'));
      if (!b) return { status: 'NOT_FOUND' };
      const wanted = trimmed(values, 'unit');
      // A unit chosen: the KID of that unit at this address (a unit the building does not have is not found, never replaced by another).
      // "-" (none): the address stands on its own - the ZSB alone is read, the unit is not considered, and the address gets a dummy KID.
      const units = wanted ? b.units.filter((u) => unitKey(u.unit) === unitKey(wanted)) : [addressUnit(b)];
      if (!units.length) return { status: 'NOT_FOUND' };
      return { status: b.status, building: b, units, single: units.length === 1 };
    }
    case 'kid':
      return findUnit('kid', values.kid);
    case 'vfid':
      return findUnit('vfid', values.vfid);
    case 'area': {
      const b = AVAILABILITY_BUILDINGS.find((x) => x.area === values.area && norm(x.name) === norm(values.bname));
      return b ? { status: b.status, building: b, units: b.units, single: b.units.length === 1 } : { status: 'NOT_FOUND' };
    }
  }
}

/**
 * What the Service Feasibility response says about the device already at a unit, and what UIM's mapping says that model can do:
 * none (the response names no device), not-reusable, zero-touch (reusable and the model supports it), no-zero-touch (reusable, the model does not), unknown-model (reusable, the model is not mapped).
 */
export type DeviceReuse = { status: 'none' } | { status: 'not-reusable' | 'zero-touch' | 'no-zero-touch' | 'unknown-model'; model: string };

export function deviceReuseOf(unit: Pick<AvailabilityUnit, 'device'>): DeviceReuse {
  const d = unit.device;
  if (!d) return { status: 'none' };
  if (!d.reusable) return { status: 'not-reusable', model: d.model };
  const zeroTouch = DEVICE_ZERO_TOUCH[d.model];
  return { status: zeroTouch === undefined ? 'unknown-model' : zeroTouch ? 'zero-touch' : 'no-zero-touch', model: d.model };
}

/** The tags the result puts beside the device model (Instant Activation where the model supports it; whether the device can be reused is not shown, as a tag or otherwise). */
export function deviceReuseTags(r: DeviceReuse): { label: string; tone: 'success' | 'info' | 'neutral' }[] {
  switch (r.status) {
    case 'none': return [];
    case 'zero-touch': return [{ label: 'Instant Activation', tone: 'info' }];
    // Neither Reusable nor Not Reusable is called out. Where the model is not mapped, Instant Activation is unknown and nothing is said about it.
    case 'not-reusable':
    case 'no-zero-touch':
    case 'unknown-model': return [];
  }
}

/** The warning the result shows when the feasibility response reports a problem with the splitter serving the unit; none when it reports nothing. */
export const SPLITTER_WARNING: Record<NonNullable<AvailabilityUnit['splitter']>, string> = { full: 'Splitter Full', 'not-mapped': 'Splitter Not Mapped' };
export const splitterWarningOf = (unit: Pick<AvailabilityUnit, 'splitter'>): string | undefined => (unit.splitter ? SPLITTER_WARNING[unit.splitter] : undefined);

/**
 * The demo shortcuts under the search fields: each names a scenario (one of the result categories) and, for the tab the agent is on, the entry that finds it in the inventory. A building is
 * taken from the inventory by its status, so the entry is never typed here; "Not Found" is an entry that matches nothing.
 */
export const DEMO_SCENARIOS: { label: string; status: AvailabilityStatusKey }[] = [
  { label: 'Fiber Unlimited', status: 'RFS_UNLIMITED' },
  { label: 'Fiber Limited', status: 'RFS_LIMITED' },
  { label: 'FWA Indoor', status: 'FWA_INDOOR' },
  { label: 'FWA Outdoor', status: 'FWA_OUTDOOR' },
  { label: 'FWA Indoor & Outdoor', status: 'FWA_BOTH' },
  { label: 'RFA', status: 'RFA' },
  { label: 'Not Found', status: 'NOT_FOUND' },
];

/** The search values that reach `status` on the given tab. */
export function demoScenarioValues(modeId: SearchModeId, status: AvailabilityStatusKey): SearchValues {
  const b = AVAILABILITY_BUILDINGS.find((x) => x.status === status);
  if (!b) {
    // Nothing in the inventory matches these (a building from another area for the Area tab).
    const other = AVAILABILITY_BUILDINGS[0];
    const another = AVAILABILITY_BUILDINGS.find((x) => x.area !== other.area) ?? other;
    return { zsb: { zone: '12', street: '345', building: '6' }, kid: { kid: 'KID-99999999-1' }, vfid: { vfid: 'ZZZ-9999-Z' }, area: { area: another.area, bname: other.name } }[modeId];
  }
  switch (modeId) {
    case 'zsb': return { zone: b.zone, street: b.street, building: b.building };
    case 'kid': return { kid: b.units[0].kid };
    case 'vfid': return { vfid: b.units[0].vfid };
    case 'area': return { area: b.area, bname: b.name };
  }
}

/** What a barcode reader would read into a KID or VFID field: an identifier from the inventory (simulated - there is no scanner hardware here). */
export function scanSample(field: 'kid' | 'vfid'): string {
  const all = AVAILABILITY_BUILDINGS.flatMap((b) => b.units.map((u) => u[field]));
  return all[Math.floor(Math.random() * all.length)];
}
