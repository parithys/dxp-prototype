import { Badge, Button, EmptyState, Icon, TabStrip, SearchField, OptionToggle, Select, CHEVRON_RIGHT, DATA_ICON, LAYERS_ICON } from 'dxp-ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { IptvStbTerms } from '../../engines/homeIptv';
import { CARD_IDLE, CARD_SELECTED, SelectedTick, SelectedCardTexture } from '../../components/primitives/offerCardParts';
import { ADDON_FOCUS_EVENT, addonCardId } from '../../lib/addonFocus';
import { MULTI_SIM_MAX, multiSimCountOf, multiSimsRequested } from '../../engines/multiSim';
import { isAddonEligible, type AddonEligibilityContext, type AddonEligibilityRule } from '../../engines/addonEligibility';
import { ADDON_CATEGORIES, FREQUENTLY_USED_TAB, isFrequentlyUsed, type FrequentlyUsedRule, isFreeAddon, addonCategoryOf, selectedPerCategory, type AddonPricingModel, type AddonBillingFrequency, type AddonBillingOption, type AddonTermOption, addonPriceDisplay, addonChargeType, addonWithBillingChoice, isAddonAvailable, defaultedFree, freePeriodLabel, type FreePeriod } from '../../engines/addonCategories';
import { appliedDiscountFor, discountedAddon, type AddonDiscount, type AppliedAddonDiscounts } from '../../engines/addonDiscounts';
import { formatAmount } from '../../lib/format';
import { listEntities } from '../../services/entityOps';

export interface AddonProduct {
  productId: string;
  name: string;
  type: string;
  mrcQAR: number;
  description?: string;
  /** Optional conditions for being offered this add-on - see addonEligibility.ts. */
  /** Optional conditions for being offered this add-on - see addonEligibility.ts. */
  eligibility?: AddonEligibilityRule;
  /** The add-on's category on the Add-ons page (see addonCategories.ts). */
  /** The add-on's category on the Add-ons page (see addonCategories.ts). */
  addonCategory?: string;
  /** Of several free alternatives in an exclusive group, the one that is on the order by default. */
  defaultSelected?: boolean;
  /** How long a free add-on is free for: the lifetime of the service, or a limited period. */
  freeFor?: FreePeriod;
  /** The Multi-SIMs this add-on provides, as stated on its record (see engines/multiSim.ts). */
  /** The Multi-SIMs this add-on provides, as stated on its record (see engines/multiSim.ts). */
  multiSimCount?: number;
  /** Add-ons sharing a group are alternatives: choosing one drops the others of the group (the free Multi SIM add-ons: one SIM or two, never both). */
  exclusiveGroup?: string;
  /** The customers it is frequently taken by (see FREQUENTLY_USED_TAB in addonCategories.ts). */
  /** The customers it is frequently taken by (see FREQUENTLY_USED_TAB in addonCategories.ts). */
  frequentlyUsedFor?: FrequentlyUsedRule;
  pricing?: 'free' | 'paid';
  /** How it is charged (see addonCategories.ts); decides Free / Paid and the price wording. */
  /** How it is charged (see addonCategories.ts); decides Free / Paid and the price wording. */
  pricingModel?: AddonPricingModel;
  /** Stated on the record when the add-on is not monthly (weekly or one-time). */
  /** Stated on the record when the add-on is not monthly (weekly or one-time). */
  billingFrequency?: 'monthly' | 'weekly' | 'one-time';
  billingOptions?: AddonBillingOption[];
  introPriceQAR?: number;
  /** The catalogue's own wording for a price that is not a plain QAR amount (TBC, Plan-based, QR 10 after promotional period ...). */
  /** The catalogue's own wording for a price that is not a plain QAR amount (TBC, Plan-based, QR 10 after promotional period ...). */
  priceLabel?: string;
  /** The catalogue's status (Confirmed, Demo Only / TBC ...). Kept with the data; not displayed. */
  /** The catalogue's status (Confirmed, Demo Only / TBC ...). Kept with the data; not displayed. */
  addonStatus?: string;
  /** A mandatory product (prepaid, `isMandatory` on its record): always on the order, selected for the agent, who cannot remove it. */
  /** A mandatory product (prepaid, `isMandatory` on its record): always on the order, selected for the agent, who cannot remove it. */
  mandatory?: boolean;
  /** A home IPTV bundle's set-top box terms (see engines/homeIptv.ts). */
  stb?: IptvStbTerms;
  extraStbPriceQAR?: number;
  /** A home add-on's lock-in in months, as its record states it (0: none); undefined: not stated, so nothing is shown. */
  lockInMonths?: number;
  /** Fixed terms a home Speed Booster can be taken for instead of the lifetime charge. */
  termOptions?: AddonTermOption[];
  /** The home plan's Wi-Fi Extender add-on: not listed as a card; the Mesh tab's Extenders card sets its quantity (see engines/homeExtenders.ts). */
  extender?: boolean;
}

/** Each home add-on category's own tag colour on Frequently Used, so a product is told apart by its category at a glance. A category with no entry keeps the neutral tag. */
const CATEGORY_TAG: Record<string, string> = {
  IPTV: 'badge-tag-violet',
  Mesh: 'badge-tag-blue',
  'Speed Booster': 'badge-tag-amber',
  Voice: 'badge-tag-green',
};

