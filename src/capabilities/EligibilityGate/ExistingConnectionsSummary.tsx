import type { ExistingConnectionsSummaryData } from './existingConnectionsSummaryModel';

const ROWS: { key: 'postpaid' | 'prepaid' | 'fixed'; label: string }[] = [
  { key: 'postpaid', label: 'Postpaid' },
  { key: 'prepaid', label: 'Prepaid' },
  { key: 'fixed', label: 'Home' },
];

/**
 * The Existing Connections Summary: the customer's active connections, in total and by line type, with a warning panel only when something needs the agent's attention.
 * Informational (a soft stop): it carries no action and never blocks Continue. Shown on the Contact page only, as a full-width banner just below the page title, the figures side by side.
 */
export function ExistingConnectionsSummary({ summary }: { summary: ExistingConnectionsSummaryData }) {
  // One slim row; when something needs the agent's attention the whole row takes the amber warning colour so it is seen at once.
  const figures: { label: string; value: number }[] = [{ label: 'Total', value: summary.total }, ...ROWS.map((r) => ({ label: r.label, value: summary[r.key] }))];
  const alerting = summary.warnings.length > 0;
  return (
    <section aria-label="Existing connections" role={alerting ? 'alert' : undefined} className={`connections-banner ${alerting ? 'notice-warn-solid' : 'card'}`}>
      <h3 className="title title-sm font-semibold">Existing Connections</h3>
      {figures.map((f) => (
        <span key={f.label} className="connections-figure">
          <span className="caption-secondary">{f.label}</span>
          <span className="value-text font-bold">{f.value}</span>
        </span>
      ))}
      {summary.warningParts.map((w) => (
        <span key={`${w.label}: ${w.message}`} className="connections-warning">
          <strong className="font-bold">{w.label}: </strong>
          {w.message}
        </span>
      ))}
    </section>
  );
}
