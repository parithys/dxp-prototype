import { useEffect, useRef, useState } from 'react';
import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import { CARD_SELECTED, NumberSelection, SelectedTick } from '../../../capabilities';
import { autoAllocatedFreeNumber, type MsisdnSource } from '../../../capabilities/NumberSelection/prepaidNumberAllocation';
import { toLocalMsisdn, type MsisdnRecord } from '../../../components/domain/msisdnPickerModel';
import { listEntities } from '../../../services/entityOps';
import { BARCODE_ICON, Button, Icon, Input, CHECK, FIBER, FWA_INDOOR, FWA_OUTDOOR, INSTALLATION_WIFI } from 'dxp-ui';
import { ServiceAddress } from '../../../capabilities';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { resolveFibreServiceability } from '../../../engines/fibreServiceability';
import { FIXED_NUMBER_PICKER, FIXED_SERVICE_TYPES, checkIndoorUnitSerial, devicesFor, indoorUnitsInStock, normaliseIndoorUnitSerial, type FixedDevice, type IndoorUnitDetails, type FixedInstallationValue, type FixedServiceType } from './fixedActivationModel';

type Values = Record<string, unknown>;

const SERVICE_ICON: Record<FixedServiceType, string> = {
  fiber: FIBER,
  'fwa-indoor': FWA_INDOOR,
  'fwa-outdoor': FWA_OUTDOOR,
};