/** What a page puts around one tab's add-on lists: before them, after them, or in place of them (the home IPTV tab: its enable switch, its set-top box questions). */
export interface AddonTabSlot {
  before?: ReactNode;
  after?: ReactNode;
  hideList?: boolean;
  /** Content shown inside a selected add-on's own card, under its row (the home IPTV bundle's set-top box choices). */
  cardExtra?: (addon: AddonProduct) => ReactNode;
  /** The one-time charge (QAR) a selected add-on's own choices add - the set-top boxes of an IPTV bundle: shown on its card beside (or in place of "Free" for) its own price. */
  /** Content shown first in the Free column (the Mesh tab's Wi-Fi Extenders: free units included with the plan); counted in the column's number. */
  freeFirst?: ReactNode;
  cardCharge?: (addon: AddonProduct) => number | undefined;
  /** Add-ons the page shows its own way, left out of the list. */
  hide?: (addon: AddonProduct) => boolean;
}

interface AddonsPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  selectedBilling?: Record<string, AddonBillingFrequency>;
  /** Home Speed Booster: the fixed term (months) chosen instead of the lifetime charge, by add-on id. */
  selectedTerms?: Record<string, number>;
  onTermChange?: (next: Record<string, number>) => void;
  onBillingChange?: (billing: Record<string, AddonBillingFrequency>) => void;
  /**
   * Set by the Addons page (PostpaidAddonsStep, and so Add Add-On too): the page and its tab bar already name and count this section, so repeating "Add-ons
   * (optional)" as a second, collapsible heading under it would be a redundant control doing the same job. Omitted, the picker keeps its own collapsible heading.
   */
  /**
   * Set by the Addons page (PostpaidAddonsStep, and so Add Add-On too): the page and its tab bar already name and count this section, so repeating "Add-ons
   * (optional)" as a second, collapsible heading under it would be a redundant control doing the same job. Omitted, the picker keeps its own collapsible heading.
   */
  hideHeader?: boolean;
  /** Who the add-ons are for. Only add-ons this customer is eligible for are shown. */
  /** Who the add-ons are for. Only add-ons this customer is eligible for are shown. */
  eligibilityContext?: AddonEligibilityContext;
  /** The selected plan, for the Multi-SIM maximum: an add-on that would take the plan's and the selected add-ons' Multi-SIMs above 4 cannot be selected. */
  /** The selected plan, for the Multi-SIM maximum: an add-on that would take the plan's and the selected add-ons' Multi-SIMs above 4 cannot be selected. */
  multiSimPlan?: { multiSimCount?: number };
  /** Shown when no add-on is available. Omitted: nothing is rendered in that case. */
  /** Shown when no add-on is available. Omitted: nothing is rendered in that case. */
  emptyMessage?: string;
  /** Prepaid only: the pack's mandatory products (`isMandatory`) are selected for the agent and cannot be deselected. Off, every add-on is optional (other journeys). */
  /** Prepaid only: the pack's mandatory products (`isMandatory`) are selected for the agent and cannot be deselected. Off, every add-on is optional (other journeys). */
  mandatoryProducts?: boolean;
  /** 'rows': one full-width row per add-on (icon, name and description, Optional/Added tag, price). Default: a grid of cards. */
  /** 'rows': one full-width row per add-on (icon, name and description, Optional/Added tag, price). Default: a grid of cards. */
  layout?: 'cards' | 'rows';
  /**
   * Where the add-ons come from: 'catalogue' (default) the postpaid add-on products, offered by plan eligibility; 'prepaid' the add-ons
   * the prepaid pack carries (addons-discounts for `eligibilityContext.planId`), priced as a one-off charge.
   */
  /**
   * Where the add-ons come from: 'catalogue' (default) the postpaid add-on products, offered by plan eligibility; 'prepaid' the add-ons
   * the prepaid pack carries (addons-discounts for `eligibilityContext.planId`), priced as a one-off charge; 'plan' the same plan-bound records for a home plan, charged monthly.
   */
  source?: 'catalogue' | 'prepaid' | 'plan';
  /**
   * The dedicated Add-ons page: the category tabs (Local Data, Local Minutes, International, Roaming, Combo, Others) and, under them, the selected
   * category's add-ons in two columns - Paid Addons and Free Addons - each listed top to bottom. Rows layout; postpaid and prepaid add-ons alike (a prepaid
   * add-on's category is the one its record states, else Others).
   */
  /**
   * The dedicated Add-ons page: the category tabs (Local Data, Local Minutes, International, Roaming, Combo, Others) and, under them, the selected
   * category's add-ons in two columns - Paid Addons and Free Addons - each listed top to bottom. Rows layout; postpaid and prepaid add-ons alike (a prepaid
   * add-on's category is the one its record states, else Others).
   */
  categorized?: boolean;
  /** Opt-in own category tabs (the home Add-ons page: IPTV, Mesh, Speed Booster, Voice) in place of the postpaid ones; an add-on sits under the tab its record's `addonCategory` names, and Paid / Free read plainly. Frequently Used is always last. */
  homeTabs?: readonly string[];
  /** With homeTabs: categories that do not apply to this plan - their add-ons are not listed anywhere (not under their tab, not under Frequently Used) and the tab is left out of homeTabs by the caller. */
  hiddenCategories?: readonly string[];
  /** With homeTabs: what the page adds around a tab's lists. */
  tabSlot?: (tab: string, addons: AddonProduct[]) => AddonTabSlot | undefined;
  /** The add-on discounts the agent has applied (add-on product id -> discount id): an add-on shows its discounted charge and the discount. Omitted: no add-on discounts on this page. */
  /** The add-on discounts the agent has applied (add-on product id -> discount id): an add-on shows its discounted charge and the discount. Omitted: no add-on discounts on this page. */
  appliedDiscounts?: AppliedAddonDiscounts;
  /** A status line on a selected add-on's card, by add-on id (the Multi SIM add-ons: whether the SIM they need is selected or generated). */
  addonStatus?: Record<string, AddonStatus>;
  /** Clicking a SELECTED add-on that provides Multi-SIMs opens its SIM Selection (the host's drawer) instead of deselecting it; the SIMs are removed there. */
  onOpenMultiSim?: (addonId: string) => void;
  /** How many SIMs the agent asked for from each Multi SIM add-on (see engines/multiSim.ts): the maximum of 4 is judged on these. */
  multiSimWanted?: Record<string, number>;
  /** With homeTabs: items a tab holds that are not cards in it (the Wi-Fi Extenders' units on Mesh, set by quantity), added to that tab's count. */
  tabExtraCounts?: Record<string, number>;
  /** With homeTabs: the plan's free add-ons are selected for the agent once per plan (`doneFor` is the plan already done; `onDone` records it), and stay the agent's to deselect. */
  freeByDefault?: { doneFor: string | undefined; onDone: (planId: string) => void; /** The plan includes IPTV (Triple Play): its free IPTV add-ons are defaulted too. Otherwise IPTV is switched on first, so none is. */ iptvIncluded?: boolean };
}

