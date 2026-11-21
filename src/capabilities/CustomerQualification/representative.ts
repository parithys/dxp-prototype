import type { IdLookupValue } from '../../components/patterns/idLookupModel';
import type { GuidedContactValue } from '../../components/patterns/guidedContactModel';
import type { AdditionalDocument } from '../DocumentUpload';

/**
 * CUSTOMER REPRESENTATIVE - someone who is physically present on behalf of the actual customer (a Power of Attorney, a Court Order ...). It is a mode of the Contact page
 * of an existing journey, not a journey of its own: `values.contact` stays the ACTUAL customer (typed details, MOI, eligibility - exactly what the journey already uses), and
 * everything the representative adds is kept here, under `values.customerRepresentative`. Nothing downstream of the Contact page is representative-specific except the CAF's signing context.
 */
export interface CustomerRepresentativeValue {
  /** The "Customer Representative" option on the Contact page is ticked. */
  enabled?: boolean;
  /** The actual customer's ID documents (original, printed or digital copies), any number, scanned or uploaded after their typed details were validated. */
  actualIdDocuments?: AdditionalDocument[];
  /** The Power of Attorney / Authorization Letter / Court Order, or other supporting documents. */
  authorizationDocuments?: AdditionalDocument[];
  /** The representative's own ID, as the reader captured it (and MOI validated it, when the agent chose to). */
  identity?: IdLookupValue;
}

/**
 * DEMO: the card the simulated reader presents when the authorized person's ID is scanned, for each ID type: a customer's own document, found by its number. It stands for the
 * person who is physically present. When it is the actual customer's own (the person is the customer), the reader falls back to any other customer.
 */
export const DEMO_AUTHORIZED_PERSON_IDS: Readonly<Record<string, string>> = {
  QID: '27798765432',
  Passport: 'P0998812',
  'GCC ID': '784202312345678',
  'Diplomatic ID': 'DIP-QA-004977',
};

/** The authorization / supporting document types the agent chooses from. */
export const AUTHORIZATION_DOCUMENT_TYPES = ['Power of Attorney / Authorization Letter / Court Order', 'Other Supporting Document'];

/** The one authorization document that is mandatory; the other type is optional. */
export const MANDATORY_AUTHORIZATION_DOCUMENT = AUTHORIZATION_DOCUMENT_TYPES[0];

/**
 * Whether the authorized person's ID must be MOI-validated before the journey goes on. The Authorization / Supporting Documents are asked for only once it is, and Continue
 * needs them, so it is. (The Customer Representative Flow, section 8, leaves this to a business decision; set this to false, and show the documents without it, to relax it.)
 */
export const REPRESENTATIVE_MOI_MANDATORY = true;

export const customerRepresentativeOf = (values: Record<string, unknown>): CustomerRepresentativeValue | undefined => values.customerRepresentative as CustomerRepresentativeValue | undefined;

/** The order is being placed by a representative on behalf of the actual customer. */
export const isRepresentativeOrder = (values: Record<string, unknown>): boolean => Boolean(customerRepresentativeOf(values)?.enabled);

const sameIdNumber = (a?: string, b?: string): boolean => Boolean(a && b) && a!.replace(/\s/g, '').toUpperCase() === b!.replace(/\s/g, '').toUpperCase();

/** The representative's ID is captured: a type, a number and an expiry (read off the scan and checked by the agent) - or MOI has answered. */
export const representativeIdentified = (identity: IdLookupValue | undefined): boolean =>
  Boolean(identity?.idType && identity.idNumber && (identity.scannedExpiry || identity.moiResult)) && (!REPRESENTATIVE_MOI_MANDATORY || Boolean(identity?.moiResult));

/** What stops the representative from being the one signing, or undefined when nothing does. */
export function representativeProblem(values: Record<string, unknown>): string | undefined {
  const rep = customerRepresentativeOf(values);
  if (!rep?.enabled) return undefined;
  const contact = values.contact as GuidedContactValue | undefined;
  if (rep.identity?.idNumber && sameIdNumber(rep.identity.idNumber, contact?.idNumber)) return "This is the actual customer's own ID. Identify the representative who is present.";
  return undefined;
}

/** The Contact page of the scenario (the actual customer only) may continue: at least one ID document of the actual customer is attached. */
export function isActualCustomerDocumentsComplete(values: Record<string, unknown>): boolean {
  const rep = customerRepresentativeOf(values);
  if (!rep?.enabled) return true;
  return (rep.actualIdDocuments?.length ?? 0) > 0;
}

/** The Authorized Person page may continue: the Power of Attorney / Authorization Letter / Court Order is attached (the other supporting document is optional), and the authorized person's own ID is captured and is a different person's. */
export function isAuthorizedPersonComplete(values: Record<string, unknown>): boolean {
  const rep = customerRepresentativeOf(values);
  if (!rep?.enabled) return true;
  return Boolean(rep.authorizationDocuments?.some((d) => d.label === MANDATORY_AUTHORIZATION_DOCUMENT)) && representativeIdentified(rep.identity) && !representativeProblem(values);
}

/** Everything the scenario asks for, on both pages. */
export const isRepresentativeComplete = (values: Record<string, unknown>): boolean => isActualCustomerDocumentsComplete(values) && isAuthorizedPersonComplete(values);

/** The representative's name for the CAF: what MOI returned, else the number of the ID they presented. Undefined when not a representative order. */
export function representativeName(values: Record<string, unknown>): string | undefined {
  const rep = customerRepresentativeOf(values);
  if (!rep?.enabled) return undefined;
  return rep.identity?.moiResult?.name ?? (rep.identity?.idNumber ? `Representative (ID ${rep.identity.idNumber})` : 'Authorised Representative');
}
