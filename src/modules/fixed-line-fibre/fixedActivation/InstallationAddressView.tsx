import { useEffect, useState } from 'react';
import { COUNTRY_DIAL_CODES, Input, Select, Textarea } from 'dxp-ui';
import { listEntities } from '../../../services/entityOps';
import { useAreaOptions } from '../../../hooks/useAreaOptions';
import { resolveInstallationAddress, type HomeAddressValue, type UimServicePoint } from './installationAddress';

type Values = Record<string, unknown>;

/**
 * Installation Address (see installationAddress.ts): populated from the RFS data (or UIM) for the selected KID and read-only, or - with no KID - captured manually, with Zone / Street / Building
 * from the RFS check read-only, the Area derived from them, and the agent giving the Unit / Apartment / Flat Number (mandatory) and optionally Floor, PO Number, City, Country and an Address Description.
 */
export function InstallationAddressView({ values, setValue }: { values: Values; setValue: (f: string, v: unknown) => void }) {
  const [uim, setUim] = useState<UimServicePoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const cities = useAreaOptions();
  useEffect(() => {
    void listEntities<UimServicePoint>('kid-service-points').then((rows) => {
      setUim(rows);
      setLoaded(true);
    });
  }, []);
  const resolved = resolveInstallationAddress(values, uim);
  const current = (values.address as HomeAddressValue | undefined) ?? {};
  const a = resolved.mode === 'populated' ? resolved.address : { ...resolved.address, ...current, area: resolved.address.area };
  // The order carries the address the page shows: a populated address is written once the sources have been read, a manual one keeps what the agent types (with the derived Area).
  const populatedKey = resolved.mode === 'populated' ? JSON.stringify(resolved.address) : undefined;
  useEffect(() => {
    if (!loaded) return;
    if (resolved.mode === 'populated') setValue('address', resolved.address);
    else if (resolved.address.area !== current.area) setValue('address', { ...current, area: resolved.address.area });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, populatedKey, resolved.address.area]);
  const edit = (patch: Partial<HomeAddressValue>) => setValue('address', { ...a, ...patch });
  const populated = resolved.mode === 'populated';
  return (
    <div className="space-y-6">
      <section aria-label="Installation Address" className="space-y-6">
        {/* The service identifiers first, then a rule, then the address: the order of the address form every journey uses. Read-only here: the KID is the one the RFS check selected. */}
        <div className="pair-grid">
          <Input label="Kahramaa Meter ID" readOnly value={a.kidLocationId ?? ''} />
          <Input label="Vodafone Premise ID" readOnly value={a.vodafoneId ?? ''} />
        </div>
        <div role="separator" className="divider-top" />
        <div className="grid-3-end">
          <Input label="Zone Number" required readOnly value={a.zone ?? ''} />
          <Input label="Street Number" required readOnly value={a.streetNo ?? ''} />
          <Input label="Building Number" required readOnly value={a.buildingNo ?? ''} />
          {populated ? (
            <Input label="Unit Number / Apartment Number / Flat Number" required readOnly value={a.aptFlatUnit ?? ''} />
          ) : (
            <Input label="Unit Number / Apartment Number / Flat Number" required placeholder="e.g. 4B, 1402" value={a.aptFlatUnit ?? ''} onChange={(e) => edit({ aptFlatUnit: e.target.value })} />
          )}
          {populated ? (
            <>
              <Input label="Floor" readOnly value={a.floor ?? ''} />
              <Input label="PO Number" readOnly value={a.poBox ?? ''} />
              <Input label="City" readOnly value={a.city ?? ''} />
              <Input label="Country" readOnly value={a.country ?? ''} />
            </>
          ) : (
            <>
              <Input label="Floor" placeholder="e.g. 4" value={a.floor ?? ''} onChange={(e) => edit({ floor: e.target.value })} />
              <Input label="PO Number" inputMode="numeric" placeholder="e.g. 24501" value={a.poBox ?? ''} onChange={(e) => edit({ poBox: e.target.value })} />
              <Select
                label="City"
                placeholder="Select a city"
                searchable
                options={[...new Set([...(a.city ? [a.city] : []), ...cities])].map((c) => ({ value: c, label: c }))}
                value={a.city ?? ''}
                onChange={(e) => edit({ city: e.target.value })}
              />
              <Select
                label="Country"
                placeholder="Select a country"
                searchable
                options={[...new Set([...(a.country ? [a.country] : []), ...COUNTRY_DIAL_CODES.map((c) => c.name)])].map((c) => ({ value: c, label: c }))}
                value={a.country ?? ''}
                onChange={(e) => edit({ country: e.target.value })}
              />
            </>
          )}
          {/* The Area follows from the Zone, Street and Building: derived, never typed. */}
          <Input label="Area" readOnly value={a.area ?? ''} />
        </div>
        {populated ? (
          <Textarea label="Address Description" rows={2} readOnly value={a.addressLine ?? ''} />
        ) : (
          <Textarea label="Address Description" rows={2} placeholder="e.g. Near City Center Mall, opposite Al Rayyan Park" value={a.addressLine ?? ''} onChange={(e) => edit({ addressLine: e.target.value })} />
        )}
      </section>
    </div>
  );
}