// "Plan & Add-ons" (reference flow step 5) - optional, non-gating multi-select
// of catalogue products where type === 'Add-on', alongside the mandatory
// single-select Plan above it in ProductPlanStep.

/** What a selected add-on's card says about its follow-up, and whether that is complete (green) or still needed (amber). */
export interface AddonStatus {
  label: string;
  complete: boolean;
  /** One line per SIM already selected or generated ("SIM 1 - eSIM - 8974412009900140101"), shown on the card in place of the label once complete. */
  lines?: string[];
}

export function AddonsPicker({ selectedIds, onChange, selectedBilling = {}, selectedTerms = {}, onTermChange, onBillingChange, hideHeader, eligibilityContext, emptyMessage, layout = 'cards', mandatoryProducts = false, source = 'catalogue', categorized = false, homeTabs, hiddenCategories, tabSlot, appliedDiscounts, addonStatus, onOpenMultiSim, multiSimWanted, tabExtraCounts, freeByDefault }: AddonsPickerProps) {
  const [discountRecords, setDiscountRecords] = useState<AddonDiscount[]>([]);
  const wantsDiscounts = appliedDiscounts !== undefined;
  useEffect(() => {
    if (wantsDiscounts) void listEntities<AddonDiscount>('addon-discounts').then(setDiscountRecords);
  }, [wantsDiscounts]);
  const [category, setCategory] = useState<string>(homeTabs?.[0] ?? ADDON_CATEGORIES[0]);
  const categoryOf = (a: AddonProduct): string => (homeTabs ? a.addonCategory ?? '' : addonCategoryOf(a));
  // Until the agent picks a tab themself, the page opens on the first category that has an add-on (a home plan's add-ons sit under Others, not Local Data).
  const categoryPicked = useRef(false);
  // Search by add-on name, description or price, scoped to the category on show (like the plan search under the plan tabs).
  const [search, setSearch] = useState('');
  const [allAddons, setAllAddons] = useState<AddonProduct[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [attempt, setAttempt] = useState(0);
  // Eligibility is evaluated BEFORE anything renders: an add-on the customer is not
  // eligible for is not in the list at all, so it can be neither seen nor selected.
  const eligibleAddons = eligibilityContext ? allAddons.filter((a) => isAddonEligible(a, eligibilityContext)) : allAddons;
  const addons = eligibleAddons.filter(isAddonAvailable).filter((a) => !a.addonCategory || !hiddenCategories?.includes(a.addonCategory));
  const firstFilledCategory = (homeTabs ?? ADDON_CATEGORIES).find((c) => addons.some((a) => categoryOf(a) === c));
  useEffect(() => {
    if (!categorized || categoryPicked.current || !firstFilledCategory) return;
    if (!addons.some((a) => categoryOf(a) === category)) setCategory(firstFilledCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorized, firstFilledCategory, category]);
  // Collapsed by default (2026-09-27). Add-ons are optional and most orders
  // take none, so the list was occupying the step for a decision usually
  // answered "no" - but the count in the header means a collapsed section
  // still reports what is inside it, which is the part that makes collapsing
  // safe rather than hiding state. Moot when hideHeader is set: there is no
  // collapsible heading to default shut, so the list always renders open.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load: Promise<AddonProduct[]> =
      source === 'prepaid' || source === 'plan'
        ? listEntities<{ addonDiscountId: string; name: string; addonType: string; price: number; category: string; description?: string; planId?: string; isMandatory?: boolean; addonCategory?: string; frequentlyUsedFor?: FrequentlyUsedRule; exclusiveGroup?: string; defaultSelected?: boolean; freeFor?: FreePeriod; stb?: IptvStbTerms; extraStbPriceQAR?: number; lockInMonths?: number; billingOptions?: AddonBillingOption[]; termOptions?: AddonTermOption[]; extender?: boolean }>('addons-discounts')
            .then((all) =>
              all
                .filter((d) => d.category === 'Paid Add-on' && d.planId === eligibilityContext?.planId)
                .map((d) => ({ productId: d.addonDiscountId, name: d.name, type: d.addonType, mrcQAR: d.price, description: d.description, addonCategory: d.addonCategory, mandatory: mandatoryProducts && d.isMandatory === true, ...(homeTabs ? { frequentlyUsedFor: d.frequentlyUsedFor, exclusiveGroup: d.exclusiveGroup, defaultSelected: d.defaultSelected, freeFor: d.freeFor, stb: d.stb, extraStbPriceQAR: d.extraStbPriceQAR, lockInMonths: d.lockInMonths, billingOptions: d.billingOptions, termOptions: d.termOptions, extender: d.extender } : {}) }))
            )
        : listEntities<AddonProduct>('products').then((all) => all.filter((p) => p.type === 'Add-on'));
    load
      .then((list) => {
        if (cancelled) return;
        setAllAddons(list);
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, source, mandatoryProducts, eligibilityContext?.planId]);

  // The plan's free add-ons are on the order from the start (once per plan, so one the agent takes off stays off): all of them, but IPTV unless the plan includes it (otherwise it is switched on first),
  // and one only of an exclusive group's alternatives (the IPTV bundles).
  const planKey = eligibilityContext?.planId;
  useEffect(() => {
    if (!freeByDefault || !homeTabs || status !== 'ready' || !planKey || freeByDefault.doneFor === planKey) return;
    // One of an exclusive group's alternatives at most; and none when the agent already holds one of that group.
    const heldGroups = new Set(addons.filter((a) => a.exclusiveGroup && selectedIds.includes(a.productId)).map((a) => a.exclusiveGroup));
    const free = defaultedFree(addons.filter((a) => isFreeAddon(a) && !selectedIds.includes(a.productId) && !(a.exclusiveGroup && heldGroups.has(a.exclusiveGroup))), freeByDefault.iptvIncluded === true).map((a) => a.productId);
    if (free.length > 0) onChange([...selectedIds, ...free]);
    freeByDefault.onDone(planKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, planKey, freeByDefault?.doneFor, addons.length]);

  // A selection that stopped being eligible (the plan or customer type changed) is dropped.
  const eligibleIds = addons.map((a) => a.productId).join(',');
  // A mandatory product is always on the order: selected for the agent as soon as it is listed (and again if it was ever dropped).
  const missingMandatory = addons.filter((a) => a.mandatory && !selectedIds.includes(a.productId)).map((a) => a.productId);
  const missingMandatoryKey = missingMandatory.join(',');
  useEffect(() => {
    if (missingMandatory.length > 0) onChange([...selectedIds, ...missingMandatory]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingMandatoryKey]);
  const selectedKey = selectedIds.join(',');
  const billingKey = Object.keys(selectedBilling).sort().join(',');
  useEffect(() => {
    if (allAddons.length === 0) return;
    const kept = selectedIds.filter((id) => addons.some((a) => a.productId === id));
    if (kept.length !== selectedIds.length) onChange(kept);
    if (onBillingChange) {
      const keptBilling = Object.fromEntries(Object.entries(selectedBilling).filter(([id]) => kept.includes(id)));
      if (Object.keys(keptBilling).length !== Object.keys(selectedBilling).length) onBillingChange(keptBilling);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleIds, allAddons.length, selectedKey, billingKey]);

  // The Selected Add-Ons tray asks to show an add-on: go to its category tab, clear any search that hides it, then scroll to its card and highlight it.
  const addonsRef = useRef(addons);
  addonsRef.current = addons;
  useEffect(() => {
    if (!(categorized && layout === 'rows')) return;
    const onFocus = (event: Event) => {
      const productId = (event as CustomEvent<{ productId: string }>).detail?.productId;
      const target = addonsRef.current.find((x) => x.productId === productId);
      if (!target) return;
      setCategory(homeTabs ? target.addonCategory ?? category : addonCategoryOf(target));
      setSearch('');
      window.setTimeout(() => {
        const el = document.getElementById(addonCardId(target.productId));
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.classList.add('ring-4', 'ring-accent-border');
        window.setTimeout(() => el?.classList.remove('ring-4', 'ring-accent-border'), 1800);
      }, 120);
    };
    window.addEventListener(ADDON_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(ADDON_FOCUS_EVENT, onFocus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorized, layout]);

  if (status === 'loading' && emptyMessage) return <p className="caption-muted">Loading add-ons…</p>;
  if (status === 'error') {
    return (
      <div role="alert" className="notice-warning pad-row split">
        <p className="text-[var(--warn-text)] text-[length:var(--fs-body)]">Add-ons could not be loaded. You can continue without them.</p>
        <Button variant="tertiary" size="sm" onClick={() => { setStatus('loading'); setAttempt((n) => n + 1); }}>
          Retry
        </Button>
      </div>
    );
  }
  if (addons.length === 0) {
    return status === 'ready' && emptyMessage ? (
      <EmptyState compact message={emptyMessage} />
    ) : null;
  }

  // The add-ons on screen: all of them, or - on the Add-ons page - the selected category's, narrowed by Free / Paid.
  const useTabs = categorized && layout === 'rows';
  // The postpaid page names an add-on by what it gives (its description); a prepaid add-on's own name already says it, so the name leads and the description follows.
  const namedByContent = useTabs && source === 'catalogue';
  const q = search.trim().toLowerCase();
  const matchesSearch = (a: AddonProduct) =>
    !q || [a.name, a.description, addonPriceDisplay(a)?.primary, addonPriceDisplay(a)?.secondary, a.priceLabel, String(a.mrcQAR)].some((t) => t?.toLowerCase().includes(q));
  // Frequently Used: the add-ons whose record says they suit this customer's plan and nationality. The tab is always there; with no match it says so.
  // On the home page the tab holds paid add-ons only (a free one is the plan's own and is under its category); elsewhere it is as it was.
  const frequent = eligibilityContext ? addons.filter((a) => isFrequentlyUsed(a, eligibilityContext) && !(homeTabs && isFreeAddon(a))) : [];
  // The home page lists only the categories the plan has add-ons in (a Mesh tab for a plan with no Mesh add-on would be an empty promise); Frequently Used is always there.
  const tabs: string[] = [...(homeTabs ? homeTabs.filter((c) => addons.some((a) => categoryOf(a) === c)) : ADDON_CATEGORIES), FREQUENTLY_USED_TAB];
  const activeTab: string = category;
  const slot = homeTabs && tabSlot ? tabSlot(activeTab, addons) : undefined;
  const inTab = (pricing: 'free' | 'paid') =>
    activeTab === FREQUENTLY_USED_TAB
      ? frequent.filter((a) => isFreeAddon(a) === (pricing === 'free'))
      : addons.filter((a) => categoryOf(a) === activeTab && isFreeAddon(a) === (pricing === 'free'));
  // The Free column's own first item stays unless a search for something else hides it.
  const freeFirst = slot?.freeFirst && (!q || /extender|wi-?fi|mesh/.test(q)) ? slot.freeFirst : undefined;
  const shownHere = (a: AddonProduct) => !slot?.hide?.(a);
  const paid = useTabs ? inTab('paid').filter(matchesSearch).filter(shownHere) : [];
  // Frequently Used is an aggregated view of the paid add-ons that suit the plan: a free add-on is the plan's own (on the order from the start) and is found under its category.
  // Only the home Add-ons page (homeTabs) has this view: the postpaid and prepaid pages keep their Frequently Used tab as it was.
  const aggregated = Boolean(homeTabs) && activeTab === FREQUENTLY_USED_TAB;
  const free = useTabs && !aggregated ? inTab('free').filter(matchesSearch).filter(shownHere) : [];
  const shown = useTabs ? [...paid, ...free] : addons;
  const perCategory: Record<string, number> = homeTabs
    ? Object.fromEntries(homeTabs.map((c) => [c, addons.filter((a) => categoryOf(a) === c && selectedIds.includes(a.productId)).length + (tabExtraCounts?.[c] ?? 0)]))
    : selectedPerCategory(addons, selectedIds);
  // Multi-SIM maximum: an unselected add-on that provides Multi-SIMs is blocked once what is already asked for, plus the one it starts with, would exceed the limit.
  // The add-on's alternatives (its exclusive group) are not counted: choosing it replaces them.
  const multiSimBlocked = (a: AddonProduct) =>
    !selectedIds.includes(a.productId) &&
    multiSimCountOf(a) > 0 &&
    multiSimsRequested(addons.filter((x) => selectedIds.includes(x.productId) && !(a.exclusiveGroup && x.exclusiveGroup === a.exclusiveGroup)), multiSimWanted) + 1 > MULTI_SIM_MAX;
  const toggle = (id: string) => {
    const removing = selectedIds.includes(id);
    const candidate = addons.find((x) => x.productId === id);
    if (removing && candidate?.mandatory) return;
    if (!removing && candidate && multiSimBlocked(candidate)) return;
    // An add-on of an exclusive group replaces the group's other selected add-on instead of adding to it.
    const group = !removing ? candidate?.exclusiveGroup : undefined;
    const rivals = group ? addons.filter((x) => x.exclusiveGroup === group && x.productId !== id && selectedIds.includes(x.productId)).map((x) => x.productId) : [];
    onChange(removing ? selectedIds.filter((i) => i !== id) : [...selectedIds.filter((i) => !rivals.includes(i)), id]);
    if (removing && selectedBilling[id] && onBillingChange) {
      const { [id]: _removed, ...rest } = selectedBilling;
      onBillingChange(rest);
    }
  };

  // A selected Multi SIM add-on's card opens its SIM Selection; every other card toggles.
  const press = (a: AddonProduct) => (onOpenMultiSim && selectedIds.includes(a.productId) && multiSimCountOf(a) > 0 ? onOpenMultiSim(a.productId) : toggle(a.productId));
  const rowCard = (listed: AddonProduct) => {
    // A fixed term chosen on a Speed Booster prices the add-on at that term (charged once) and names the term.
    const termMonths = homeTabs && listed.termOptions ? selectedTerms[listed.productId] : undefined;
    const term = listed.termOptions?.find((t) => t.months === termMonths);
    const a: AddonProduct = term ? { ...listed, billingOptions: [...(listed.billingOptions ?? []).filter((o) => o.frequency !== 'one-time'), { frequency: 'one-time', priceQAR: term.priceQAR }] } : listed;
    const selected = selectedIds.includes(a.productId);
    // The selector only appears where the host journey records the choice (onBillingChange); elsewhere the catalogue default is what is priced.
    const options = onBillingChange ? (a.billingOptions ?? []) : [];
    const billing = selectedBilling[a.productId] ?? a.billingFrequency ?? options[0]?.frequency;
    const blocked = multiSimBlocked(a);
    // Content the page puts inside the selected card (a bundle's set-top box choices).
    const extra = selected ? slot?.cardExtra?.(a) : undefined;
    const oneTime = selected ? slot?.cardCharge?.(a) ?? 0 : 0;
    const ownControls = options.length > 1 || Boolean(extra);
    // The add-on as charged after its applied discount (the price, and the choice of billing frequency, are shown on it).
    const discount = appliedDiscountFor(discountRecords, appliedDiscounts, a);
    const priced = discountedAddon(a, discount);
    const chooseBilling = (frequency: AddonBillingFrequency) => {
      if (!selected && blocked) return;
      if (!selected) onChange([...selectedIds, a.productId]);
      onBillingChange?.({ ...selectedBilling, [a.productId]: frequency });
    };
    return (
              <div
                key={a.productId}
                id={addonCardId(a.productId)}
                role={ownControls ? undefined : 'button'}
                tabIndex={ownControls ? undefined : 0}
                aria-pressed={ownControls ? undefined : selected}
                aria-disabled={blocked || a.mandatory || undefined}
                onClick={ownControls ? undefined : () => press(a)}
                onKeyDown={(e) => {
                  if (!ownControls && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    press(a);
                  }
                }}
                className={`relative card-option ${blocked ? 'cursor-not-allowed opacity-60' : a.mandatory ? 'cursor-default' : ownControls && !extra ? '' : 'cursor-pointer'} ${
                  selected ? CARD_SELECTED : CARD_IDLE
                }`}
              >
                {selected && <SelectedTick />}
                {/* With its own controls inside (the IPTV bundle's set-top box choices) the card is not one button: its row is, so the choices are not nested in it. */}
                <div
                  className="row option-row"
                  {...(extra
                    ? {
                        role: 'button',
                        tabIndex: 0,
                        'aria-pressed': selected,
                        onClick: () => press(a),
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            press(a);
                          }
                        },
                      }
                    : {})}
                >
                <span className={`option-glyph option-glyph-lg ${selected ? 'glyph-chosen' : ''}`}>
                  <Icon path={DATA_ICON} className="size-5 " />
                </span>
                <div className="min-w-0 flex-1">
                  {/* Frequently Used gathers add-ons of every category: each says which one it is in, so similar products are not mistaken for each other. */}
                  {aggregated && a.addonCategory && <span className={`badge ${CATEGORY_TAG[a.addonCategory] ?? 'badge-filled-neutral'} mb-1`}>{a.addonCategory}</span>}
                  {/* The Add-ons page names an add-on by what it gives ("2.5 GB full-speed data"); elsewhere the name leads and the description follows. */}
                  <p className="title title-md font-semibold leading-snug">{namedByContent ? a.description ?? a.name : a.name}</p>
                  {!namedByContent && a.description && <p className="caption-secondary">{a.description}</p>}
                  {!(homeTabs && isFreeAddon(a)) && addonChargeType(a, source === 'prepaid' ? 'prepaid' : 'catalogue', billing) && <p className="mt-1 caption-muted">{addonChargeType(a, source === 'prepaid' ? 'prepaid' : 'catalogue', billing)}</p>}
                  {/* A free add-on says how long it is free for: its lifetime, or a limited period. */}
                  {homeTabs && isFreeAddon(a) && freePeriodLabel(a.freeFor) && <p className="mt-1 caption-muted">{freePeriodLabel(a.freeFor)}</p>}
                  {homeTabs && !isFreeAddon(a) && a.addonCategory !== 'Voice' && a.lockInMonths !== undefined && addonWithBillingChoice(a, billing).billingFrequency !== 'one-time' && <p className="caption-muted">{a.lockInMonths > 0 ? `${a.lockInMonths}-month lock-in` : 'No lock-in'}</p>}
                  {selected && addonStatus?.[a.productId] && (
                    <div className="mt-2 stack gap-1 items-start">
                      {/* Complete: just each SIM's line. Not yet: what is still needed, then the SIMs already in. */}
                      {!addonStatus[a.productId].complete && <Badge variant="warning">{addonStatus[a.productId].label}</Badge>}
                      {(addonStatus[a.productId].lines ?? []).map((line) => (
                        <Badge key={line} variant="success">{line}</Badge>
                      ))}
                      {addonStatus[a.productId].complete && !addonStatus[a.productId].lines?.length && <Badge variant="success">{addonStatus[a.productId].label}</Badge>}
                    </div>
                  )}
                  {a.mandatory && <p className="mt-1 caption-note">Mandatory: included with this pack and cannot be removed.</p>}
                  {blocked && <p role="status" className="mt-1 caption-note">Not available: with the plan and the add-ons already selected it would exceed the maximum of {MULTI_SIM_MAX} Multi-SIMs.</p>}
                </div>
                <div className="aside-value">
                  {addonPriceDisplay(priced, billing) ? (
                    <>
                      <p className="title title-xl leading-none whitespace-nowrap">{addonPriceDisplay(priced, billing)!.primary}</p>
                      {addonPriceDisplay(priced, billing)!.secondary && <p className="mt-2 caption-note">{addonPriceDisplay(priced, billing)!.secondary}</p>}
                      {oneTime > 0 && <p className="mt-2 caption-note">+ QAR {formatAmount(oneTime)} one-time</p>}
                      {discount && <p className="mt-2 caption-note text-[var(--success)]">{discount.name}: {discount.percent}% off</p>}
                    </>
                  ) : a.pricing === 'free' || (!a.pricing && a.mrcQAR === 0) ? (
                    // Free by itself; once its set-top box choice carries a charge, that is what is payable.
                    oneTime > 0 ? (
                      <>
                        <p className="title title-xl leading-none whitespace-nowrap">QAR {formatAmount(oneTime)}</p>
                        <p className="mt-2 caption-note">one-time</p>
                      </>
                    ) : (
                      <p className="title title-xl">Free</p>
                    )
                  ) : a.priceLabel && /QR\s*\d/.test(a.priceLabel) ? (
                    // Only wording that states a QAR amount ("QR 50 per additional SIM") is shown; open prices (TBC, Plan-based, Plan-dependent) are not displayed.
                    <p className="title title-sm max-w-48">{a.priceLabel}</p>
                  ) : a.priceLabel ? null : (
                    <p className="text-fg">
                      <span className="text-[length:var(--fs-caption)]">QAR </span>
                      <span className="text-[length:var(--fs-h4)] font-bold">{formatAmount(homeTabs ? addonWithBillingChoice(priced, billing).mrcQAR : a.mrcQAR)}</span>
                      <span className="caption-secondary">{source === 'prepaid' || (homeTabs && addonWithBillingChoice(priced, billing).billingFrequency === 'one-time') ? (homeTabs ? ' one-time' : ' one-off') : ' /mo'}</span>
                    </p>
                  )}
                </div>
                </div>
                {options.length > 1 && homeTabs && listed.termOptions && (
                  // Home Speed Booster: Lifetime (the ongoing monthly charge), or a fixed term chosen from the list (charged once).
                  <div className="divider-top option-row-aside row gap-3">
                    <OptionToggle
                      label={`Billing for ${a.name}`}
                      items={[{ key: 'monthly', label: `Lifetime · QAR ${formatAmount(options.find((o) => o.frequency === 'monthly')?.priceQAR ?? a.mrcQAR)}` }]}
                      active={billing === 'monthly' ? 'monthly' : undefined}
                      onChange={() => {
                        const { [a.productId]: _dropped, ...rest } = selectedTerms;
                        onTermChange?.(rest);
                        chooseBilling('monthly');
                      }}
                    />
                    {/* The Select has no watermark of its own (LIBRARY_GAPS.md): the label shows inside the field, dull, until a term is chosen. */}
                    <div className="relative">
                      <Select
                        aria-label={`Fixed term for ${a.name}`}
                        options={listed.termOptions.map((t) => ({ value: String(t.months), label: `${t.months} ${t.months === 1 ? 'Month' : 'Months'}` }))}
                        value={term ? String(term.months) : ''}
                        onChange={(e) => {
                          onTermChange?.({ ...selectedTerms, [a.productId]: Number(e.target.value) });
                          chooseBilling('one-time');
                        }}
                      />
                      {!term && <span aria-hidden="true" className="select-watermark">Fixed Term</span>}
                    </div>
                  </div>
                )}
                {options.length > 1 && !(homeTabs && listed.termOptions) && (
                  <div className={homeTabs ? 'divider-top option-row-aside' : 'divider-top p-3'}>
                    <OptionToggle
                      label={`Billing frequency for ${a.description ?? a.name}`}
                      items={priced.billingOptions!.map((option) => ({
                        key: option.frequency,
                        label: `${option.frequency === 'weekly' ? 'Weekly' : option.frequency === 'monthly' ? (homeTabs ? 'Recurring' : 'Monthly') : 'One-Time'} · QAR ${formatAmount(option.priceQAR)}`,
                      }))}
                      active={billing}
                      onChange={chooseBilling}
                    />
                  </div>
                )}
                {extra && <div onClick={(e) => e.stopPropagation()}>{extra}</div>}
              </div>
    );
  };

  return (
    // Heading and spacing match the "Eligible Discounts" section this now sits
    // above (2026-09-26). It was a muted caption at --fs-caption, which read as
    // a field label rather than as one of the step's three sections - so the
    // agent saw two headings and a label where there are three equal choices to
    // make. Same element, size and weight as its sibling; the "(optional)"
    // stays because it is the one thing that distinguishes this section from
    // the other two, both of which require an answer.
    <div className="space-y-4">
      {!hideHeader && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="row gap-2 w-full text-left"
        >
          <Icon path={CHEVRON_RIGHT} className={`size-4 chevron-turn ${open ? 'rotate-90' : ''}`} />
          <h3 className="title title-md font-semibold">
            Add-ons{selectedIds.length > 0 ? ` (${selectedIds.length} selected)` : ' (optional)'}
          </h3>
        </button>
      )}
      {useTabs && (
        <div className="space-y-3">
          {/* The category (navigation) - the underline tabs, with how many of the chosen add-ons each holds. */}
          <TabStrip
            label="Add-On Categories"
            items={tabs.map((c) => ({ key: c, label: c, count: c !== FREQUENTLY_USED_TAB && perCategory[c] > 0 ? perCategory[c] : undefined }))}
            active={activeTab}
            onChange={(c) => {
              categoryPicked.current = true;
              setCategory(c);
              setSearch('');
            }}
          />
          {slot?.before}
          {!slot?.hideList && <SearchField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder={`Search ${activeTab} add-ons by name or price`}
            aria-label={`Search ${activeTab} add-ons`}
          />}
        </div>
      )}
      {/* Add-on cards share the plan cards' standard (shared idle / selected states, selected texture, tick).
          Multi-select: each card toggles only itself, so choosing one never clears another. */}
      {useTabs && slot?.hideList ? null : useTabs ? (
        paid.length === 0 && free.length === 0 && !freeFirst ? (
          <EmptyState
            icon={LAYERS_ICON}
            title={q ? `No ${activeTab.toLocaleLowerCase()} add-ons match your search` : activeTab === FREQUENTLY_USED_TAB ? 'No frequently used add-ons for this customer' : `No ${activeTab.toLocaleLowerCase()} add-ons available`}
            message={q ? (
              `Try another name or price. Other categories and your selected add-ons are unchanged.`
            ) : activeTab === FREQUENTLY_USED_TAB ? (
              <>
                <span className="block">No add-on is marked as frequently used for this customer's plan and nationality.</span>
                <span className="mt-3 block text-[length:var(--fs-caption)]">All add-ons are still listed under their own categories.</span>
              </>
            ) : (
              <>
                <span className="block">There are no priced, eligible add-ons available in this category.</span>
                <span className="block">Unpriced, ineligible and discontinued offers are excluded.</span>
                <span className="mt-3 block text-[length:var(--fs-caption)]">Other categories and your selected add-ons are unchanged.</span>
              </>
            )}
            className="min-h-80 border-y border-border-soft"
          />
        ) : (
        <div className={aggregated ? 'stack' : 'fields gap-6 md:grid-cols-2'}>
          {([[homeTabs ? 'Paid' : 'Paid Addons', paid, 'paid'], [homeTabs ? 'Free' : 'Free Addons', free, 'free']] as const).filter(([, , kind]) => kind === 'paid' || !aggregated).map(([title, list, kind]) => (
            <section key={kind} aria-label={title} className="space-y-4 min-w-0">
              {!aggregated && (<div className={`row gap-2 label-caps font-semibold ${kind === 'free' ? 'text-[var(--success)]' : 'text-fg-2'}`}>
                <h4>{title}</h4>
                <span className={`count-pill ${kind === 'free' ? 'bg-tone-success text-[var(--success)]' : 'bg-surface text-fg-2'}`}>
                  {list.length + (kind === 'free' && freeFirst ? 1 : 0)}
                </span>
              </div>)}
              {kind === 'free' && freeFirst}
              {list.length === 0 ? (kind === 'free' && freeFirst ? null : <EmptyState compact message={q ? `No ${kind} add-ons in ${activeTab} match that search.` : `No ${kind} add-ons in ${activeTab}.`} />) : <div className={aggregated ? 'fields-sm md:grid-cols-2' : 'stack gap-4'}>{list.map((a) => rowCard(a))}</div>}
            </section>
          ))}
        </div>
        )
      ) : (
      <div className={layout === 'rows' ? `fields-sm md:grid-cols-2 ${open || hideHeader ? '' : 'hidden'}` : `grid grid-cols-[repeat(auto-fill,minmax(max(15rem,calc((100%-2rem)/3)),1fr))] gap-4 ${open || hideHeader ? '' : 'hidden'}`}>
        {shown.map((a) => {
          const selected = selectedIds.includes(a.productId);
          if (layout === 'rows') return rowCard(a);
          return (
            <div
              key={a.productId}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              onClick={() => toggle(a.productId)}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  toggle(a.productId);
                }
              }}
              className={`option-card isolate gap-3 p-5 ${
                selected ? CARD_SELECTED : CARD_IDLE
              }`}
            >
              {selected && <SelectedCardTexture />}
              {selected && <SelectedTick />}
              <p className="title title-lg leading-snug">{a.name}</p>
              {a.description && <p className="caption-secondary">{a.description}</p>}
              <p className="text-accent mt-auto">
                <span className="text-[length:var(--fs-body)] font-semibold">QAR </span>
                <span className="text-[length:var(--fs-h3)] font-bold">{formatAmount(a.mrcQAR)}</span>
                <span className="caption-secondary">{source === 'prepaid' ? ' one-off' : ' /mo'}</span>
              </p>
            </div>
          );
        })}
      </div>
      )}
      {useTabs && slot?.after}
    </div>
  );
}
