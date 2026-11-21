import { visaFromMoi, type PassportVisa } from '../../data/passportVisa';
import { reconcileIdentity, reconciliationPasses, type AttributeMatch } from './idReconciliation';

interface RegistryIdentity {
  name?: string;
  dob?: string;
  nationality?: string;
  visa?: Partial<PassportVisa>;
}
export interface PassportVisaSources {
  /** MOI's identity documents: a Passport held by a customer. */
  docs: { customerId: string; documentType: string; documentNumber: string; visa?: Partial<PassportVisa> }[];
  customers: { customerId: string; name: string; dob: string; nationality: string }[];
  /** NAS: a person the registry knows who has no customer record. */
  nas: { documentType: string; documentNumber: string; name: string; dob: string; nationality: string; visa?: Partial<PassportVisa> }[];
}

const same = (a: string, b: string) => a.replace(/[\s-]/g, '').toUpperCase() === b.replace(/[\s-]/g, '').toUpperCase();

/**
 * The visa MOI returns for a Passport number the agent typed. The visa is MOI's, never the agent's: it comes from the registry's record for that
 * number, and only when the person the registry holds under it is the person typed (name, date of birth and nationality agree) - otherwise the
 * typed identity is refused with the attributes that differ, and no visa is taken. A number the registry does not know returns nothing (no visa,
 * nothing invented): the eligibility check then stops the journey as it does for any Passport without a valid visa. An incomplete visa is not kept.
 */
export function passportVisaFromMoi(
  idNumber: string,
  typed: { name?: string; dob?: string; nationality?: string },
  { docs, customers, nas }: PassportVisaSources
): { known: boolean; visa?: PassportVisa; mismatch?: AttributeMatch[] } {
  const doc = docs.find((d) => d.documentType === 'Passport' && same(d.documentNumber, idNumber));
  const owner = doc ? customers.find((c) => c.customerId === doc.customerId) : undefined;
  const source: RegistryIdentity | undefined = doc ? owner && { ...owner, visa: doc.visa } : nas.find((n) => n.documentType === 'Passport' && same(n.documentNumber, idNumber));
  if (!source) return { known: Boolean(doc) };
  const recon = reconcileIdentity({ name: typed.name, dob: typed.dob, nationality: typed.nationality }, { name: source.name, dob: source.dob, nationality: source.nationality });
  if (!reconciliationPasses(recon)) return { known: true, mismatch: recon };
  return { known: true, visa: visaFromMoi(source.visa) };
}
