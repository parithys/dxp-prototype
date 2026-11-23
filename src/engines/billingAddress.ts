/**
 * New Home Connection's Billing Address. A new account's bill goes to the Installation Address by default ("Same as Installation Address", ticked); an agent who may edit it can untick the box and
 * give another address. An existing account shows the address it has, which the agent who may edit it can change. Who may edit follows the agent's persona: for the prototype, Retail Sales.
 */
export const BILLING_ADDRESS_EDITOR_ROLES: readonly string[] = ['ROLE-01'];
export const canEditBillingAddress = (personaId: string | undefined): boolean => Boolean(personaId) && BILLING_ADDRESS_EDITOR_ROLES.includes(personaId as string);

export interface BillingAddressFields {
  zone?: string;
  streetNo?: string;
  buildingNo?: string;
  aptFlatUnit?: string;
  floor?: string;
  area?: string;
  city?: string;
  country?: string;
  poBox?: string;
  addressLine?: string;
}

/** An address as one line, from the unit outward: "Unit 101, Floor 1, Building 12, Street 830, Zone 55, Al Waab, Doha, Qatar". Empty parts are left out; undefined when nothing is given. */
export function billingAddressLine(a: BillingAddressFields | undefined): string | undefined {
  if (!a) return undefined;
  const has = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);
  const parts = [
    has(a.aptFlatUnit) && `Unit ${has(a.aptFlatUnit)}`,
    has(a.floor) && `Floor ${has(a.floor)}`,
    has(a.buildingNo) && `Building ${has(a.buildingNo)}`,
    has(a.streetNo) && `Street ${has(a.streetNo)}`,
    has(a.zone) && `Zone ${has(a.zone)}`,
    has(a.area),
    has(a.city),
    has(a.country),
    has(a.poBox) && `PO Box ${has(a.poBox)}`,
    has(a.addressLine),
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

/** What a new account's profile holds as its billing address: the Installation Address while the box is ticked (the default), else the address the agent gave. */
export function newAccountBillingAddress(sameAsInstallation: boolean | undefined, installation: BillingAddressFields | undefined, given: BillingAddressFields | undefined): string | undefined {
  return sameAsInstallation === false ? billingAddressLine(given) : billingAddressLine(installation);
}