// Installation Address: service type, the address (shared ZSB address form) and the RFS read-out. New Home Connection asks the address first, on its own page (InstallationAddressForm), and the
// service type and the fibre-readiness read-out on Product Selection, under the product cards (InstallationReadiness); New Fixed Line in New Connection shows both on one page.
export function InstallationReadiness({ values, setValue, addressOnPage = true }: { values: Values; setValue: (f: string, v: unknown) => void; addressOnPage?: boolean }) {
  const address = (values.address as ZsbAddressValue | undefined) ?? {};
  const installation = (values.installation as FixedInstallationValue | undefined) ?? {};
  const customerId = (values.eligibility as EligibilityResult | undefined)?.customerId;
  const complete = Boolean(address.zone && address.streetNo && address.buildingNo);
  const [checking, setChecking] = useState(false);

  // Service types by product (business rule): Fibre, Fixed-Line and 5G Home have none to choose; only FWA offers FWA Indoor and
  // FWA Outdoor. Fibre still runs on the Fiber service underneath (set here, not asked) so its fibre-readiness check applies.
  const homeProduct = values.homeProduct as string | undefined;
  const wireless = homeProduct === 'fwa';
  const serviceTypes = FIXED_SERVICE_TYPES.filter((t) => t.value !== 'fiber');
  useEffect(() => {
    if (homeProduct === 'fibre' && installation.serviceType !== 'fiber') setValue('installation', { serviceType: 'fiber', rfs: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeProduct, installation.serviceType]);

  // RFS is read from the service-point records for the address as entered; nothing is assumed when it is unmatched.
  useEffect(() => {
    if (installation.serviceType !== 'fiber' || !complete) return;
    let cancelled = false;
    setChecking(true);
    void resolveFibreServiceability(customerId, address).then((rfs) => {
      if (cancelled) return;
      setChecking(false);
      if (rfs !== installation.rfs) setValue('installation', { ...installation, rfs });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installation.serviceType, address.zone, address.streetNo, address.buildingNo, address.aptFlatUnit, customerId]);

  const rfs = installation.rfs;
  return (
    <>
      {wireless && (
      <div>
        <p className="text-[length:var(--fs-label)] text-fg-2 mb-2">Service Type</p>
        {/* Same card selector as the ID Type cards on Contact. */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))] gap-3" role="radiogroup" aria-label="Service type">
          {serviceTypes.map((t) => {
            const selected = installation.serviceType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setValue('installation', { serviceType: t.value as FixedServiceType, rfs: undefined })}
                className={`choice-tile ${
                  selected
                    ? `${CARD_SELECTED} text-fg`
                    : 'card-idle text-fg'
                }`}
              >
                {selected && <SelectedTick />}
                <span className={`option-glyph ${selected ? 'glyph-chosen' : ''}`}>
                  <Icon path={SERVICE_ICON[t.value]} className="size-6 " />
                </span>
                <span className="text-[length:var(--fs-caption)] font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      )}
      {installation.serviceType === 'fiber' && complete && !checking && rfs === 'rfs' && (
        // Fibre Readiness is the RFS verdict: shown only when the location is RFS, above the address it is about.
        <div className="row notice-success pad-row">
          <Icon path={INSTALLATION_WIFI} className="icon-md text-success" />
          <div className="min-w-0 flex-1">
            <p className="title title-sm font-semibold">Fibre Readiness</p>
            <p className="text-[length:var(--fs-caption)] text-success">Location is RFS (Ready For Service) - fibre can be installed here.</p>
          </div>
          <Icon path={CHECK} className="icon-md text-success" />
        </div>
      )}
      {installation.serviceType === 'fiber' && complete && !checking && rfs && rfs !== 'rfs' && (
        <p role="status" className="text-[length:var(--fs-caption)] text-[var(--warn-text)]">
          {rfs === 'not-rfs'
            ? `This location is not RFS, so fibre cannot be installed here. Choose another connection (such as FWA) or ${addressOnPage ? 'enter another address' : 'go Back and enter another address'}.`
            : `No service point matches this address - check the zone, street and building${addressOnPage ? '' : ' (go Back to the Address page)'}.`}
        </p>
      )}
    </>
  );
}

/** The address form alone (the shared ZSB address), clearing a fibre-readiness result that belongs to the address it was read for. */
export function InstallationAddressForm({ values, setValue }: { values: Values; setValue: (f: string, v: unknown) => void }) {
  const address = (values.address as ZsbAddressValue | undefined) ?? {};
  const installation = (values.installation as FixedInstallationValue | undefined) ?? {};
  const contact = values.contact as GuidedContactValue | undefined;
  return (
    <ServiceAddress
      mode="structured"
      value={address}
      onChange={(v) => {
        setValue('address', v);
        // The fibre-readiness result belongs to the zone / street / building / unit it was read for: clear it only when one of
        // those changes (the check then runs again). Editing the floor, area, directions or the Kahramaa / Vodafone IDs
        // must not clear it, or nothing would read it again and Continue would stay disabled.
        const same = (['zone', 'streetNo', 'buildingNo', 'aptFlatUnit'] as const).every((k) => (v[k] ?? '') === (address[k] ?? ''));
        if (installation.rfs && !same) setValue('installation', { ...installation, rfs: undefined });
      }}
      idNumber={contact?.idNumber}
      nationality={(values.eligibility as EligibilityResult | undefined)?.nationality}
    />
  );
}

export function InstallationAddressStep({ values, setValue }: { values: Values; setValue: (f: string, v: unknown) => void }) {
  return (
    <div className="space-y-6">
      <InstallationReadiness values={values} setValue={setValue} />
      <InstallationAddressForm values={values} setValue={setValue} />
    </div>
  );
}

// SIM Selection (5G Home / FWA), under the SIM: the Indoor Unit's serial number, typed or scanned and checked against the device inventory; once accepted, the device's details are read back (required).
export function IndoorUnitSerial({ values, setValue }: { values: Values; setValue: (f: string, v: unknown) => void }) {
  const serial = (values.indoorUnitSerial as string | undefined) ?? '';
  const unit = values.indoorUnit as IndoorUnitDetails | undefined;
  const [error, setError] = useState<string | undefined>();
  const [scanning, setScanning] = useState(false);
  const [checking, setChecking] = useState(false);
  const scanIntent = useRef(false);
  const check = async (text: string) => {
    setChecking(true);
    const result = checkIndoorUnitSerial(text, await listEntities<IndoorUnitDetails>('cpe-devices'));
    setChecking(false);
    setValue('indoorUnit', result.ok ? result.details : undefined);
    setError(result.ok ? undefined : result.error);
  };
  // The barcode scan trigger sits inside the field, as on the SIM serial. Simulated (no scanner hardware here): the reader's output - an Indoor Unit from stock - lands in the field after a moment.
  const scan = async () => {
    setScanning(true);
    const stock = indoorUnitsInStock(await listEntities<IndoorUnitDetails>('cpe-devices'));
    await new Promise((r) => window.setTimeout(r, 600));
    const pick = stock[Math.floor(Math.random() * stock.length)];
    setScanning(false);
    scanIntent.current = false;
    if (!pick) {
      setError('No Indoor Unit is in stock to scan.');
      return;
    }
    setValue('indoorUnitSerial', pick.serialNumber);
    await check(pick.serialNumber);
  };
  const shown = unit && normaliseIndoorUnitSerial(serial) === unit.serialNumber.toUpperCase() ? unit : undefined;
  const rows: [string, string | undefined][] = shown
    ? [
        ['Indoor Unit Serial Number', shown.serialNumber],
        ['Device Brand', shown.brand],
        ['Model Number', shown.modelNumber],
        ['Device Type', 'Indoor Unit'],
        ['MAC Address', shown.macAddress],
        ['Firmware Version', shown.firmwareVersion],
        ['Stock Status', shown.stockStatus],
      ]
    : [];
  return (
    <section aria-label="Indoor Unit" className="max-w-xl space-y-3">
      <h3 className="title title-sm font-semibold">Indoor Unit</h3>
      <Input
        label="Indoor Unit Serial Number"
        required
        placeholder="Enter the Indoor Unit serial number, or use the barcode scanner"
        value={serial}
        onChange={(e) => {
          setValue('indoorUnitSerial', e.target.value.toUpperCase());
          setValue('indoorUnit', undefined);
          setError(undefined);
        }}
        onBlur={(e) => {
          if (scanIntent.current) return;
          if (e.target.value) void check(e.target.value);
        }}
        error={error}
        trailingAddon={
          <Button variant="ghost" size="icon" type="button" onPointerDown={() => { scanIntent.current = true; }} onClick={() => void scan()} disabled={scanning || checking} aria-label="Scan Indoor Unit barcode" title={scanning ? 'Scanning…' : 'Scan Indoor Unit barcode'} className="icon-button-inline icon-button-quiet size-auto -mr-1.5">
            <Icon path={BARCODE_ICON} className="size-4 " />
          </Button>
        }
      />
      {scanning && <span className="caption-muted">Scanning…</span>}
      {checking && !scanning && <span className="caption-muted">Checking inventory…</span>}
      {shown && (
        <dl className="notice-success notice-body-sm">
          {rows.flatMap(([label, value]) =>
            value
              ? [
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-fg">{label}</dt>
                    <dd className="text-fg font-medium">{value}</dd>
                  </div>,
                ]
              : []
          )}
        </dl>
      )}
    </section>
  );
}

// Number & Devices: a Fixed Line Number is allocated from the Free pool when the page opens and shown as the order's number; the agent may keep it or, if the customer wants a different one, open
// Number Selection (the same capability as Mobile Postpaid, over the Fixed Line Number pool and without Star numbers) to search and choose another. The devices that follow from the service type are
// recorded on the order (not listed on this page).
export function NumberDevicesStep({ values, setValue }: { values: Values; setValue: (f: string, v: unknown) => void }) {
  const serviceType = (values.installation as FixedInstallationValue | undefined)?.serviceType;
  const devices = values.devices as FixedDevice[] | undefined;
  const msisdn = values.msisdn as string | undefined;
  const source = values.msisdnSource as MsisdnSource | undefined;
  const [choosing, setChoosing] = useState(false);
  const [poolEmpty, setPoolEmpty] = useState(false);
  useEffect(() => {
    if (!devices) setValue('devices', devicesFor(serviceType, serviceType === 'fiber'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const customerIdNumber = (values.contact as { idNumber?: string } | undefined)?.idNumber;
  // The first available Free number is allocated whenever the order has none (on opening, or after the agent clears a chosen number).
  useEffect(() => {
    if (msisdn) return;
    let live = true;
    void listEntities<MsisdnRecord>('fixed-line-numbers').then((all) => {
      const n = live ? autoAllocatedFreeNumber(all) : undefined;
      if (n) {
        setValue('msisdn', n.msisdn);
        setValue('msisdnSource', 'auto');
        setPoolEmpty(false);
      } else if (live) setPoolEmpty(true);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msisdn]);
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="split">
          <div>
            <h3 className="title title-lg font-semibold mb-2">{source === 'selected' ? 'Selected Fixed Line Number' : 'Allocated Fixed Line Number'}</h3>
            <p className="title title-xl">{msisdn ? toLocalMsisdn(msisdn) : poolEmpty ? '-' : '…'}</p>
            {poolEmpty && !msisdn && <p className="caption-secondary" role="status">No Free Fixed Line Number is available to allocate. Choose one below.</p>}
          </div>
          <Button variant="secondary" onClick={() => setChoosing((v) => !v)}>
            {choosing ? 'Keep This Number' : 'Choose Another Number'}
          </Button>
        </div>
        {(choosing || (poolEmpty && !msisdn)) && (
          <NumberSelection
            value={msisdn}
            profile={FIXED_NUMBER_PICKER}
            customerIdNumber={customerIdNumber}
            onChange={(next) => {
              // Choosing the selected number again clears it, and the Free pool allocates the next one.
              setValue('msisdn', next);
              setValue('msisdnSource', next ? 'selected' : undefined);
            }}
          />
        )}
      </section>
    </div>
  );
}
