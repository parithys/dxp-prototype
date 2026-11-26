import { useEffect, useRef, useState } from 'react';
import { BARCODE_ICON, Button, CLEAR_ICON, Icon, Input } from 'dxp-ui';
import { listEntities } from '../../../services/entityOps';
import { SYNTHETIC_CLASS } from '../../../data/synthetic/syntheticMarker';
import {
  SCAN_DELAY_MS, VALIDATE_DELAY_MS, WINCASH_DELAY_MS, WINCASH_DECLINED_SERIALS, SCAN_DEVICE_LABEL,
  demoSerials, scanMockSerial, validateScanDevice, wincashValidate,
} from '../../../data/reference/deviceScanMock';
import type { HomeIptvSelection } from '../../../engines/homeIptv';
import { checkIndoorUnitSerial, cpeTypeOfService, indoorUnitsInStock, normaliseIndoorUnitSerial, type IndoorUnitDetails } from './fixedActivationModel';
import { isRetailOrder, isSourcedKind, scanRowsFor, sourcedSerialOf, type CartDevice, type DeviceScanValue, type ScanRow } from './activationMode';

// The Device Scanning of an Instant Activation order (New Home Connection): the ONT / CPE / STB / Mesh serial numbers, each in the search box with the barcode icon that the Physical SIM page uses. FRONT-END
// PROTOTYPE: the barcode reader and every check (inventory, and WinCash for a Retail role) are simulated from data/reference/deviceScanMock.ts and the app's cpe-devices stock.

