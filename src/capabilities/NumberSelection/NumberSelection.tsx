import { MsisdnPicker } from '../../components/domain/MsisdnPicker';
import type { NumberPickerProfile } from '../../components/domain/msisdnPickerModel';

/**
 * NUMBER SELECTION - the one application-wide capability for choosing a number: search, the Free and Star bands,
 * the Star price-range filter, the plan's Star entitlement note, reservation, and choosing the same number again
 * to clear it.
 *
 * Journeys mount THIS component (usually through numberSelectionStep in wizard/wizardSteps) and state what their
 * context needs; none of them wires MsisdnPicker itself.
 *
 *   variant   'journey' (default): inside a guided journey.
 *             'portal': the standalone Number Management Portal (its own tab order and Reserved tab). Same look either way.
 *   plan      the selected plan's MRC / Star entitlement, when the journey has chosen one, for the
 *             "Star Number up to QAR x is free" note. Omitted where no plan is known.
 */
export interface NumberSelectionProps {
  /** The chosen number, if any. */
  value?: string;
  /** A number was chosen (with its catalogue price) or, with no arguments, the choice was cleared. */
  onChange: (msisdn?: string, priceQAR?: number) => void;
  variant?: 'journey' | 'portal';
  plan?: { mrcQar?: number; starEntitlementQar?: number };
  /** Changes when the agent presses Refresh: the number inventory is read again. */
  refreshKey?: number;
  /** Portal only: the numbers reserved in this portal session, listed on its Reserved tab. */
  reservedHere?: string[];
  /** Journey: the customer's ID number; the Reserved tab lists only holds placed for it. */
  customerIdNumber?: string;
  /** Portal only: an Unreserve button on each Reserved Numbers card. */
  onUnreserve?: (msisdn: string) => void;
  /** What the journey says about the content by role and plan (Mobile Prepaid: tabs by role, no sorting, no Star lock-in, no plan entitlement). Omitted: as it always was. */
  profile?: NumberPickerProfile;
  /** The additional discount (QAR) applied to the chosen number's upfront charge: its card shows the charge after it. */
  waiverQar?: number;
}

export function NumberSelection({ value, onChange, variant = 'journey', plan, refreshKey, reservedHere, onUnreserve, customerIdNumber, profile, waiverQar }: NumberSelectionProps) {
  const inJourney = variant === 'journey';
  return (
    <MsisdnPicker
      selected={value}
      onSelect={(msisdn, priceQAR) => onChange(msisdn, priceQAR)}
      // Choosing a number again clears the choice, in a journey and in the portal alike (in the portal, choosing only selects; the
      // reservation is made after Customer Verification).
      onDeselect={() => onChange()}
      refreshKey={refreshKey}
      planMrcQar={plan?.mrcQar}
      starEntitlementQar={plan?.starEntitlementQar}
      hideReservedBadge={inJourney}
      // The portal alone has its own tab order (Star, Free, Reserved) and shows no number that was already held.
      portalMode={!inJourney}
      reservedHere={reservedHere}
      customerIdNumber={inJourney ? customerIdNumber : undefined}
      onUnreserve={inJourney ? undefined : onUnreserve}
      profile={profile}
      waiverQar={waiverQar}
    />
  );
}
