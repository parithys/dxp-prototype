import type { NumberPickerProfile, NumberTab } from '../../../components/domain/msisdnPickerModel';
// Fixed Activation Journey (CBU): ids and value shapes. Kept apart from the New Connection model on purpose -
// the two journeys share components, never state: their drafts, customer holds and route entries are separate.

export const FIXED_WIZARD_ID = 'fixed-activation-cbu';
export const FIXED_JOURNEY_LABEL = 'Fixed Activation (CBU)';

export type FixedServiceType = 'fiber' | 'fwa-indoor' | 'fwa-outdoor';

export const FIXED_SERVICE_TYPES: { value: FixedServiceType; label: string; note: string }[] = [
  { value: 'fiber', label: 'Fiber', note: 'Requires the location to be RFS (Ready For Service).' },
  { value: 'fwa-indoor', label: 'FWA Indoor', note: '5G indoor unit, installed by the customer or a technician.' },
  { value: 'fwa-outdoor', label: 'FWA Outdoor', note: '5G outdoor unit, installed on site.' },
];

export const serviceTypeLabel = (t: unknown) => FIXED_SERVICE_TYPES.find((s) => s.value === t)?.label;

export type FixedRfsStatus = 'rfs' | 'not-rfs' | 'unknown';

/** What the Installation Address step records under values.installation. */
export interface FixedInstallationValue {
  serviceType?: FixedServiceType;
  rfs?: FixedRfsStatus;
}

/**
 * The Fixed Line Number picker (New Home Connection): the Fixed Line Number pool, not the mobile numbers, with no Star numbers, lock-in or plan entitlement. The tabs an agent sees follow their
 * role: Reserved (held against the customer's ID), Free, and Blocked (against the agent's user group - listed only when they search). MOCK persona simulation, as for Prepaid: Mass Market sees Free
 * only; the business owns the final role-to-tab map. A role not listed sees all three.
 */
/** 5G Home (FWA): the order is an FWA Indoor or FWA Outdoor service (as the RFS result settled it), so it takes a SIM and an Indoor Unit. Fibre and fixed line take neither. */
export const isFwaService = (values: Record<string, unknown>): boolean => {
  const t = (values.installation as FixedInstallationValue | undefined)?.serviceType;
  return t === 'fwa-indoor' || t === 'fwa-outdoor' || values.homeProduct === 'fwa';
};

/** An Indoor Unit as the inventory (cpe-devices) holds it. */
export interface IndoorUnitDetails {
  serialNumber: string;
  brand?: string;
  modelNumber?: string;
  deviceType: string;
  macAddress?: string;
  firmwareVersion?: string;
  stockStatus: string;
}
export const INDOOR_UNIT_DEVICE_TYPE = 'Indoor IDU';
const IN_STOCK = 'In-Stock';

/** The serial as the agent typed or scanned it: trimmed, upper case. */
export const normaliseIndoorUnitSerial = (serial: string): string => serial.trim().toUpperCase();

export type IndoorUnitCheck = { ok: true; details: IndoorUnitDetails } | { ok: false; error: string };

/** Whether a serial is an Indoor Unit in stock: it must be in the inventory, be an Indoor Unit (not another device) and not already assigned. */
export function checkIndoorUnitSerial(serial: string, devices: readonly IndoorUnitDetails[]): IndoorUnitCheck {
  const s = normaliseIndoorUnitSerial(serial);
  if (!s) return { ok: false, error: 'Indoor Unit Serial Number is required.' };
  const found = devices.find((d) => d.serialNumber.toUpperCase() === s);
  if (!found) return { ok: false, error: 'Indoor Unit Serial Number not found in inventory.' };
  if (found.deviceType !== INDOOR_UNIT_DEVICE_TYPE) return { ok: false, error: `This serial is a ${found.deviceType}, not an Indoor Unit.` };
  if (found.stockStatus !== IN_STOCK) return { ok: false, error: `This Indoor Unit is already assigned (${found.stockStatus}).` };
  return { ok: true, details: found };
}

