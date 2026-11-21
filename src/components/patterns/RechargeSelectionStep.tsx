import { useEffect, useMemo, useState } from 'react';
import { simCardCharge } from '../../data/prepaidSimCharge';
import { formatQar } from '../../lib/format';
import { CARD_IDLE, CARD_SELECTED, SelectedTick } from '../primitives/offerCardParts';
import { EmptyState, Button, TabStrip, Icon, INFO } from 'dxp-ui';
import type { PricingRecharge, RechargeBenefit } from './prepaidCartModel';
import { RechargeCountryDrawer } from './RechargeCountryDrawer';
import { groupRecharges, RECHARGE_BENEFIT_ICON, RECHARGE_VALIDITY_ICON } from './rechargeSelectionModel';
import { listEntities } from '../../services/entityOps';
import { ADDON_FOCUS_EVENT, addonCardId } from '../../lib/addonFocus';

function BenefitRow({ benefit, icon }: { benefit: RechargeBenefit; icon?: string }) {
  const path = icon ?? RECHARGE_BENEFIT_ICON[benefit.kind];
  return (
    <li className="row gap-2 caption-secondary">
      {path && <Icon path={path} className="icon-sm text-accent" />}
      {benefit.text}
    </li>
  );
}

/**
 * Choose the recharge for a prepaid subscription: the products by category, one selectable card each. Choosing the selected card again
 * clears it when `required` is false. Beside the cards it says what the choice does to the SIM card charge, which is judged on the recharge.
 */

/**
 * Choose the recharge for a prepaid subscription: the products by category, one selectable card each. Choosing the selected card again
 * clears it when `required` is false. Beside the cards it says what the choice does to the SIM card charge, which is judged on the recharge.
 */
export function RechargeSelectionStep({
  value,
  onChange,
  idType,
  required = false,
}: {
  value: string | undefined;
  onChange: (rechargeId: string | undefined) => void;
  /** The customer's ID type, for the SIM card charge note. */
  /** The customer's ID type, for the SIM card charge note. */
  idType?: string;
  /** A recharge must be chosen (a journey / persona rule); when false the agent may go on without one. */
  /** A recharge must be chosen (a journey / persona rule); when false the agent may go on without one. */
  required?: boolean;
}) {
  const [recharges, setRecharges] = useState<PricingRecharge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [countriesFor, setCountriesFor] = useState<PricingRecharge | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listEntities<PricingRecharge>('recharge-products').then((rows) => {
      if (cancelled) return;
      setRecharges(rows);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The Selected Add-Ons tray asks to show a recharge: go to its category tab, then scroll to its card and highlight it.
  useEffect(() => {
    const onFocus = (event: Event) => {
      const id = (event as CustomEvent<{ productId: string }>).detail?.productId;
      const target = recharges.find((r) => r.rechargeId === id);
      if (!target) return;
      setCategory(target.category);
      window.setTimeout(() => {
        const el = document.getElementById(addonCardId(target.rechargeId));
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.classList.add('ring-4', 'ring-accent-border');
        window.setTimeout(() => el?.classList.remove('ring-4', 'ring-accent-border'), 1800);
      }, 120);
    };
    window.addEventListener(ADDON_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(ADDON_FOCUS_EVENT, onFocus);
  }, [recharges]);

  const groups = useMemo(() => groupRecharges(recharges), [recharges]);
  const selected = recharges.find((r) => r.rechargeId === value);
  // The tab shown follows the chosen product when there is one, otherwise the first category.
  const shown = groups.find((g) => g.category === (category ?? selected?.category)) ?? groups[0];

  if (!loaded) return <p className="muted-body">Loading the recharge options…</p>;
  if (groups.length === 0) return <EmptyState compact message="No recharge options are available." />;

  const note = selected ? simCardCharge(idType, selected.amountQar) : undefined;
  // One information message above the tabs: the SIM card charge outcome of the chosen recharge (nothing is said while none is chosen).
  const infoMessage = value ? note?.message : undefined;

  return (
    <div className="space-y-4">
      {infoMessage && (
        <div className="notice-info row-start gap-3 p-4" role="status">
          <Icon path={INFO} className="size-6 shrink-0 text-[var(--tint-blue-fg)]" />
          <p className="text-secondary">{infoMessage}</p>
        </div>
      )}
      <TabStrip variant="filter" className="tab-strip-tinted"
        label="Recharge Category"
        items={groups.map((g) => ({ key: g.category, label: g.category, count: g.items.length }))}
        active={shown?.category}
        onChange={setCategory}
      />
      <div className="grid-2-up-sm lg:grid-cols-3 pt-3" role="group" aria-label={`${shown?.category ?? ''} recharges`}>
        {shown?.items.map((r) => {
          const chosen = r.rechargeId === value;
          const pick = () => onChange(chosen && !required ? undefined : r.rechargeId);
          return (
            <div
              key={r.rechargeId}
              id={addonCardId(r.rechargeId)}
              role="button"
              tabIndex={0}
              aria-pressed={chosen}
              onClick={pick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  pick();
                }
              }}
              className={`relative cursor-pointer card-option p-4 ${chosen ? CARD_SELECTED : CARD_IDLE}`}
            >
              {chosen && <SelectedTick />}
              {r.badge && <span className="badge badge-tag-amber mb-2">{r.badge}</span>}
              <p className="title title-md font-semibold">{r.name}</p>
              {r.description && <p className="mt-1 caption-muted">{r.description}</p>}
              <p className="mt-3 title title-xl leading-none">{formatQar(r.amountQar)}</p>
              {/* The allowances as icon rows - the prepaid pack card's layout: an accent icon, the line, validity last. */}
              {(Boolean(r.benefits?.length) || Boolean(r.validity)) && (
                <ul className="mt-3 space-y-1.5" aria-label="Benefits">
                  {r.benefits?.map((b) => (
                    <BenefitRow key={b.text} benefit={b} />
                  ))}
                  {r.validity && <BenefitRow benefit={{ text: `Valid for ${r.validity}`, kind: 'other' }} icon={RECHARGE_VALIDITY_ICON} />}
                </ul>
              )}
              {r.passes && (
                <div className="mt-3">
                  <p className="caption-heading">{r.passes.title}</p>
                  <ul className="mt-1 space-y-1.5">
                    {r.passes.items.map((p) => (
                      <BenefitRow key={p.text} benefit={p} />
                    ))}
                  </ul>
                </div>
              )}
              {r.note && <p className="mt-3 caption-muted">Note: {r.note}</p>}
              {r.countryInfo && (
                // A control inside the selectable card: it opens the drawer and must not also choose (or clear) the recharge.
                <div className="mt-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <Button variant="secondary" size="sm" onClick={() => setCountriesFor(r)}>
                    {r.countryInfo.button}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <RechargeCountryDrawer recharge={countriesFor} onClose={() => setCountriesFor(null)} />
    </div>
  );
}
