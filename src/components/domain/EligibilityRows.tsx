import { Button, Drawer, Icon } from 'dxp-ui';
import { useState } from 'react';
import type { EligibilityResult } from './eligibilityTypes';
import { ROW_ICON, buildEligibilityRows, OUTCOME_LEGEND } from './eligibilityRowsModel';
import type { EligibilityRow } from './eligibilityRowsModel';

/** The divided-list row treatment, shared between the inline "needs
 * attention" panel (unresolved rows only) and the "View eligibility checks"
 * popup (every row) - see buildEligibilityRows' own note on why this is one
 * function rather than two near-identical blocks. */
export function EligibilityChecksList({ rows }: { rows: EligibilityRow[] }) {
  // Every result is a card of its own - a border all round in the outcome's colour (no strip on one side), a large white icon on a solid tile in that colour, the title in a heading size and the instruction in
  // full-strength body text, no shadow - so it cannot be read past. The same card wherever results are listed: on the step, in the "View eligibility checks" drawer, in the
  // outcome preview, and for the HRN advance and the ID type's approval.
  return (
    <ul className="stack gap-3" aria-label="Eligibility results">
      {rows.map((row) => (
        // The alert role sits on the card inside the <li>, not on the <li> itself: a role on the item replaces "listitem" and leaves the list
        // with children a list may not have (axe "list", WCAG 1.3.1).
        <li key={row.id}>
          <div role="alert" className={`eligibility-alert eligibility-alert-${row.tone}`}>
            <span className="eligibility-alert-icon" aria-hidden="true">
              <Icon path={ROW_ICON[row.tone]} className="" />
            </span>
            <div className="min-w-0 flex-1 stack gap-1">
              <p className="title title-md leading-snug">{row.title}</p>
              {/* The RESULT, not a static description of what the check does. */}
              {row.detail && <p className="text-fg text-[length:var(--fs-body)] note-line">{row.detail}</p>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EligibilityOutcomeLegend() {
  return (
    <div className="mt-6 pt-4 divider-top">
      <h4 className="title title-sm font-semibold mb-2">What These Outcomes Mean</h4>
      <ul className="list-disc pl-5 space-y-2">
        {OUTCOME_LEGEND.map((item) => (
          <li key={item.title} className="text-[length:var(--fs-caption)] leading-snug">
            <span className="font-semibold text-fg">{item.title}</span>{' '}
            <span className="text-fg-2">{item.detail}</span>
            <br />
            <span className="text-muted italic">{item.example}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Footer-left link (2026-09-28: "Add a text link on the left side. On click,
 * open a popup showing all eligibility checks performed and their results.")
 *
 * The inline panel below renders NOTHING once every check passes (a
 * deliberate silence - see its own note on `unresolved.length === 0`), so a
 * clean run leaves no on-screen trace of what actually ran beyond a toast
 * that has already faded. This is the way back to that full list, available
 * regardless of whether anything needs attention.
 */
export function EligibilityChecksLink({
  eligibility,
  journeyType = 'postpaid',
  label = 'View eligibility checks',
}: {
  eligibility: EligibilityResult | undefined;
  journeyType?: 'postpaid' | 'prepaid';
  /** Link text, also used as the drawer title when overridden. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!eligibility) return null;
  const rows = buildEligibilityRows(eligibility.checks, eligibility.requiresHrnAdvance, eligibility.nationality, journeyType, eligibility.isExistingCustomer);
  return (
    <>
      <Button variant="tertiary" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={label === 'View eligibility checks' ? 'Eligibility Checks' : label}>
        <EligibilityChecksList rows={rows} />
        <EligibilityOutcomeLegend />
      </Drawer>
    </>
  );
}
