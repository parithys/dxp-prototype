import { useEffect, useState } from 'react';
import { Button, ICON_CARD, ICON_SPEED, ICON_TV, Icon, Pagination, TabStrip } from 'dxp-ui';
import { CreditCheckPanel } from '../domain/CreditCheckPanel';
import { CARD_IDLE, CARD_SELECTED, SelectedTick } from '../primitives/offerCardParts';
import { ConnectionTypeTag } from '../primitives/ConnectionTypeTag';
import { formatQarAny, formatAmount } from '../../lib/format';
import { listEntities } from '../../services/entityOps';
import { useHomeCreditCheck } from './homeCreditCheck';
import { STANDARD_PLANS_PAGE_SIZE } from './planPaging';
import { HOME_PLAY_ROW, homePlanSourceOf, homePlayOf, planTypeOfHomeProduct } from './homePlanModel';
import { OFFERS_TAB_LIMIT, SPECIAL_DISCOUNT_RATE, SPECIAL_DISCOUNT_TYPE, SPECIAL_OFFERS_TAB_LABEL, specialOfferPlanName } from './postpaidPlanModel';

type Values = Record<string, unknown>;

interface FixedPlan {
  productId: string;
  name: string;
  type: string;
  mrcQAR: number;
  speedTierMbps?: number;
  fupGB?: number;
  iptvIncluded?: boolean;
  lockInMonths?: number;
  disconnectionFeeSchedule?: string;
  disconnectionFeeQAR?: number;
  /** An offer plan (the Offers tab); every other plan is a Standard Plan. */
  offer?: boolean;
}

const BUNDLE_TITLE = { double: 'Dual Play', triple: 'Triple Play' } as const;

type PlanTab = 'offers' | 'standard' | 'special';
const PLAN_TABS: { key: PlanTab; label: string }[] = [
  { key: 'offers', label: 'Offers' },
  { key: 'standard', label: 'Standard Plans' },
];

interface SpecialDiscountRow {
  addonDiscountId: string;
  addonType: string;
  category: string;
  planId?: string;
}

// Plan & Add-ons: the same card as the Postpaid plan selection (name, price per month, feature rows, Select plan),
// over the fixed-line plans, with the fibre credit check once a plan is chosen.
/**
 * The plan step of the fixed-line / fibre / FWA journeys: the same card as a postpaid plan (type tag, name, price, allowance rows, Select
 * plan), with the fibre allowances (speed, FUP, IPTV, lock-in, early-disconnection fee) as its rows, and the outstanding-balance credit
 * check once a plan is chosen. Mounted through PlanSelection kind 'fixed'.
 */

// Plan & Add-ons: the same card as the Postpaid plan selection (name, price per month, feature rows, Select plan),
// over the fixed-line plans, with the fibre credit check once a plan is chosen.
/**
 * The plan step of the fixed-line / fibre / FWA journeys: the same card as a postpaid plan (type tag, name, price, allowance rows, Select
 * plan), with the fibre allowances (speed, FUP, IPTV, lock-in, early-disconnection fee) as its rows, and the outstanding-balance credit
 * check once a plan is chosen. Mounted through PlanSelection kind 'fixed'.
 */
