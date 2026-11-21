// What the secondary contact (the actual user, on the Supplementary Form) agrees to: the English default. The business's own wording, in either language, comes from its
// CAF_postpaid_secondary_<language> document (public/config/caf-content/) and replaces this wherever it is provided.
export const SECONDARY_CONTACT_TERMS = [
  { title: 'Package Management', body: 'The Ahli Package Owner can manage your number, including SIM replacement, plan changes, add-ons, and service requests.' },
  { title: 'Billing & Usage', body: 'All Ahli Package charges are billed to the Ahli Package Owner, who can view usage, allowances, and billing details.' },
  { title: 'Your Privacy', body: 'The Ahli Package Owner cannot access your call or SMS content, browsing history, or location information.' },
  { title: 'Leaving the Package', body: 'You can request to leave the Ahli Package, subject to any applicable commitments and outstanding charges.' },
] as const;
