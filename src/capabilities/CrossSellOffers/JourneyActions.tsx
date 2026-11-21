import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon, CHEVRON_RIGHT, ICONS_PHONE, ICONS_SWAP, ICON_CARD, MOBILE_ALT } from 'dxp-ui';
import { SERVICE_JOURNEYS } from './serviceJourneys';
import type { ServiceJourney } from './serviceJourneys';
import type { OfferTone } from './crossSalesModel';

// The journeys the agent can start from the Offers step, left to right, ending with the primary action. Postpaid continues in this wizard; the
// others leave for their own wizard. "New Fixed Line" is the fixed-line (home broadband) journey.
const JOURNEY_BUTTONS: { label: string; hint: string; journey: ServiceJourney; icon: string; tone?: OfferTone }[] = [
  { label: 'New Fixed Line', hint: 'Landline service', journey: 'new-fixed-line', icon: ICONS_PHONE },
  { label: 'New MNP', hint: 'Keep your number', journey: 'mnp-postpaid', icon: ICONS_SWAP, tone: 'pink' },
  { label: 'New Prepaid', hint: 'Pay as you go', journey: 'new-prepaid', icon: MOBILE_ALT, tone: 'green' },
  // Each name is in the tone of its offer card's name (offer-tone-*): Postpaid blue, MNP pink, Prepaid green; New Home (amber, as Fibre) is set where that button is made.
  { label: 'New Postpaid', hint: 'Monthly plans', journey: 'new-postpaid', icon: ICON_CARD, tone: 'blue' },
];

/**
 * A journey as one option of Recommended Offers' "Start another journey" bar (see .journey-bar): its icon, its name with a chevron, and a line saying what it is. Used by that page's bar only.
 */
export function JourneyCardButton({ label, hint, icon, tone, onClick }: { label: string; hint?: string; icon: string; tone?: OfferTone; onClick: () => void }): ReactNode {
  return (
    <button type="button" onClick={onClick} className={`journey-option ${tone ? `offer-tone-${tone}` : ''}`}>
      <Icon path={icon} className={`size-6 ${tone ? 'offer-accent' : ''}`} />
      <span className="row-between gap-2">
        <span className={`whitespace-nowrap font-bold ${tone ? 'offer-accent' : 'text-fg'}`}>{label}</span>
        <Icon path={CHEVRON_RIGHT} className="size-4 text-muted" />
      </span>
      {/* -mt-1: the subtitle sits a little closer to the name than the icon does. */}
      {hint && <span className={`-mt-1 ${tone ? 'caption-muted offer-accent' : 'caption-muted'}`}>{hint}</span>}
    </button>
  );
}

/**
 * Offers-step footer: one button per journey instead of Skip / Interested / Accept (the offer cards carry their own
 * Interested and Select Offer buttons).
 *  - The journey's own button (New Postpaid, or New Prepaid in its wizard): no offer is taken; record the decline and go on to Plan & Add-ons. The decline changes the draft
 *    values first and the step moves a render later, so the wizard has recomputed its steps (declining re-opens the
 *    plan step an accepted offer would have skipped) before it advances.
 *  - The others leave for that journey's own wizard.
 */
export function NewJourneyButtons({
  onDecline,
  goNext,
  onHandOff,
  journey: here = 'new-postpaid',
  allowed,
  variant,
}: {
  onDecline: () => void;
  goNext: () => void;
  onHandOff: (route: string) => void;
  /** The journey the step belongs to: its button is the primary one and declines the offers instead of leaving. */
  journey?: ServiceJourney;
  /** Which journeys this role may start (its grants): a button for a journey it cannot use is not shown. Omitted: all. The journey's own button always stays. */
  allowed?: (journey: ServiceJourney) => boolean;
  /** 'cards': each journey as a compact card (Recommended Offers' floating bar, where they are the page's main way on) instead of a button. */
  variant?: 'cards';
}) {
  // Each decline bumps `requested`; the effect below acts once per request, a render later (no state set in the effect).
  const [requested, setRequested] = useState(0);
  const handled = useRef(0);
  useEffect(() => {
    if (handled.current === requested) return;
    handled.current = requested;
    goNext();
  }, [requested, goNext]);
  return (
    <div className={variant === 'cards' ? 'contents' : 'row'}>
      {/* The journey's own button comes last, as the primary action. */}
      {[...JOURNEY_BUTTONS].filter((b) => b.journey === here || !allowed || allowed(b.journey)).sort((a, b) => Number(a.journey === here) - Number(b.journey === here)).map(({ label, hint, journey, icon, tone }) => {
        const route = SERVICE_JOURNEYS.find((j) => j.key === journey)?.route;
        const current = journey === here;
        const act = () => {
          if (current) {
            onDecline();
            setRequested((n) => n + 1);
          } else if (route) {
            onHandOff(route);
          }
        };
        if (variant === 'cards') return <JourneyCardButton key={journey} label={label} hint={hint} icon={icon} tone={tone} onClick={act} />;
        return (
          <Button
            key={journey}
            variant={current ? 'default' : 'secondary'}
            onClick={() => {
              if (current) {
                onDecline();
                setRequested((n) => n + 1);
              } else if (route) {
                onHandOff(route);
              }
            }}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
