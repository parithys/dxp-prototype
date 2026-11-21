import type { ReactNode } from 'react';
import { Card, CARD_SELECTED } from 'dxp-ui';

// The selectable-card states and marks live in the design-system library; re-exported here so the offer and plan cards keep one import.
export { CARD_SELECTED, CARD_IDLE, CARD_HIGHLIGHT, SelectedCardTexture, SelectedTick } from 'dxp-ui';

// Pieces shared by the two card grids that present a plan: the Recommended-offers cards (new-connection
// steps) and the Plan & Add-ons plan cards (PostpaidPlanStep). One definition, so the two stay alike.


/**
 * The price figure of the plan or pack the agent has chosen ("Monthly plan QAR 145", "Starter pack QAR 50"), on the selected-card highlight
 * (CARD_SELECTED), not on a white card: the same look as the selected plan card it came from. One definition for every step that restates the
 * chosen plan or pack.
 */
export function SelectedPlanFigure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className={`px-4 py-2.5 text-right ${CARD_SELECTED}`}>
      <p className="text-muted text-[length:var(--fs-tag)] caps-strong">{label}</p>
      <p className="text-fg">{children}</p>
    </Card>
  );
}
