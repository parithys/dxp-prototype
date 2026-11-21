import type { EligibilityRow } from '../components/domain/eligibilityRowsModel';

/** One row of every eligibility outcome, for the Eligibility Result Cards specimen. */
export const ELIGIBILITY_SAMPLE_ROWS: EligibilityRow[] = [
  { id: 'age', title: 'Underage Customer', detail: 'Blocked, no way on: the customer is under 18 years old. Abandon the order or Apply for an Exception using a Court Order.', tone: 'hard-stop' },
  { id: 'gcc-id-postpaid', title: 'Postpaid Not Permitted With GCC ID', detail: 'Blocked, with an alternative: the customer is eligible for Prepaid activation only.', tone: 'soft-stop' },
  { id: 'id-type-routing', title: 'Sales Manager Approval Required', detail: 'Can continue: a Passport requires Sales Manager approval. The order is routed to the Sales Manager queue on submission.', tone: 'approval-routing' },
  { id: 'hrn', title: 'Upfront Payment Required (HRN)', detail: 'Information: an advance payment is required at checkout.', tone: 'advisory' },
  { id: 'id-validity', title: 'ID Validity', detail: 'All clear: valid through 31/05/2031.', tone: 'pass' },
];
