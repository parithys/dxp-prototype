import { store } from '../../../stores/store';
import { canScanDevices, isRetailPersona } from '../../../engines/agentPrivilegeEngine';
import { extraStbCount, asksAdditionalStbs, type HomeIptvSelection } from '../../../engines/homeIptv';
import { SCAN_DEVICE_LABEL, type ScanDeviceKind } from '../../../data/reference/deviceScanMock';
import type { FixedInstallationValue } from './fixedActivationModel';

// New Home Connection's activation mode and what it decides (front-end prototype; nothing here calls RFS, UIM, WFM or an inventory service).
//
//   Service type | Instant Activation          | Field Engineer
//   Fiber        | scan the ONT; no SIM        | installation appointment; the field engineer scans
//   FWA Indoor   | scan CPE / STB / Mesh + SIM | installation appointment; the field engineer scans
//   FWA Outdoor  | (never offered)             | installation appointment; the field engineer scans
//
// The mode is chosen on Check RFS (its Activate / Field Engineer buttons) and kept in the draft as `activationMode`; a journey started any other way has none, which is Field Engineer.

export type ActivationMode = 'instant' | 'field';

const activePersona = () => store.getState().persona.activePersonaId;

/** The service type the order is for, as Check RFS or Product Selection recorded it. */
export const serviceTypeOfOrder = (values: Record<string, unknown>): FixedInstallationValue['serviceType'] => (values.installation as FixedInstallationValue | undefined)?.serviceType;

/** Fiber and FWA Indoor may be activated instantly; FWA Outdoor (and a service type not yet known) may not. */
export const serviceAllowsInstantActivation = (serviceType: FixedInstallationValue['serviceType']): boolean => serviceType === 'fiber' || serviceType === 'fwa-indoor';

/**
 * The mode the journey runs in. Instant only when it was asked for, the service type allows it and the role may scan (`device-scan`): a role that cannot scan has nothing to do in an instant
 * journey, so it runs as Field Engineer. Everything else - no mode recorded included - is Field Engineer.
 */
export function activationModeOf(values: Record<string, unknown>, personaId: string | undefined = activePersona()): ActivationMode {
  return values.activationMode === 'instant' && serviceAllowsInstantActivation(serviceTypeOfOrder(values)) && canScanDevices(personaId) ? 'instant' : 'field';
}

/** The journey scans the order's devices and SIM itself (Instant Activation) rather than leaving them to the field engineer, and has no Installation Appointment. */
export const scansInJourney = (values: Record<string, unknown>, personaId?: string): boolean => activationModeOf(values, personaId) === 'instant';

/** A Retail role's orders are also validated with WinCash (simulated). */
export const isRetailOrder = (personaId: string | undefined = activePersona()): boolean => isRetailPersona(personaId);

// ---- what to scan -----------------------------------------------------------------------------------------------------------------------------

export interface ScanRow {
  /** Where the validated device is kept in `deviceScan` (and, for a box, which serial of the IPTV selection it reads). */
  key: string;
  kind: ScanDeviceKind;
  label: string;
  /** What the scan field is called on the Device Scanning page, where the page's title already names the device; the Order Summary keeps `label`. */
  fieldLabel?: string;
}

/** What a validated device adds to the order (the cart): shown on the Order Summary. */
export interface CartDevice {
  serial: string;
  status: 'validated' | 'invalid';
  /** Why a serial was refused (status 'invalid'). */
  error?: string;
  label?: string;
  brand?: string;
  model?: string;
}

export type DeviceScanValue = Record<string, CartDevice>;

/**
 * The devices the order needs scanned, from what is in it: a Fiber order its ONT, an FWA Indoor order its CPE; and, for either, a set-top box for each STB chosen on Add-ons (the primary box and any
 * additional ones). Nothing is listed that was not ordered. A journey that does not scan lists none. (The Mesh extenders' serial numbers are captured with the extenders on the Add-ons page itself, not here.)
 */
export function scanRowsFor(values: Record<string, unknown>, personaId?: string): ScanRow[] {
  const type = serviceTypeOfOrder(values);
  // FWA (Indoor, Outdoor, or either of both): the CPE's serial is captured on its own page whatever the activation mode; the other devices are scanned only by an Instant Activation order.
  if (!scansInJourney(values, personaId)) return type === 'fwa-indoor' || type === 'fwa-outdoor' ? [{ key: 'cpe', kind: 'cpe', label: `${SCAN_DEVICE_LABEL.cpe} Serial Number`, fieldLabel: 'Device Serial Number' }] : [];
  const rows: ScanRow[] = [];
  if (type === 'fiber') rows.push({ key: 'ont', kind: 'ont', label: `${SCAN_DEVICE_LABEL.ont} Serial Number`, fieldLabel: 'Device Serial Number' });
  if (type === 'fwa-indoor' || type === 'fwa-outdoor') rows.push({ key: 'cpe', kind: 'cpe', label: `${SCAN_DEVICE_LABEL.cpe} Serial Number`, fieldLabel: 'Device Serial Number' });
  const iptv = values.iptv as HomeIptvSelection | undefined;
  if (iptv?.enabled && asksAdditionalStbs(iptv)) {
    rows.push({ key: 'stb-0', kind: 'stb', label: `${SCAN_DEVICE_LABEL.stb} Serial Number` });
    for (let i = 1; i <= extraStbCount(iptv); i++) rows.push({ key: `stb-${i}`, kind: 'stb', label: `Additional ${SCAN_DEVICE_LABEL.stb} ${i} Serial Number` });
  }
  return rows;
}

/** The serial of a box as the Add-ons page captured it (one source for it, whichever page edits it). */
export function iptvSerialOf(iptv: HomeIptvSelection | undefined, key: string): string | undefined {
  const i = Number(key.replace('stb-', ''));
  return i === 0 ? iptv?.stbSerial : iptv?.extraStbSerials?.[i - 1];
}

/** Where a row's serial lives when the Add-ons page captured it (a set-top box); undefined for a device scanned only here (ONT, CPE). One source: the step reads and writes it there. */
export function sourcedSerialOf(values: Record<string, unknown>, row: ScanRow): string | undefined {
  return row.kind === 'stb' ? iptvSerialOf(values.iptv as HomeIptvSelection | undefined, row.key) : undefined;
}

export const isSourcedKind = (kind: ScanDeviceKind): boolean => kind === 'stb';

const norm = (s: string | undefined) => (s ?? '').trim().toUpperCase();

/** The validated devices on the order (the cart), by row. */
export function validatedDevices(values: Record<string, unknown>, rows: readonly ScanRow[] = scanRowsFor(values)): { row: ScanRow; device: CartDevice }[] {
  const scan = (values.deviceScan as DeviceScanValue | undefined) ?? {};
  return rows.flatMap((row) => {
    const device = scan[row.key];
    if (device?.status !== 'validated') return [];
    // A box's serial is the one on the Add-ons page: an entry for another serial (the page edited it since) is not this box's.
    if (isSourcedKind(row.kind) && norm(device.serial) !== norm(sourcedSerialOf(values, row))) return [];
    return [{ row, device }];
  });
}

/** Every device the order needs is scanned and validated (so added to the cart). */
export const isDeviceScanComplete = (values: Record<string, unknown>, personaId?: string): boolean => {
  const rows = scanRowsFor(values, personaId);
  return validatedDevices(values, rows).length === rows.length;
};
