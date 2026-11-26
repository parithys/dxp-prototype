import { COUNTRY_DIAL_CODES, Checkbox, Input, Label, Select, Textarea } from 'dxp-ui';
import { useAreaOptions } from '../../hooks/useAreaOptions';
import { billingAddressLine, type BillingAddressFields } from '../../engines/billingAddress';

/**
 * A new home account's Billing Address. For a customer with an account on file, the Billing Address of that account is kept (`existing`): "Same as Installation Address" is unticked by default and shows the
 * existing address, and ticking it replaces that with the Installation Address. For a customer with none, "Same as Installation Address" is ticked by default and shows the Installation Address; unticked,
 * the address fields open for editing, starting from the Installation Address (only an agent who may edit the billing address can untick it).
 */
export function HomeBillingAddress({
  installation,
  same,
  given,
  canEdit,
  existing,
  onChange,
}: {
  installation: BillingAddressFields | undefined;
  /** Whether the box is ticked; undefined is ticked. */
  same: boolean | undefined;
  given: BillingAddressFields | undefined;
  canEdit: boolean;
  /** The Billing Address of the customer's account on file, as one line: kept unless the box is ticked. */
  existing?: string;
  onChange: (next: { same: boolean; given?: BillingAddressFields }) => void;
}) {
  const cities = useAreaOptions();
  // With an account on file the box starts unticked (the existing address stays); without one it starts ticked.
  const ticked = existing ? same === true : same !== false;
  const a = given ?? installation ?? {};
  const edit = (patch: Partial<BillingAddressFields>) => onChange({ same: false, given: { ...a, ...patch } });
  return (
    <div className="space-y-3">
      <Label className="flex w-fit choice-label">
        <Checkbox
          checked={ticked}
          // Replacing the existing address with the Installation Address is open to every agent; giving a different address is only for those who may edit it.
          disabled={!existing && !canEdit}
          onCheckedChange={(checked) => (checked === true ? onChange({ same: true, given: undefined }) : onChange({ same: false, given: existing ? undefined : { ...(installation ?? {}) } }))}
        />
        Same as Installation Address
      </Label>
      {ticked || existing ? (
        <dl className="text-[length:var(--fs-body)]">
          <div className="spread items-baseline py-1.5 divider-bottom">
            <dt className="text-fg-2">Billing Address</dt>
            <dd className="value-end min-w-0">{ticked ? billingAddressLine(installation) ?? 'No installation address on file yet.' : existing}</dd>
          </div>
        </dl>
      ) : (
        <div className="space-y-4">
          <div className="grid-3-end">
            <Input label="Zone Number" required inputMode="numeric" value={a.zone ?? ''} onChange={(e) => edit({ zone: e.target.value })} />
            <Input label="Street Number" required inputMode="numeric" value={a.streetNo ?? ''} onChange={(e) => edit({ streetNo: e.target.value })} />
            <Input label="Building Number" required inputMode="numeric" value={a.buildingNo ?? ''} onChange={(e) => edit({ buildingNo: e.target.value })} />
            <Input label="Unit Number / Apartment Number / Flat Number" required value={a.aptFlatUnit ?? ''} onChange={(e) => edit({ aptFlatUnit: e.target.value })} />
            <Input label="Floor" value={a.floor ?? ''} onChange={(e) => edit({ floor: e.target.value })} />
            <Input label="PO Number" inputMode="numeric" value={a.poBox ?? ''} onChange={(e) => edit({ poBox: e.target.value })} />
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
          </div>
          <Textarea label="Address Description" rows={2} value={a.addressLine ?? ''} onChange={(e) => edit({ addressLine: e.target.value })} />
        </div>
      )}
    </div>
  );
}
