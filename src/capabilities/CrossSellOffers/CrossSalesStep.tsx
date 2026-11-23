import { useEffect, useState, type KeyboardEvent } from 'react';
import { Button, Icon, STAR, TREND_UP, ICON_CALL, ICON_CARD, ICON_DATA, CHEVRON_RIGHT } from 'dxp-ui';
import { OfferDetailsDrawer } from './OfferDetailsDrawer';
import type { OfferProduct } from '../../components/primitives/offerCardModel';
import { CARD_HIGHLIGHT, CARD_IDLE, CARD_SELECTED, SelectedTick } from '../../components/primitives/offerCardParts';
import { SERVICE_JOURNEYS, journeyLabel, continuesHere, offerTypeOf, hasDestination, offerTypesFor, isHomeJourney, isPrepaidJourney } from './serviceJourneys';
import type { OfferJourneys } from './serviceJourneys';
import { HandOff } from './HandOff';
import { demoOfferSet, offerHighlight, offerTagLabel, offerToneOf, oneOfEachPlanClass } from './crossSalesModel';
import { planFeatureRows } from '../../components/primitives/offerCardModel';
import { formatAmount, formatQar } from '../../lib/format';
import type { CrossSalesValue, Offer } from './crossSalesModel';
import { FIBER_CONNECTION_OFFER, OFFERS_PER_TYPE, STANDARD_OFFERS } from '../../data/standardOffers';
import { isPlanClass } from '../../components/patterns/postpaidPlanModel';
import { listEntities } from '../../services/entityOps';

