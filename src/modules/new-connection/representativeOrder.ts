import { customerRepresentativeOf, representativeName } from '../../capabilities/CustomerQualification/representative';
import { idScanAttachments } from './idScanAttachments';

/** An order placed by a Customer Representative on behalf of the actual customer (the order's customer): who they are. Nothing when it is not a representative order. */
export function representativeOrderFields(values: Record<string, unknown>): Record<string, unknown> {
  const name = representativeName(values);
  if (!name) return {};
  const identity = customerRepresentativeOf(values)?.identity;
  return { placedByRepresentative: true, representativeName: name, representativeIdType: identity?.idType, representativeIdNumber: identity?.idNumber };
}

/** The confirmation page's line for the authorised representative, under the customer's name; nothing when it is not a representative order. */
export const representativeConfirmation = (values: Record<string, unknown>): { authorisedRepresentative?: string } => {
  const name = representativeName(values);
  return name ? { authorisedRepresentative: name } : {};
};

/** What authorises them: the actual customer's ID document, the authorization documents and the representative's own ID scans. Empty when it is not a representative order. */
export function representativeAttachments(values: Record<string, unknown>): { label: string; detail?: string; fileName?: string }[] {
  const r = customerRepresentativeOf(values);
  if (!r?.enabled) return [];
  return [
    ...(r.actualIdDocuments ?? []).map((d) => ({ label: 'Actual Customer ID', detail: d.fileName })),
    ...(r.authorizationDocuments ?? []).map((d) => ({ label: d.label, detail: d.fileName })),
    ...idScanAttachments(r.identity?.idType, r.identity?.qidScans, { idNumber: r.identity?.idNumber }).map((a) => ({ ...a, label: `Representative: ${a.label}` })),
  ];
}
