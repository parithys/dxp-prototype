// Mock inventory and timings for the Home Journey's Device Scanning (Instant Activation). FRONT-END PROTOTYPE ONLY: there is no UIM, WinCash or scanner behind this - every outcome below is a
// made-up serial, so a design review can change a scenario here and nowhere else. The Indoor Unit (CPE) is the exception on purpose: it still reads the app's existing `cpe-devices`
// inventory (the same stock the SIM / Indoor Unit step already used), so only its WinCash outcome is listed here.

export type ScanDeviceKind = 'ont' | 'cpe' | 'stb' | 'mesh';

/** What each device is called on the scan step and on the Order Summary. */
export const SCAN_DEVICE_LABEL: Record<ScanDeviceKind, string> = {
  ont: 'ONT',
  cpe: 'CPE (Indoor Unit)',
  stb: 'Set-Top Box',
  mesh: 'Mesh Extender',
};

export type MockDeviceState = 'available' | 'assigned' | 'faulty';

export interface MockScanDevice {
  serial: string;
  kind: Exclude<ScanDeviceKind, 'cpe'>;
  brand: string;
  model: string;
  /** Stock state in the (mock) inventory: only an available device can be sold. */
  state: MockDeviceState;
}

export const MOCK_SCAN_DEVICES: readonly MockScanDevice[] = [
  { serial: 'HWTC11A00001', kind: 'ont', brand: 'Huawei', model: 'HG8010H', state: 'available' },
  { serial: 'HWTC11A00002', kind: 'ont', brand: 'Huawei', model: 'HG8010H', state: 'available' },
  { serial: 'HWTC11A00003', kind: 'ont', brand: 'Huawei', model: 'HG8010H', state: 'assigned' },
  { serial: 'HWTC11A00004', kind: 'ont', brand: 'Huawei', model: 'HG8010H', state: 'faulty' },
  { serial: 'HWTC11A00005', kind: 'ont', brand: 'Huawei', model: 'HG8010H', state: 'available' },
  { serial: 'STB100000001', kind: 'stb', brand: 'Vodafone', model: 'GigaTV Box 4K', state: 'available' },
  { serial: 'STB100000002', kind: 'stb', brand: 'Vodafone', model: 'GigaTV Box 4K', state: 'available' },
  { serial: 'STB100000003', kind: 'stb', brand: 'Vodafone', model: 'GigaTV Box 4K', state: 'available' },
  { serial: 'STB100000004', kind: 'stb', brand: 'Vodafone', model: 'GigaTV Box 4K', state: 'available' },
  { serial: 'STB100000005', kind: 'stb', brand: 'Vodafone', model: 'GigaTV Box 4K', state: 'assigned' },
  { serial: 'STB100000006', kind: 'stb', brand: 'Vodafone', model: 'GigaTV Lite', state: 'faulty' },
  { serial: 'WMP200000001', kind: 'mesh', brand: 'Vodafone', model: 'Wi-Fi 6 Mesh Pod', state: 'available' },
  { serial: 'WMP200000002', kind: 'mesh', brand: 'Vodafone', model: 'Wi-Fi 6 Mesh Pod', state: 'available' },
  { serial: 'WMP200000003', kind: 'mesh', brand: 'Vodafone', model: 'Wi-Fi 6 Mesh Pod', state: 'available' },
  { serial: 'WMP200000004', kind: 'mesh', brand: 'Vodafone', model: 'Wi-Fi 6 Mesh Pod', state: 'assigned' },
];

/** Serials a Retail order's (simulated) WinCash check declines, though the inventory accepts them: one per device kind (the CPE one is an Indoor Unit in the app's cpe-devices stock). */
export const WINCASH_DECLINED_SERIALS: readonly string[] = ['HWTC11A00005', 'STB100000004', 'WMP200000003', 'HW880224H'];

/** How long the simulated checks take, so the loading states can be seen (and tuned in a review). */
export const VALIDATE_DELAY_MS = 700;
export const WINCASH_DELAY_MS = 900;
export const SCAN_DELAY_MS = 600;

export type ScanValidation = { ok: true; device: MockScanDevice } | { ok: false; error: string };

const norm = (serial: string) => serial.trim().toUpperCase();

/** The mock inventory check for an ONT, STB or Mesh serial (the CPE reads `cpe-devices` instead). Not found, another kind of device, assigned and faulty are each refused with their own reason. */
export function validateScanDevice(kind: Exclude<ScanDeviceKind, 'cpe'>, serial: string): ScanValidation {
  const s = norm(serial);
  if (!s) return { ok: false, error: `${SCAN_DEVICE_LABEL[kind]} serial number is required.` };
  const found = MOCK_SCAN_DEVICES.find((d) => d.serial === s);
  if (!found) return { ok: false, error: `${SCAN_DEVICE_LABEL[kind]} serial number not found in inventory.` };
  if (found.kind !== kind) return { ok: false, error: `This serial is a ${SCAN_DEVICE_LABEL[found.kind]}, not a ${SCAN_DEVICE_LABEL[kind]}.` };
  if (found.state === 'assigned') return { ok: false, error: `This ${SCAN_DEVICE_LABEL[kind]} is already assigned to another order.` };
  if (found.state === 'faulty') return { ok: false, error: `This ${SCAN_DEVICE_LABEL[kind]} is marked faulty and cannot be sold.` };
  return { ok: true, device: found };
}

/** The extra WinCash validation a Retail order gets once the device is available (simulated: declined only for the serials listed above). */
export function wincashValidate(serial: string): { ok: true } | { ok: false; error: string } {
  return WINCASH_DECLINED_SERIALS.includes(norm(serial)) ? { ok: false, error: 'WinCash declined this device. Clear it and scan another.' } : { ok: true };
}

/** What a barcode scan reads for a device kind: the next available, WinCash-clean serial not already used on this order (simulated reader). */
export function scanMockSerial(kind: Exclude<ScanDeviceKind, 'cpe'>, taken: readonly string[]): string | undefined {
  const used = new Set(taken.map(norm));
  return MOCK_SCAN_DEVICES.find((d) => d.kind === kind && d.state === 'available' && !WINCASH_DECLINED_SERIALS.includes(d.serial) && !used.has(d.serial))?.serial;
}

/** The demo shortcuts under a device field: a serial that is valid, one that is refused, and one only WinCash declines. */
export function demoSerials(kind: Exclude<ScanDeviceKind, 'cpe'>): { valid?: string; invalid: string; wincashDeclined?: string } {
  const of = (state: MockDeviceState) => MOCK_SCAN_DEVICES.find((d) => d.kind === kind && d.state === state && !WINCASH_DECLINED_SERIALS.includes(d.serial))?.serial;
  return {
    valid: scanMockSerial(kind, []),
    invalid: of('assigned') ?? of('faulty') ?? 'UNKNOWN-0000',
    wincashDeclined: MOCK_SCAN_DEVICES.find((d) => d.kind === kind && WINCASH_DECLINED_SERIALS.includes(d.serial))?.serial,
  };
}