export function CrossSalesStep({
  customerId,
  value,
  onChange,
  onHandOff,
  onContinue,
  onInterestedOffer,
  journey = 'new-postpaid',
  showAllOfferTypes = false,
  homeRoute,
  homeFit,
}: {
  customerId: string | undefined;
  value: CrossSalesValue;
  onChange: (v: CrossSalesValue) => void;
  /** An offer for another journey (an upgrade, say) continues there: the route, and the identified customer when there is one, so that journey opens for them. */
  /** An offer for another journey (an upgrade, say) continues there: the route, and the identified customer when there is one, so that journey opens for them. */
  onHandOff: (route: string, customer?: { customerId: string }, offer?: Offer) => void;
  /** With onInterestedOffer: each card carries its own Select Offer (take this offer and go on) and Interested (raise a lead
   * for it) buttons in place of "Select offer". */
  /** With onInterestedOffer: each card carries its own Select Offer (take this offer and go on) and Interested (raise a lead
   * for it) buttons in place of "Select offer". */
  onContinue?: () => void;
  onInterestedOffer?: (offer: Offer) => Promise<void>;
  /** The journey (or journeys) this step belongs to: their offers continue here, every other journey's hand off. */
  /** The journey (or journeys) this step belongs to: their offers continue here, every other journey's hand off. */
  journey?: OfferJourneys;
  /**
   * Shows every offer type, none hidden, each topped up with the standard offers to three cards whether or not the customer has campaign offers of it
   * (existing customers). Standard offers are selected like any other. Off: only the types the customer has offers for.
   */
  /**
   * Shows every offer type, none hidden, each topped up with the standard offers to three cards whether or not the customer has campaign offers of it
   * (existing customers). Standard offers are selected like any other. Off: only the types the customer has offers for.
   */
  showAllOfferTypes?: boolean;
  /** Where a New Home offer (fixed line, FWA) leads: choosing one - the card or its Select Offer - opens this route instead of selecting the offer here. */
  homeRoute?: string;
  /** The home offers that fit the service Check RFS found: the New Home cards are these first, then the other home offers. */
  homeFit?: (offer: Offer) => boolean;
}) {
  const offerTypes = offerTypesFor(journey);
  const clickable = !onInterestedOffer;
  const [offers, setOffers] = useState<Offer[] | undefined>();
  // The offer whose comprehensive details are open in the side drawer.
  const [detailOffer, setDetailOffer] = useState<Offer | null>(null);
  // Accept on a card selects the offer, then goes on once that selection has reached the journey's values.
  const [advanceFor, setAdvanceFor] = useState<string | undefined>();
  const [leadBusy, setLeadBusy] = useState<string | undefined>();
  useEffect(() => {
    if (advanceFor && value.decision === 'accepted' && value.offerId === advanceFor) {
      setAdvanceFor(undefined);
      onContinue?.();
    }
  }, [advanceFor, value, onContinue]);
  const [products, setProducts] = useState<Record<string, OfferProduct>>({});
  // Settled (loaded or failed): New Postpaid is laid out by each plan's class, which is read from these products.
  const [productsSettled, setProductsSettled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    listEntities<OfferProduct>('products')
      .then((all) => {
        if (!cancelled) setProducts(Object.fromEntries(all.map((p) => [p.productId, p])));
      })
      .catch(() => {
        // Offers fall back to their ids when the product names cannot be loaded.
      })
      .finally(() => {
        if (!cancelled) setProductsSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const productNames = Object.fromEntries(Object.entries(products).map(([id, p]) => [id, p.name]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [all, contacts] = await Promise.all([
        listEntities<Offer>('cross-sales-offers'),
        listEntities<{ contactRecordId: string; customerId: string }>('customer-contacts'),
      ]);
      const mine = new Set(contacts.filter((c) => c.customerId === customerId).map((c) => c.contactRecordId));
      // Open offers for this customer, in one of the five offer types.
      const open = all.filter((o) => mine.has(o.contactId) && (o.status === 'Offered' || o.status === 'Interested') && offerTypesFor(journey).some((t) => t.key === offerTypeOf(o.serviceJourney)));
      if (!cancelled) setOffers(open);
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, journey]);

  // Nothing on offer is its own outcome, not an empty state to sit in.
  useEffect(() => {
    if (offers && offers.length === 0 && value.decision !== 'none') onChange({ decision: 'none' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers]);

  if (!offers || (showAllOfferTypes && !productsSettled)) return <p className="muted-body">Checking for cross-sales offers…</p>;
  if (offers.length === 0 && !showAllOfferTypes) {
    return (
      <div className="row gap-5 promo-banner p-5">
        <span className="feature-tile size-16 text-[var(--tint-teal-fg)]">
          <Icon path={TREND_UP} className="size-6 " />
        </span>
        <div className="min-w-0">
          <p className="title title-sm font-semibold">No Cross-Sales Offer Available</p>
          <p className="caption-secondary">Continue to choose a service from the standard catalogue.</p>
        </div>
      </div>
    );
  }

  const accepted = offers.find((o) => o.offerId === value.offerId && value.decision === 'accepted');
  // One offer carries the Recommended flag: the best (lowest) priority code, first listed on a tie.
  const recommendedId = [...offers].sort((x, y) => (x.priorityCode ?? 'P9').localeCompare(y.priorityCode ?? 'P9'))[0]?.offerId;
  // Every offer type's offers: a type with none is left out. Within a type the Recommended card comes first, then the rest from the lowest monthly fee to the highest.
  const sections = offerTypes
    .map((type) => {
      const real = offers.filter((o) => offerTypeOf(o.serviceJourney) === type.key ).sort((a, b) => Number(b.offerId === recommendedId) - Number(a.offerId === recommendedId) || a.monthlyRental - b.monthlyRental);
      // New Postpaid: one Voice, one Broadband and one Family plan, the customer's own offer in its class's place.
      if (showAllOfferTypes && type.key === 'new-postpaid') {
        return { type, items: oneOfEachPlanClass(real, STANDARD_OFFERS[type.key], (o) => o.linkedProductIds.map((id) => products[id]?.planClass).find(isPlanClass)) };
      }
      // Every other type shown, topped up with the standard offers (after the customer's own).
      return { type, items: showAllOfferTypes ? [...real, ...STANDARD_OFFERS[type.key].slice(0, Math.max(0, OFFERS_PER_TYPE - real.length))] : real };
    })
    .filter(({ items }) => items.length > 0);
  // No grouping: one list of six cards - New Postpaid's three (Voice, Broadband, Family), then one New Fixed Line, one New MNP and one New Prepaid offer.
  const items = demoOfferSet(Object.fromEntries(sections.map((x) => [x.type.key, x.items])), showAllOfferTypes ? [FIBER_CONNECTION_OFFER] : [], homeFit);
  return (
    <div className="space-y-4">
      <div role={clickable ? 'radiogroup' : 'group'} aria-label="Offers">
          <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(max(15rem,calc((100%-2rem)/3)),1fr))]">
        {items.map((o) => {
          const selected = value.decision === 'accepted' && value.offerId === o.offerId;
          const recommended = o.offerId === recommendedId;
          // The plan the offer opens, read from its linked product: its class is the plan-type tag, in the same corner as on the plan cards.
          const planClass = o.linkedProductIds.map((id) => products[id]?.planClass).find(isPlanClass);
          const perMonth = !(o.serviceJourney === 'new-prepaid' || o.serviceJourney === 'mnp-prepaid');
          // The kind of connection the offer opens colours the card, so every offer of a kind looks alike.
          const typeKey = offerTypeOf(o.serviceJourney);
          const tone = offerToneOf(typeKey);
          // Every card says what kind of offer it is, in its top-right tag.
          const tagLabel = o.cardTag ?? offerTagLabel(typeKey, o.serviceJourney, planClass);
          // What the plan the offer opens says about itself: its promotion (the earlier price, struck through, and how long the offer price runs) and its own facts.
          const plan = o.linkedProductIds.map((id) => products[id]).find(Boolean);
          const promoMonths = plan?.promoMonths;
          const struck = promoMonths && plan?.originalMrcQAR && plan.originalMrcQAR > o.monthlyRental ? plan.originalMrcQAR : undefined;
          const facts = (plan?.features?.length ? plan.features.map((f, i) => ({ icon: i === 0 ? ICON_DATA : /minute|call/i.test(f) ? ICON_CALL : ICON_CARD, text: f })) : planFeatureRows(plan)).slice(0, 4);
          // The whole card is the control: click (or Enter/Space) selects it,
          // and clicking the selected one again clears it.
          // With its own Select Offer / Interested buttons a card is not itself a control: only the buttons act, and the card has no hover or focus of a control.
          const look = selected ? CARD_SELECTED : recommended ? (clickable ? CARD_HIGHLIGHT : 'card-static-highlight') : clickable ? CARD_IDLE : tone ? '' : 'card-static';
          const goHome = () => {
            if (homeRoute) onHandOff(homeRoute, customerId ? { customerId } : undefined, o);
          };
          const toggle = () =>
            homeRoute && isHomeJourney(o.serviceJourney)
              ? goHome()
              : onChange(
              selected
                ? {}
                : { decision: 'accepted', offerId: o.offerId, offerName: o.offerName, journey: o.serviceJourney, linkedProductIds: o.linkedProductIds }
            );
          return (
            <li
              key={o.offerId}
              {...(clickable
                ? {
                    role: 'radio',
                    'aria-checked': selected,
                    tabIndex: 0,
                    onClick: toggle,
                    onKeyDown: (e: KeyboardEvent<HTMLLIElement>) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        toggle();
                      }
                    },
                  }
                : {})}
              className={`relative card-option p-5 stack ${clickable ? 'cursor-pointer' : ''} ${look} ${tone ? `offer-tone-${tone} ${selected || recommended ? '' : 'offer-tone-idle'}` : ''}`}
            >
              {selected && <SelectedTick />}
              {/* Top row, as on every plan card: the Recommended flag on the left, the plan-type tag pinned top-right. */}
              <div className="card-tag-row">
                {recommended && (
                  <span className="tag-accent shrink-0 whitespace-nowrap px-2">
                    <Icon path={STAR} className="size-3 " />
                    Recommended
                  </span>
                )}
                {tagLabel && (
                  <span className="card-plan-tag">
                    <span className={`badge ${tone ? 'offer-tag' : 'badge-filled-neutral'}`}>{tagLabel}</span>
                  </span>
                )}
              </div>
              {/* The plan card's layout (Offers & Plans): the name, the price block - the price before a promotion struck through above, then "QAR n /month for N months" - and
                  the plan's own facts as icon rows. An offer whose plan lists none keeps its description. */}
              <div className="fill-column gap-2">
                <p className={`title title-lg leading-snug ${tone ? 'offer-accent' : ''}`}>{o.offerName}</p>
                <div className="stack gap-0.5">
                  {struck !== undefined && <p className="caption-secondary line-through">{formatQar(struck)}</p>}
                  <p className={`price-row ${tone ? 'offer-price' : ''}`}>
                    <span>
                      <span className="text-[length:var(--fs-body)] font-semibold">QAR </span>
                      <span className="text-[length:var(--fs-h3)] font-bold">{formatAmount(o.monthlyRental)}</span>
                      {perMonth && <span className="caption-secondary"> /month</span>}
                    </span>
                    {promoMonths && <span className="caption-secondary">for {promoMonths} months</span>}
                  </p>
                </div>
                {facts.length > 0 ? (
                  <ul className="space-y-1.5">
                    {facts.map((f) => (
                      <li key={f.text} className="row gap-2 caption-secondary">
                        <Icon path={f.icon} className={`icon-sm ${tone ? 'offer-accent' : 'text-accent'}`} />
                        {f.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="caption-secondary">{o.offerDescription}</p>
                )}
              </div>
              <div className="split gap-y-2 pt-1">
                {/* Opens the full offer details in the side drawer; it stops
                    propagation so looking never selects the offer. */}
                <Button variant="link"
                  type="button"
                  aria-label={`View details for ${o.offerName}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailOffer(o);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="link-inline"
                >
                  View details
                  <Icon path={CHEVRON_RIGHT} className="size-4 " />
                </Button>
                {onInterestedOffer ? (
                  <div className="cluster gap-2 ml-auto">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={leadBusy === o.offerId}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setLeadBusy(o.offerId);
                        try {
                          await onInterestedOffer(o);
                        } finally {
                          setLeadBusy(undefined);
                        }
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      Interested
                    </Button>
                    <Button
                      size="sm"
                      disabled={!(homeRoute && isHomeJourney(o.serviceJourney)) && !hasDestination(o.serviceJourney, journey)}
                      title={
                        hasDestination(o.serviceJourney, journey)
                          ? undefined
                          : o.serviceJourney
                            ? 'This offer\'s journey is not available yet'
                            : 'This offer does not name a journey to continue in'
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (homeRoute && isHomeJourney(o.serviceJourney)) {
                          goHome();
                          return;
                        }
                        // The destination follows the offer: one for a journey this wizard runs (new postpaid, prepaid, home, MNP) is selected and the
                        // wizard goes on; one for another journey (the Prepaid to Postpaid and Postpaid to Postpaid upgrades) opens that journey straight
                        // away, for the customer already identified here.
                        if (continuesHere(o.serviceJourney, journey)) {
                          if (!selected) toggle();
                          setAdvanceFor(o.offerId);
                          return;
                        }
                        const route = SERVICE_JOURNEYS.find((j) => j.key === o.serviceJourney)?.route;
                        if (route) onHandOff(route, customerId ? { customerId } : undefined);
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      Select Offer
                    </Button>
                  </div>
                ) : (
                  /* Presentational: the card is the control, so the button must not take focus or fire a second toggle. */
                  <Button variant={selected ? 'default' : 'secondary'} tabIndex={-1} aria-hidden className="pointer-events-none">
                    {selected ? 'Selected' : 'Select offer'}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
          </ul>
      </div>
      {/* The hand-off banner only exists for offers that continue in another journey (MNP, fixed line); nothing is reserved for it when it is not there. */}
      {accepted && !continuesHere(accepted.serviceJourney, journey) && accepted.serviceJourney && (
        <HandOff journey={accepted.serviceJourney} onGo={(route) => onHandOff(route, customerId ? { customerId } : undefined)} />
      )}
      <OfferDetailsDrawer
        offer={detailOffer}
        serviceLabel={journeyLabel(detailOffer?.serviceJourney) ?? '-'}
        prepaid={isPrepaidJourney(detailOffer?.serviceJourney)}
        fixedService={isHomeJourney(detailOffer?.serviceJourney)}
        highlight={detailOffer ? offerHighlight(detailOffer, products) : null}
        includedNames={(detailOffer?.linkedProductIds ?? []).map((id) => productNames[id] ?? id)}
        selected={Boolean(detailOffer && value.decision === 'accepted' && value.offerId === detailOffer.offerId)}
        onSelect={() =>
          detailOffer &&
          onChange({
            decision: 'accepted',
            offerId: detailOffer.offerId,
            offerName: detailOffer.offerName,
            journey: detailOffer.serviceJourney,
            linkedProductIds: detailOffer.linkedProductIds,
          })
        }
        onClose={() => setDetailOffer(null)}
      />
    </div>
  );
}

