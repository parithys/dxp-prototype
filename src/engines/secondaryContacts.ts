/**
 * A SECONDARY CONTACT is a person who is attached to someone else's account (the primary contact): the customer record of the secondary contact holds the
 * link, so their own Customer 360 can show who they are linked to and through what. A link names the primary customer, the account, the billing profile and
 * the services the secondary contact is tied to (some of the account's services, or all). One person can be the secondary contact on more than one account.
 */
export interface SecondaryContactLink {
  primaryCustomerId: string;
  accountId: string;
  billingProfileId: string;
  /** The services (numbers) on that account the secondary contact is tied to. */
  serviceIds: string[];
}

/** A link with the names a screen shows beside the ids. */
export interface ResolvedSecondaryContactLink extends SecondaryContactLink {
  primaryName?: string;
  billingProfileName?: string;
}

type HasLinks = { secondaryContactFor?: SecondaryContactLink[] } | undefined;

/** Every link on the record, in the order recorded. */
export function secondaryContactLinksOf(c: HasLinks): SecondaryContactLink[] {
  return Array.isArray(c?.secondaryContactFor) ? c.secondaryContactFor : [];
}

/** The links with the primary customer's name and the billing profile's name filled in from the records (left empty when a record is missing: unknown stays unknown). */
export function resolveSecondaryContactLinks(
  c: HasLinks,
  customers: { customerId: string; name?: string }[],
  billingProfiles: { billingProfileId?: unknown; name?: unknown }[]
): ResolvedSecondaryContactLink[] {
  return secondaryContactLinksOf(c).map((l) => ({
    ...l,
    primaryName: customers.find((x) => x.customerId === l.primaryCustomerId)?.name,
    billingProfileName: (() => {
      const name = billingProfiles.find((b) => b.billingProfileId === l.billingProfileId)?.name;
      return typeof name === 'string' ? name : undefined;
    })(),
  }));
}
