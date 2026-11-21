import { escapeHtml, printHtmlDocument } from '../../lib/printDocument';

// The Customer Application Form on paper, for a customer who signs with a pen: the Primary form (the Primary Terms & Conditions) and, when a Secondary Contact is on the line, the
// Supplementary form (the Supplementary Terms & Conditions). Each ends in a signature block. The signed copies are scanned or uploaded back on the CAF & Signature page.

interface Section {
  title: string;
  body: string;
}
interface Row {
  label: string;
  value: string;
}

const SIGNATURE_STYLES = `
  .terms h2 { font-size: 0.95rem; }
  .terms p { font-size: 0.85rem; }
  .agree { margin: 0.5rem 0; font-size: 0.9rem; }
  .sign { display: flex; gap: 3rem; margin-top: 3rem; }
  .sign div { flex: 1; border-top: 1px solid; padding-top: 0.25rem; font-size: 0.85rem; }
  .page-start { break-before: page; page-break-before: always; }
`;

const rowsHtml = (rows: readonly Row[]) => `<dl>${rows.map((r) => `<div><dt>${escapeHtml(r.label)}</dt><dd>${escapeHtml(r.value)}</dd></div>`).join('')}</dl>`;
const sectionsHtml = (sections: readonly Section[]) => `<div class="terms">${sections.map((s) => `<h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.body)}</p>`).join('')}</div>`;
const signatureBlock = (signer: string | undefined, extra?: string) =>
  `<div class="sign"><div>Signature${signer ? ` - ${escapeHtml(signer)}` : ''}${extra ? ` (${escapeHtml(extra)})` : ''}</div><div>Date</div></div>`;
const frame = (dir: 'ltr' | 'rtl', html: string) => `<style>${SIGNATURE_STYLES}</style><div dir="${dir}">${html}</div>`;

/** The Primary CAF: the applicant, the form's own details, the Primary Terms & Conditions and the agreements, with a signature line. */
export function printPrimaryCaf(input: {
  title: string;
  customerName?: string;
  /** A Customer Representative signs for the actual customer. */
  representativeName?: string;
  idLabel?: string;
  idValue?: string;
  details?: readonly Row[];
  keyInformation?: readonly string[];
  sections: readonly Section[];
  agreements: readonly string[];
  dir?: 'ltr' | 'rtl';
}): void {
  const applicant: Row[] = [
    { label: input.representativeName ? 'Actual Customer' : 'Primary Contact', value: input.customerName ?? '-' },
    ...(input.representativeName ? [{ label: 'Authorised Representative', value: input.representativeName }] : []),
    ...(input.idLabel ? [{ label: input.idLabel, value: input.idValue ?? '-' }] : []),
    ...(input.details ?? []),
  ];
  const key = (input.keyInformation ?? []).length > 0 ? `<h2>Key Information</h2>${(input.keyInformation ?? []).map((k) => `<p>${escapeHtml(k)}</p>`).join('')}` : '';
  printHtmlDocument(
    input.title,
    frame(
      input.dir ?? 'ltr',
      `<h1>${escapeHtml(input.title)}</h1>${rowsHtml(applicant)}${key}${sectionsHtml(input.sections)}${input.agreements.map((a) => `<p class="agree">☐ ${escapeHtml(a)}</p>`).join('')}${signatureBlock(input.representativeName ?? input.customerName)}`
    )
  );
}

/** The Supplementary CAF: the primary customer, the Secondary Contact's details, the Supplementary Terms & Conditions, with the Secondary Contact's signature line. */
export function printSupplementaryCaf(input: {
  title: string;
  primaryContactName?: string;
  secondaryContactName?: string;
  rows: readonly Row[];
  sections: readonly Section[];
  agreement: string;
  dir?: 'ltr' | 'rtl';
}): void {
  const details: Row[] = [{ label: 'Primary Customer', value: input.primaryContactName ?? '-' }, ...input.rows];
  printHtmlDocument(
    input.title,
    frame(input.dir ?? 'ltr', `<h1>${escapeHtml(input.title)}</h1>${rowsHtml(details)}${sectionsHtml(input.sections)}<p class="agree">☐ ${escapeHtml(input.agreement)}</p>${signatureBlock(input.secondaryContactName, 'Secondary Contact')}`)
  );
}

