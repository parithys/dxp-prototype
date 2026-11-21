// The language the customer reads and signs in on the CAF & Signature screen: English (the default) or Arabic.
//
// NOTHING Arabic is written in the app, and nothing is translated at run time. The business supplies the wording itself, one document per journey, party and language:
//
//   CAF_<journey>_<party>_<language>.docx      e.g. CAF_postpaid_primary_english.docx, CAF_postpaid_primary_arabic.docx,
//                                                   CAF_postpaid_secondary_english.docx, CAF_postpaid_secondary_arabic.docx
//
// A script turns each document into a configuration file in public/config/caf-content/ (see its README), and the app reads the screen's headings, labels and Terms &
// Conditions from there. Arabic is not "the English, translated": it is its own document. Where a document is not provided, the app's built-in English shows.

export type CafLanguage = 'en' | 'ar';
export type CafParty = 'primary' | 'secondary';
export type CafJourney = 'postpaid' | 'prepaid';

export const CAF_LANGUAGES: { key: CafLanguage; /** The word in the document's file name. */ file: 'english' | 'arabic'; label: string; dir: 'ltr' | 'rtl' }[] = [
  { key: 'en', file: 'english', label: 'English', dir: 'ltr' },
  // The tab's own name in Arabic is a label of the toggle, not content of the document; it is the language's name for itself.
  { key: 'ar', file: 'arabic', label: 'العربية', dir: 'rtl' },
];

/** The labels of the screen with the built-in English wording: what shows where the business's document for the language does not give one. */
export const CAF_LABELS = {
  keyInformation: 'Key Information',
  keyTerms: 'Key Terms & Conditions',
  terms: 'Terms & Conditions',
  supplementaryKeyTerms: 'Supplementary Key Terms & Conditions',
  prepaidTerms: 'Prepaid Terms & Conditions',
  ipayTerms: 'iPAY Terms & Conditions',
  ipayActivation: 'iPAY Activation',
  enabled: 'Enabled',
  disabled: 'Disabled',
  primaryContact: 'Primary Contact',
  secondaryContact: 'Secondary Contact',
  authorisedRepresentative: 'Authorised Representative',
  onBehalfOf: 'On behalf of',
  theActualCustomer: 'the actual customer',
  onBehalfStatement: '{representative} signs on behalf of {customer}, as their authorised representative, under the authorization documents provided, and accepts these Terms and Conditions on their behalf.',
  signed: 'Signed',
  signedBy: 'Signed by',
  thePrimaryCustomer: 'the primary customer',
  understandCopy: 'I understand that a copy of the Terms and Conditions will be delivered to the email I provided and verified.',
  marketing: 'I agree to receive marketing communications and special offers (Campaigns).',
  readAgreedFull: 'I have read and agreed to the full',
  fullTermsLink: 'Terms and Conditions',
  readAgreedSupplementary: 'I have read and agreed to the applicable',
  supplementaryTermsLink: 'Supplementary Terms',
  signedAgreementFull: 'I have read and agreed to the full Terms and Conditions.',
  signedAgreementSupplementary: 'I have read and agreed to the applicable Supplementary Terms.',
  pleaseSign: 'Please Sign',
  save: 'Save Signature',
  clear: 'Clear',
  supplementaryFormSecondary: 'Supplementary Key Terms & Conditions: Secondary Contact',
  readAgreedSupplementaryForm: 'I have read and agree to the',
  supplementaryForm: 'Supplementary Form',
  primaryCustomer: 'Primary Customer',
  language: 'Language',
} as const;

export type CafLabelKey = keyof typeof CAF_LABELS;

/** One of the business's CAF documents, as the script writes it: the heading, the sections (title and wording) and the screen's labels. */
export interface CafContentDoc {
  journey: CafJourney;
  party: CafParty;
  language: CafLanguage;
  /** The file the content was read from. */
  source?: string;
  /** A demonstration stand-in (a translation of the built-in English) kept until the business's own document replaces it - the converter never writes it. */
  demo?: boolean;
  /** The document's own heading (Key Terms & Conditions ...). */
  heading?: string;
  sections?: { title: string; body: string }[];
  /** The screen's labels, by key (CAF_LABELS), in the document's language. */
  labels?: Partial<Record<CafLabelKey, string>>;
}

/** The name, without extension, of the business's document: CAF_postpaid_primary_arabic. */
export const cafContentName = (journey: CafJourney, party: CafParty, language: CafLanguage): string =>
  `CAF_${journey}_${party}_${CAF_LANGUAGES.find((l) => l.key === language)?.file ?? 'english'}`;