/** The Indoor Units in stock, which a barcode scan can return. */
export const indoorUnitsInStock = (devices: readonly IndoorUnitDetails[]): IndoorUnitDetails[] => devices.filter((d) => d.deviceType === INDOOR_UNIT_DEVICE_TYPE && d.stockStatus === IN_STOCK);

/** The order's Indoor Unit is complete when the serial in the field is one the inventory check accepted. */
export const isIndoorUnitValid = (values: Record<string, unknown>): boolean => {
  const unit = values.indoorUnit as IndoorUnitDetails | undefined;
  const serial = values.indoorUnitSerial;
  return Boolean(unit) && typeof serial === 'string' && normaliseIndoorUnitSerial(serial) === unit!.serialNumber.toUpperCase();
};

export const FIXED_NUMBER_TABS_BY_ROLE: Record<string, readonly NumberTab[]> = {
  'ROLE-05': ['Free'],
};
export const fixedNumberTabsFor = (roleId: string): readonly NumberTab[] => FIXED_NUMBER_TABS_BY_ROLE[roleId] ?? ['Reserved', 'Free', 'Blocked'];
/**
 * The Fixed Line Number picker: Reserved, Free and Blocked where the customer has a number reserved (`withReserved`, opening on Reserved), otherwise Free and Blocked; never Star.
 * `chooseHeld`: the reserved number is chosen for the agent when the picker opens (the step opened with no number), not when the agent comes back to change one.
 */
export const fixedNumberPicker = (withReserved: boolean, chooseHeld: boolean = withReserved): NumberPickerProfile => ({
  pool: 'fixed-line-numbers',
  tabsFor: (roleId) => fixedNumberTabsFor(roleId).filter((t) => withReserved || t !== 'Reserved'),
  lockIn: false,
  planEntitlement: false,
  // Opened for a customer with a reserved number: that number is chosen for the agent. Coming back to change a number never swaps it for a held one.
  selectHeld: withReserved && chooseHeld,
});

export const FIXED_NUMBER_PICKER: NumberPickerProfile = fixedNumberPicker(true);

/** A Fixed Line Number the system allocated (none was reserved for the customer): Continue passes over Number Selection, which the agent can still open to view or change it. */
export const isFixedNumberAutoAllocated = (values: Record<string, unknown>): boolean => values.msisdnSource === 'auto' && Boolean(values.msisdn);

export interface FixedDevice {
  name: string;
  serial: string;
}

/** CPE sent with the order, by service type (and a set-top box when the plan carries TV). */
export function devicesFor(serviceType: FixedServiceType | undefined, withTv: boolean): FixedDevice[] {
  const rnd = () => `SN${Math.floor(1e7 + Math.random() * 9e7)}`;
  const list: FixedDevice[] = [];
  if (serviceType === 'fiber') list.push({ name: 'Fibre ONT + Wi-Fi router', serial: rnd() });
  if (serviceType === 'fwa-indoor') list.push({ name: '5G indoor CPE', serial: rnd() });
  if (serviceType === 'fwa-outdoor') list.push({ name: '5G outdoor CPE', serial: rnd() });
  if (withTv) list.push({ name: 'GigaHome TV set-top box', serial: rnd() });
  return list;
}

/**
 * Whether the home product chosen on New Home Connection's Product Selection can go on from the address already given: Fibre needs a location read as RFS, FWA needs its Indoor / Outdoor
 * service type, Fixed-Line and 5G Home need nothing more.
 */
export function homeInstallationReady(values: Record<string, unknown>): boolean {
  const installation = values.installation as FixedInstallationValue | undefined;
  if (values.homeProduct === 'fibre') return installation?.serviceType === 'fiber' && installation.rfs === 'rfs';
  if (values.homeProduct === 'fwa') return Boolean(installation?.serviceType);
  return true;
}
