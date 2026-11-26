
import type { OrderTerms, TncSection } from './cafTermsModel';
import { listEntities } from '../../services/entityOps';
import { escapeHtml, printHtmlDocument } from 'dxp-ui';

interface PrintableOrder {
  orderId: string;
  customerName: string;
  terms?: OrderTerms;
}

const header = (title: string, order: PrintableOrder) =>
  `<h1>${escapeHtml(title)}</h1><p class="meta">Order ${escapeHtml(order.orderId)} - ${escapeHtml(order.customerName)}</p>`;

/** The Terms & Conditions the customer signed (the same sections, for the same journey, the CAF step showed). */

/** The Terms & Conditions the customer signed (the same sections, for the same journey, the CAF step showed). */
export async function printTerms(order: PrintableOrder): Promise<void> {
  const journey = order.terms?.journey ?? 'postpaid';
  const sections = (await listEntities<TncSection>('tnc-full-text')).filter((s) => !s.journey || s.journey === journey);
  const body = sections.map((s) => `<h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.body)}</p>`).join('');
  printHtmlDocument('Terms & Conditions', `${header('Vodafone Qatar - Terms & Conditions', order)}${body}`);
}

/** The Supplementary Form of the actual user, which the customer's one signature also signed. Nothing happens without one. */

/** The Supplementary Form of the actual user, which the customer's one signature also signed. Nothing happens without one. */
export function printSupplementaryTerms(order: PrintableOrder): void {
  const supplementary = order.terms?.supplementary;
  if (!supplementary) return;
  const rows = [{ label: 'Primary Customer', value: order.customerName }, ...supplementary.rows]
    .map((r) => `<div><dt>${escapeHtml(r.label)}</dt><dd>${escapeHtml(r.value)}</dd></div>`)
    .join('');
  printHtmlDocument(
    'Supplementary Form',
    `${header('Vodafone Supplementary Form', order)}<dl>${rows}</dl><p>The primary customer's one signature signed both forms: the Customer Application Form and this Supplementary Form.</p>`
  );
}
