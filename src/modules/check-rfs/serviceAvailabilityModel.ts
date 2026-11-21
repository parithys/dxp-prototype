import { AVAILABILITY_BUILDINGS, type AvailabilityBuilding, type AvailabilityStatusKey, type AvailabilityUnit } from '../../data/reference/serviceAvailabilityData';

// The pure half of the Check RFS Service Availability card: what the four search modes ask for, whether an entry is valid, and the lookup
// of an entry against the inventory. No React, no I/O - the card renders what these return.

export type SearchModeId = 'zsb' | 'kid' | 'vfid' | 'area';

export interface SearchField {
  id: string;
  label: string;
  required: boolean;
  hint?: string;
  /** What a filled required field must match; absent = any non-empty text. */
  pattern?: RegExp;
  message?: string;
  numeric?: boolean;
  /** 'area' is the area choice, 'building' the building-name suggestions for that area. */
  kind?: 'area' | 'building';
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
    { id: 'zone', label: 'Zone Number', required: true, numeric: true, pattern: /^\d{1,3}$/, message: 'Enter a zone number (1–3 digits).' },
    { id: 'street', label: 'Street Number', required: true, numeric: true, pattern: /^\d{1,4}$/, message: 'Enter a street number (1–4 digits).' },
    { id: 'building', label: 'Building Number', required: true, numeric: true, pattern: /^\d{1,4}$/, message: 'Enter a building number (1–4 digits).' },
    { id: 'unit', label: 'Unit / Flat (Optional)', required: false },
  ] },
  { id: 'kid', title: 'KID', subtitle: 'Kahramaa ID', matchedOn: 'Kahramaa ID', columns: 1, fields: [
    { id: 'kid', label: 'Kahramaa ID (KID)', required: true, hint: 'Format: KID-########-###', pattern: /^KID-\d{8}-\w{1,4}$/i, message: 'Use the format KID-########-###.' },
  ] },
  { id: 'vfid', title: 'VFID', subtitle: 'Vodafone ID', matchedOn: 'Vodafone ID', columns: 1, fields: [
    { id: 'vfid', label: 'Vodafone ID (VFID)', required: true, hint: 'Format: AAA-####-A', pattern: /^[A-Z]{3}-\d{4}-[A-Z]$/i, message: 'Use the format AAA-####-A.' },
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
      let units = b.units;
      const wanted = trimmed(values, 'unit');
      if (wanted) {
        const hit = units.filter((u) => unitKey(u.unit) === unitKey(wanted));
        if (hit.length) units = hit;
      }
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