export function FixedPlanStep({ values, setValue, specialDiscountType }: { values: Values; setValue: (f: string, v: unknown) => void; specialDiscountType?: 'mada' | 'b2b2c' | 'retired' | 'none' }) {
  const [plans, setPlans] = useState<FixedPlan[]>([]);
  const selectedId = values.productId as string | undefined;
  const planType = planTypeOfHomeProduct(values.homeProduct);
  const outstandingQar = useHomeCreditCheck(values, setValue);
  useEffect(() => {
    void listEntities<FixedPlan>('products').then((all) => setPlans(all.filter((p) => p.type === planType).sort((a, b) => a.mrcQAR - b.mrcQAR)));
  }, [planType]);
  // The two groups, as on the postpaid plan page: the Offers tab (at most six) and the Standard Plans tab (a page of twelve at a time).
  const offers = plans.filter((p) => p.offer).slice(0, OFFERS_TAB_LIMIT);
  // Standard Plans are the two fibre bundles only - Dual Play and Triple Play; a 5G Home plan is neither and stays listed.
  const standard = plans.filter((p) => !p.offer && (p.type !== 'Fixed Line Plan' || homePlayOf(p) !== undefined));
  // The Special Offers tab, only for a validated Special Discount (Consumer B2B2C, Retiree or MADA): the Standard Plans that discount is on. An Offers-tab plan is pre-bundled and takes none.
  const special = specialDiscountType && specialDiscountType !== 'none' ? SPECIAL_DISCOUNT_TYPE[specialDiscountType] : undefined;
  const [discountRows, setDiscountRows] = useState<SpecialDiscountRow[]>([]);
  useEffect(() => {
    if (!special) {
      setDiscountRows([]);
      return;
    }
    let cancelled = false;
    void listEntities<SpecialDiscountRow>('addons-discounts').then((all) => {
      if (!cancelled) setDiscountRows(all.filter((d) => d.category === 'Discount' && d.addonType === special.addonType));
    });
    return () => {
      cancelled = true;
    };
  }, [special]);
  const discountOf = (planId: string) => discountRows.find((d) => d.planId === planId)?.addonDiscountId;
  const specialPlans = special ? standard.filter((p) => discountOf(p.productId)) : [];
  const hasSpecialTab = specialPlans.length > 0;
  const tabs = hasSpecialTab ? [...PLAN_TABS, { key: 'special' as PlanTab, label: SPECIAL_OFFERS_TAB_LABEL }] : PLAN_TABS;
  const selectedPlan = plans.find((p) => p.productId === selectedId);
  const [tab, setTab] = useState<PlanTab | undefined>();
  // The opening tab: Special Offers for a validated Special Discount, otherwise Offers - or, with a plan already chosen, the tab it belongs to.
  const preferred: PlanTab = selectedPlan?.offer ? 'offers' : hasSpecialTab ? 'special' : selectedPlan ? 'standard' : 'offers';
  const activeTab: PlanTab = tab === 'special' && !hasSpecialTab ? preferred : (tab ?? preferred);
  const [paging, setPaging] = useState({ tab: activeTab, page: 1 });
  const page = paging.tab === activeTab ? paging.page : 1;
  const setPage = (n: number) => setPaging({ tab: activeTab, page: n });
  // The Standard Plans tab of a fibre home connection is two cards - Dual Play and Triple Play - each standing for its bundle's lowest-priced plan; a 5G Home list is shown as it is.
  const bundleCards = (['double', 'triple'] as const).flatMap((b) => standard.filter((p) => homePlayOf(p) === b).slice(0, 1));
  const standardTab = planType === 'Fixed Line Plan' ? bundleCards : standard;
  const paged = activeTab === 'standard' ? standardTab : activeTab === 'special' ? specialPlans : [];
  const shown = activeTab === 'offers' ? offers : paged.slice((page - 1) * STANDARD_PLANS_PAGE_SIZE, page * STANDARD_PLANS_PAGE_SIZE);
  // The plan's source rides with the choice (an Offers-tab plan is pre-bundled), also for a plan an accepted offer already chose.
  const source = homePlanSourceOf(selectedPlan);
  useEffect(() => {
    if (source !== (values.selectionSource as string | undefined)) setValue('selectionSource', source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // Which tab the plan was chosen from rides with it: Edit Discount offers the plan's ordinary discounts from Standard Plans and the Special Discount from Special Offers, none for an Offers plan.
  useEffect(() => {
    if (selectedId && activeTab !== (values.planTab as string | undefined)) setValue('planTab', activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeTab]);

  // A plan chosen on Special Offers carries that discount; one chosen anywhere else carries none.
  const choose = (planId: string | undefined) => {
    if (planId !== selectedId) setValue('productId', planId);
    setValue('discountId', planId && activeTab === 'special' ? discountOf(planId) : undefined);
  };

  return (
    <div className="space-y-4">
      <TabStrip items={tabs} active={activeTab} onChange={(k) => setTab(k as PlanTab)} label="Plan Groups" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(max(15rem,calc((100%-2rem)/3)),1fr))] gap-4">
        {shown.map((p) => {
          const selected = selectedId === p.productId;
          const toggle = () => choose(selected ? undefined : p.productId);
          const bundle = homePlayOf(p);
          const rows = [
            ...(bundle && !p.offer ? [{ icon: ICON_TV, text: HOME_PLAY_ROW[bundle].replace(/^[^:]+: /, '') }] : []),
            ...(p.speedTierMbps ? [{ icon: ICON_SPEED, text: `${p.speedTierMbps} Mbps ${p.type === 'FWA 5G Home Plan' ? '5G' : 'fibre'}` }] : []),
            ...(p.fupGB ? [{ icon: ICON_SPEED, text: `${p.fupGB} GB FUP` }] : []),
            ...(p.iptvIncluded && !(bundle && !p.offer) ? [{ icon: ICON_TV, text: 'IPTV included' }] : []),
            ...(p.lockInMonths ? [{ icon: ICON_CARD, text: `${p.lockInMonths}-month lock-in` }] : []),
            ...(p.disconnectionFeeSchedule || p.disconnectionFeeQAR
              ? [{ icon: ICON_CARD, text: `Early disconnection fee: ${p.disconnectionFeeSchedule ?? `${formatQarAny(p.disconnectionFeeQAR)}`}` }]
              : []),
          ];
          return (
            <div
              key={p.productId}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              onClick={toggle}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  toggle();
                }
              }}
              className={`option-card gap-3 p-5 ${selected ? CARD_SELECTED : CARD_IDLE}`}
            >
              {selected && <SelectedTick />}
              <div className="row justify-end">
                <ConnectionTypeTag category="GigaHome Fibre" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="title title-lg leading-snug">{activeTab === 'special' ? specialOfferPlanName(p.name, specialDiscountType) : activeTab === 'standard' && bundle ? BUNDLE_TITLE[bundle] : p.name}</p>
                {activeTab === 'special' && <p className="caption-secondary line-through">QAR {formatAmount(p.mrcQAR)}</p>}
                <p className="text-accent pt-1">
                  <span className="text-[length:var(--fs-body)] font-semibold">QAR </span>
                  <span className="text-[length:var(--fs-h3)] font-bold">{formatAmount(activeTab === 'special' ? p.mrcQAR * (1 - SPECIAL_DISCOUNT_RATE) : p.mrcQAR)}</span>
                  <span className="caption-secondary"> /month</span>
                </p>
                <ul className="space-y-1.5">
                  {rows.map((f) => (
                    <li key={f.text} className="row gap-2 caption-secondary">
                      <Icon path={f.icon} className="icon-sm text-accent" />
                      {f.text}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="row justify-end pt-1">
                <Button variant={selected ? 'default' : 'secondary'} tabIndex={-1} aria-hidden className="pointer-events-none">
                  {selected ? 'Selected' : 'Select plan'}
                </Button>
              </div>
            </div>
          );
        })}
        {plans.length === 0 && <p className="text-muted">No {planType} products are available right now.</p>}
      </div>
      {activeTab !== 'offers' && <Pagination page={page} total={paged.length} pageSize={STANDARD_PLANS_PAGE_SIZE} onPage={setPage} />}
      {/* Only a balance owed needs the agent's attention; a clean account passes the check without a notice. */}
      {selectedId && outstandingQar !== undefined && outstandingQar > 0 && (
        <CreditCheckPanel
          outstandingQar={outstandingQar}
          acknowledged={values.creditCheckAcknowledged === true}
          onAcknowledge={(v) => setValue('creditCheckAcknowledged', v)}
        />
      )}
    </div>
  );
}