/** The iPAY CAF: the customer, the iPAY Terms & Conditions and the agreement, with the applicant's signature line (New Prepaid, while iPAY Activation is Yes). */
export function printIpayCaf(input: { title: string; customerName?: string; representativeName?: string; sections: readonly Section[]; agreement: string; dir?: 'ltr' | 'rtl' }): void {
  const details: Row[] = [{ label: input.representativeName ? 'Actual Customer' : 'Primary Contact', value: input.customerName ?? '-' }, ...(input.representativeName ? [{ label: 'Authorised Representative', value: input.representativeName }] : [])];
  printHtmlDocument(
    input.title,
    frame(input.dir ?? 'ltr', `<h1>${escapeHtml(input.title)}</h1>${rowsHtml(details)}${sectionsHtml(input.sections)}<p class="agree">${'\u2610'} ${escapeHtml(input.agreement)}</p>${signatureBlock(input.representativeName ?? input.customerName)}`)
  );
}

/**
 * The complete Terms & Conditions for a customer who signs on paper: everything the CAF page carries - the key information, the general terms, the Supplementary terms
 * (with a Secondary Contact), the iPAY terms (while iPAY Activation is Yes) - in one document, with where the full text is published. With the contacts given it is the one
 * consolidated form to sign: the Primary Contact's details (and the Secondary Contact's, when there is one), the agreements, and a signature line for each of them. The signed
 * document - one or several files, or a multi-page scan - is taken back on the CAF & Signature page.
 */
export function printFullTerms(input: {
  title: string;
  keyInformation?: readonly string[];
  sections: readonly Section[];
  supplementary?: { heading: string; sections: readonly Section[] };
  ipay?: { heading: string; sections: readonly Section[] };
  fullTermsUrl?: string;
  /** The Primary Contact, named and identified at the top of the document; a Customer Representative signs for the actual customer. */
  primary?: { name?: string; representativeName?: string; idLabel?: string; idValue?: string; details?: readonly Row[] };
  /** The Secondary Contact (a line with an actual user): their details at the top and their own signature line. */
  secondary?: { name?: string; rows: readonly Row[] };
  agreements?: readonly string[];
  dir?: 'ltr' | 'rtl';
}): void {
  const key = (input.keyInformation ?? []).length > 0 ? `<h2>Key Information</h2>${(input.keyInformation ?? []).map((k) => `<p>${escapeHtml(k)}</p>`).join('')}` : '';
  // Each further part (the Supplementary terms, the iPAY terms) starts on a new page of its own.
  const part = (heading: string, sections: readonly Section[]) => `<h1 class="page-start">${escapeHtml(heading)}</h1>${sectionsHtml(sections)}`;
  const primary = input.primary;
  const contacts = primary
    ? `<h2>Primary Contact</h2>${rowsHtml([
        { label: primary.representativeName ? 'Actual Customer' : 'Name', value: primary.name ?? '-' },
        ...(primary.representativeName ? [{ label: 'Authorised Representative', value: primary.representativeName }] : []),
        ...(primary.idLabel ? [{ label: primary.idLabel, value: primary.idValue ?? '-' }] : []),
        ...(primary.details ?? []),
      ])}${input.secondary ? `<h2>Secondary Contact</h2>${rowsHtml([{ label: 'Name', value: input.secondary.name ?? '-' }, ...input.secondary.rows])}` : ''}`
    : '';
  const sign = primary
    ? `${(input.agreements ?? []).map((a) => `<p class="agree">${'\u2610'} ${escapeHtml(a)}</p>`).join('')}${signatureBlock(primary.representativeName ?? primary.name, 'Primary Contact')}${input.secondary ? signatureBlock(input.secondary.name, 'Secondary Contact') : ''}`
    : '';
  const body = `<h1>${escapeHtml(input.title)}</h1>${contacts}${key}${sectionsHtml(input.sections)}${input.supplementary ? part(input.supplementary.heading, input.supplementary.sections) : ''}${input.ipay ? part(input.ipay.heading, input.ipay.sections) : ''}${input.fullTermsUrl ? `<p class="note">The complete Terms and Conditions are published at ${escapeHtml(input.fullTermsUrl)}</p>` : ''}${sign}`;
  printHtmlDocument(input.title, frame(input.dir ?? 'ltr', body));
}
