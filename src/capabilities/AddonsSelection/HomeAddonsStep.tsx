import { useEffect } from 'react';
import { useEntityRecords } from '../../services/entityHooks';
import { homePlayOf } from '../../components/patterns/homePlanModel';
import { AddonsPicker, type AddonProduct, type AddonTabSlot } from './AddonsPicker';
import { IptvEnable, IptvStbPanel } from './HomeIptvPanels';
import { HOME_ADDON_TABS } from '../../engines/addonCategories';
import type { AddonBillingFrequency } from '../../engines/addonCategories';
import type { HomeIptvSelection } from '../../engines/homeIptv';
import type { HomeExtendersSelection } from '../../engines/homeExtenders';
import { HomeExtendersCard } from './HomeExtendersCard';

export interface HomeAddonsStepProps {
  /** The home plan (fixed line, fibre, FWA, 5G Home) the add-ons are for: the only thing the Add-ons page takes from the plan page. */
  planId: string | undefined;
  addonIds?: string[];
  onAddonsChange: (ids: string[]) => void;
  /** For the add-ons that can be taken recurring or one-time: the agent's choice by add-on id. */
  addonBilling?: Record<string, AddonBillingFrequency>;
  onBillingChange?: (next: Record<string, AddonBillingFrequency>) => void;
  /** The Speed Booster's fixed term in months, by add-on id. */
  addonTerms?: Record<string, number>;
  onTermsChange?: (next: Record<string, number>) => void;
  /** The IPTV add-on's choices (enabled, bundle, set-top box, additional boxes). */
  iptv?: HomeIptvSelection;
  onIptvChange?: (next: HomeIptvSelection) => void;
  /** The Wi-Fi Extenders the customer asks for (quantity; the plan's free allowance is applied). */
  extenders?: HomeExtendersSelection;
  onExtendersChange?: (next: HomeExtendersSelection | undefined) => void;
  /** The set-top boxes' and Mesh extenders' serial numbers are captured here (default). False for a Field Engineer order: the field engineer scans them. */
  deviceSerials?: boolean;
  emptyMessage?: string;
}

// The Add-ons page of a home journey, the same page as the postpaid one - the plan's add-ons under category tabs with a search, Paid and Free side by side - over the add-ons the home
// plan carries (addons-discounts for the plan), charged monthly. A bill limit and service options are mobile line settings: a home connection has neither. The IPTV tab adds an enable
// switch, then the bundle plans, then the set-top box questions (engines/homeIptv.ts).
export function HomeAddonsStep({ planId, addonIds = [], onAddonsChange, addonBilling, onBillingChange, addonTerms, onTermsChange, iptv, onIptvChange, extenders, onExtendersChange, deviceSerials = true, emptyMessage = 'No add-ons available for this plan' }: HomeAddonsStepProps) {
  const products = useEntityRecords<{ productId: string; type?: string; iptvIncluded?: boolean; freeExtenders?: number }>('products');
  const plan = products?.find((p) => p.productId === planId);
  // A Triple Play plan already includes IPTV: its bundles are listed straight away, with no switch. Only a Double Play plan has IPTV to enable.
  const triple = homePlayOf(plan) === 'triple';
  const needsFlag = triple && (!iptv?.enabled || !iptv.planIncluded);
  useEffect(() => {
    if (needsFlag) onIptvChange?.({ ...iptv, enabled: true, planIncluded: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsFlag]);
  if (!planId) return <p className="muted-body">Select a plan first - its add-ons appear here.</p>;
  const selection: HomeIptvSelection = triple ? { ...iptv, enabled: true, planIncluded: true } : iptv ?? { enabled: false };
  const tabSlot = (tab: string, addons: AddonProduct[]): AddonTabSlot | undefined => {
    if (tab === 'Mesh') {
      // The plan's Wi-Fi Extender add-on is set by quantity here (the plan's free allowance applied), not listed as a card.
      const extender = addons.find((a) => a.extender === true);
      if (!extender || !onExtendersChange) return undefined;
      const monthly = extender.billingOptions?.find((o) => o.frequency === 'monthly')?.priceQAR ?? extender.mrcQAR;
      const oneTime = extender.billingOptions?.find((o) => o.frequency === 'one-time')?.priceQAR;
      return {
        before: <HomeExtendersCard terms={{ freeAllowance: plan?.freeExtenders ?? 0, monthlyQAR: monthly, oneTimeQAR: oneTime }} selection={extenders} onChange={onExtendersChange} serials={deviceSerials} />,
        hide: (a) => a.extender === true,
      };
    }
    if (tab !== 'IPTV') return undefined;
    const bundles = addons.filter((a) => a.addonCategory === 'IPTV');
    const chosen = bundles.find((a) => addonIds.includes(a.productId));
    const setEnabled = (on: boolean) => {
      // Turning IPTV off takes its bundle off the order and forgets the box choices.
      if (!on) onAddonsChange(addonIds.filter((id) => !bundles.some((b) => b.productId === id)));
      onIptvChange?.(on ? { enabled: true } : { enabled: false });
    };
    return {
      before: triple ? undefined : <IptvEnable enabled={selection.enabled} onChange={setEnabled} />,
      hideList: !selection.enabled,
      after: selection.enabled && onIptvChange ? <IptvStbPanel bundle={chosen} selection={selection} onChange={onIptvChange} serials={deviceSerials} /> : undefined,
    };
  };
  return (
    <section aria-label="Add-ons" className="space-y-3 min-w-0">
      <AddonsPicker selectedIds={addonIds} onChange={onAddonsChange} hideHeader layout="rows" categorized homeTabs={HOME_ADDON_TABS} tabSlot={tabSlot} tabExtraCounts={{ Mesh: Math.max(0, Math.floor(extenders?.quantity ?? plan?.freeExtenders ?? 0)) }} selectedBilling={addonBilling} onBillingChange={onBillingChange} selectedTerms={addonTerms} onTermChange={onTermsChange} source="plan" emptyMessage={emptyMessage} eligibilityContext={{ planId }} />
    </section>
  );
}
