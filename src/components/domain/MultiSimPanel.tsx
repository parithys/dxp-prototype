import type { SimTypeValue } from './SimTypeStep';

/** A SIM is in once it is validated (Physical) or issued (eSIM) - the same test as everywhere (isSimComplete in patterns/prepaidCartModel), kept here as domain components import nothing from patterns. */
const isSimIn = (sim: SimTypeValue | undefined): boolean => (sim?.simType === 'Physical' ? sim.simValid === true : sim?.simType === 'eSIM' ? sim.esimIssued === true : false);

interface MultiSimPanelProps {
  /** How many Multi-SIMs the order provisions. */
  count: number;
  /** The SIMs selected so far, in order (chosen with the Multi SIM add-on on the Addons page). */
  value: readonly SimTypeValue[];
}

/**
 * The order's Multi-SIMs on the SIM Selection page, read-only. Each SIM's type (Physical SIM or eSIM) and serial number were decided when the Multi SIM add-on was configured on the
 * Addons page, so nothing is chosen, scanned or generated here: every SIM is shown as it is - SIM Type, SIM Serial Number (an eSIM's is its ICCID, as for the primary SIM). No number is shown: a Multi-SIM shares the Primary SIM's MSISDN. A SIM not yet selected says where to select it.
 */
export function MultiSimPanel({ count, value }: MultiSimPanelProps) {
  return (
    <ul className="stack gap-3" aria-label="Multi-SIMs">
      {Array.from({ length: Math.max(0, count) }, (_, i) => {
        const sim = value[i];
        const done = isSimIn(sim);
        return (
          <li key={i} className="stack gap-2">
            <p className="value-text">Multi SIM {i + 1}</p>
            {done ? (
              <dl className="notice-success notice-body-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-fg">SIM Type</dt>
                  <dd className="text-fg font-medium">{sim?.simType === 'eSIM' ? 'eSIM' : 'Physical SIM'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg">SIM Serial Number</dt>
                  <dd className="text-fg font-medium">{(sim?.simType === 'eSIM' ? sim.simIccid : sim?.simSerial) ?? '-'}</dd>
                </div>
              </dl>
            ) : (
              <p className="caption-muted">No SIM selected yet. Select it with the Multi SIM add-on on the Addons page.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