type Values = Record<string, unknown>;
type SetValue = (field: string, value: unknown) => void;
type Phase = 'idle' | 'scanning' | 'validating' | 'wincash';

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** One device's serial field: scan or type, validate, add to the cart, clear. */
function DeviceSerialField({ row, values, setValue, retail, cpeStock }: { row: ScanRow; values: Values; setValue: SetValue; retail: boolean; cpeStock: readonly IndoorUnitDetails[] }) {
  // The newest values for the async checks below (a check finishes after the render that started it).
  const latest = useRef(values);
  useEffect(() => {
    latest.current = values;
  });
  const scan = (values.deviceScan as DeviceScanValue | undefined) ?? {};
  const entry: CartDevice | undefined = scan[row.key];
  const iptv = values.iptv as HomeIptvSelection | undefined;
  // A box's serial lives on the Add-ons page's selection; every other device's in this step's own value.
  const storedSerial = isSourcedKind(row.kind) ? sourcedSerialOf(values, row) : entry?.serial;
  const [text, setText] = useState(storedSerial ?? '');
  const [phase, setPhase] = useState<Phase>('idle');
  const token = useRef(0);
  const scanIntent = useRef(false);

  const writeEntry = (next: CartDevice | undefined) => {
    const current = { ...((latest.current.deviceScan as DeviceScanValue | undefined) ?? {}) };
    if (next) current[row.key] = next;
    else delete current[row.key];
    setValue('deviceScan', current);
  };
  const writeBoxSerial = (serial: string | undefined) => {
    if (row.kind !== 'stb' || !iptv) return;
    const i = Number(row.key.replace('stb-', ''));
    if (i === 0) setValue('iptv', { ...iptv, stbSerial: serial });
    else {
      const next = [...(iptv.extraStbSerials ?? [])];
      next[i - 1] = serial ?? '';
      setValue('iptv', { ...iptv, extraStbSerials: next });
    }
  };
  // The CPE is also the order's Indoor Unit (what the order records and the Order Summary reads).
  const writeIndoorUnit = (serial: string | undefined, details?: IndoorUnitDetails) => {
    if (row.kind !== 'cpe') return;
    setValue('indoorUnitSerial', serial);
    setValue('indoorUnit', details);
  };

  const takenElsewhere = (serial: string) =>
    scanRowsFor(latest.current).some((r) => r.key !== row.key && (isSourcedKind(r.kind) ? sourcedSerialOf(latest.current, r) : ((latest.current.deviceScan as DeviceScanValue | undefined) ?? {})[r.key]?.serial)?.toUpperCase() === serial);

  const validate = async (raw: string) => {
    const serial = normaliseIndoorUnitSerial(raw);
    if (!serial) return;
    const mine = ++token.current;
    setText(serial);
    writeBoxSerial(serial);
    setPhase('validating');
    await wait(VALIDATE_DELAY_MS);
    if (mine !== token.current) return;
    const refuse = (error: string) => {
      writeEntry({ serial, status: 'invalid', error });
      writeIndoorUnit(undefined);
      setPhase('idle');
    };
    if (takenElsewhere(serial)) return refuse('This serial is already scanned for another device on this order.');
    let model: string | undefined;
    let brand: string | undefined;
    let details: IndoorUnitDetails | undefined;
    if (row.kind === 'cpe') {
      const check = checkIndoorUnitSerial(serial, cpeStock, cpeTypeOfService(latest.current));
      if (!check.ok) return refuse(check.error);
      details = check.details;
      model = check.details.modelNumber;
      brand = check.details.brand;
    } else {
      const check = validateScanDevice(row.kind, serial);
      if (!check.ok) return refuse(check.error);
      model = check.device.model;
      brand = check.device.brand;
    }
    if (retail) {
      setPhase('wincash');
      await wait(WINCASH_DELAY_MS);
      if (mine !== token.current) return;
      const w = wincashValidate(serial);
      if (!w.ok) return refuse(w.error);
    }
    writeEntry({ serial, status: 'validated', label: SCAN_DEVICE_LABEL[row.kind], brand, model });
    writeIndoorUnit(serial, details);
    setPhase('idle');
  };

  const clear = () => {
    token.current++;
    setText('');
    setPhase('idle');
    writeEntry(undefined);
    writeBoxSerial(undefined);
    writeIndoorUnit(undefined);
  };

  const taken = () => scanRowsFor(latest.current).flatMap((r) => [isSourcedKind(r.kind) ? sourcedSerialOf(latest.current, r) : ((latest.current.deviceScan as DeviceScanValue | undefined) ?? {})[r.key]?.serial]).filter((s): s is string => Boolean(s));
  const sampleFor = (which: 'valid' | 'invalid' | 'wincash'): string | undefined => {
    if (row.kind === 'cpe') {
      if (which === 'invalid') return 'NK772299Z';
      if (which === 'wincash') return WINCASH_DECLINED_SERIALS.find((s) => cpeStock.some((d) => d.serialNumber === s));
      return indoorUnitsInStock(cpeStock, cpeTypeOfService(latest.current)).find((d) => !WINCASH_DECLINED_SERIALS.includes(d.serialNumber) && !taken().includes(d.serialNumber))?.serialNumber;
    }
    const d = demoSerials(row.kind);
    return which === 'valid' ? scanMockSerial(row.kind, taken()) : which === 'invalid' ? d.invalid : d.wincashDeclined;
  };

  // The barcode icon: the reader's output (simulated) lands in the field and is validated.
  const scanBarcode = async () => {
    setPhase('scanning');
    await wait(SCAN_DELAY_MS);
    scanIntent.current = false;
    const serial = sampleFor('valid');
    if (!serial) {
      setPhase('idle');
      writeEntry({ serial: '', status: 'invalid', error: `No ${SCAN_DEVICE_LABEL[row.kind]} is available to scan.` });
      return;
    }
    await validate(serial);
  };

  const busy = phase !== 'idle';
  const validated = entry?.status === 'validated' ? entry : undefined;
  const error = !busy && entry?.status === 'invalid' ? entry.error : undefined;
  const demo: { label: string; which: 'valid' | 'invalid' | 'wincash' }[] = [
    { label: 'Valid Serial', which: 'valid' },
    { label: 'Invalid Serial', which: 'invalid' },
    ...(retail ? [{ label: 'WinCash Declined', which: 'wincash' as const }] : []),
  ];

  return (
    <section aria-label={row.label} className="stack gap-2 max-w-xl">
      <Input
        label={row.fieldLabel ?? row.label}
        required
        placeholder={`Enter the ${SCAN_DEVICE_LABEL[row.kind]} serial number, or use the barcode scanner`}
        value={text}
        disabled={busy}
        onChange={(e) => {
          setText(e.target.value.toUpperCase());
          // Editing the serial takes the device out of the cart until the new one is validated.
          if (entry) writeEntry(undefined);
          if (row.kind === 'cpe') writeIndoorUnit(undefined);
        }}
        onBlur={(e) => {
          if (scanIntent.current || busy) return;
          const typed = e.target.value.trim();
          if (typed && typed.toUpperCase() !== entry?.serial) void validate(typed);
        }}
        error={error}
        trailingAddon={
          <>
            {text && (
              <Button variant="ghost" size="icon" type="button" onClick={clear} disabled={phase === 'scanning'} aria-label={`Clear ${row.label}`} title="Clear" className="icon-button-inline icon-button-quiet size-auto">
                <Icon path={CLEAR_ICON} className="size-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" type="button" onPointerDown={() => { scanIntent.current = true; }} onClick={() => void scanBarcode()} disabled={busy} aria-label={`Scan barcode for ${row.label}`} title={phase === 'scanning' ? 'Scanning…' : 'Scan barcode'} className="icon-button-inline icon-button-quiet size-auto -mr-1.5">
              <Icon path={BARCODE_ICON} className="size-4" />
            </Button>
          </>
        }
      />
      {phase === 'scanning' && <span className="caption-muted" role="status">Scanning…</span>}
      {phase === 'validating' && <span className="caption-muted" role="status">Validating with inventory…</span>}
      {phase === 'wincash' && <span className="caption-muted" role="status">Validating with WinCash…</span>}
      {validated && !busy && (
        <dl className="notice-success notice-body-sm">
          {[
            ['Device', validated.label],
            ['Serial Number', validated.serial],
            ['Brand / Model', [validated.brand, validated.model].filter(Boolean).join(' ') || undefined],
            ['Status', retail ? 'Available · WinCash verified' : 'Available'],
          ].flatMap(([k, v]) =>
            v ? [<div key={k} className="flex justify-between gap-3"><dt className="text-fg">{k}</dt><dd className="text-fg font-medium">{v}</dd></div>] : []
          )}
          <div className="flex justify-between gap-3"><dt className="text-fg">Cart</dt><dd className="text-fg font-medium">Added To Cart</dd></div>
        </dl>
      )}
      {/* Demo only: fill the field with a serial that behaves as named, so each state can be shown in a review. */}
      <div className={`cluster gap-x-4 gap-y-1 ${SYNTHETIC_CLASS}`}>
        <span className="demo-link-label">Demo:</span>
        {demo.map((d) => (
          <Button key={d.which} variant="link" className="demo-link" disabled={busy} onClick={() => { const s = sampleFor(d.which); if (s) void validate(s); }}>
            {d.label}
          </Button>
        ))}
      </div>
    </section>
  );
}

/** The device rows of an Instant Activation order, with how many are in the cart. Renders nothing when the journey does not scan. */
export function DeviceScanPanel({ values, setValue }: { values: Values; setValue: SetValue }) {
  const [cpeStock, setCpeStock] = useState<IndoorUnitDetails[]>([]);
  useEffect(() => {
    void listEntities<IndoorUnitDetails>('cpe-devices').then(setCpeStock);
  }, []);
  const rows = scanRowsFor(values);
  if (rows.length === 0) return null;
  const retail = isRetailOrder();
  return (
    <section aria-label="Device Scanning" className="space-y-4 scan-rows">
      {rows.map((row) => (
        <DeviceSerialField key={row.key} row={row} values={values} setValue={setValue} retail={retail} cpeStock={cpeStock} />
      ))}
    </section>
  );
}
