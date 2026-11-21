import { useEffect, useState } from 'react';
import { PrepaidPlanCard } from './PrepaidPlanCard';
import { PrepaidPackDetailsDrawer } from './PrepaidPackDetailsDrawer';
import { offeredPrepaidPacks, prepaidOffers, standardPrepaidPlans } from './prepaidPlanModel';
import { TabStrip } from 'dxp-ui';
import type { PrepaidPlan } from './prepaidPlanModel';
import { listEntities } from '../../services/entityOps';

interface PrepaidPlanStepProps {
  /** The customer's segment, from eligibility. Packs restricted to other segments are not offered. A new customer with none on record is treated as Consumer. */
  /** The customer's segment, from eligibility. Packs restricted to other segments are not offered. A new customer with none on record is treated as Consumer. */
  segment?: string;
  selectedProductId: string | undefined;
  onSelectProduct: (productId: string) => void;
  /** Clicking the selected card again unselects it. Omitted, the selection can only be changed, not cleared. */
  /** Clicking the selected card again unselects it. Omitted, the selection can only be changed, not cleared. */
  onDeselectProduct?: () => void;
  /** A pack not offered: the line's current pack, when the journey changes it. */
  /** A pack not offered: the line's current pack, when the journey changes it. */
  hiddenProductId?: string;
  /** Only packs that carry a bundle: the SIM-only option (no data, no validity) is not offered, as when changing the pack of a line that already has its SIM. */
  /** Only packs that carry a bundle: the SIM-only option (no data, no validity) is not offered, as when changing the pack of a line that already has its SIM. */
  packsOnly?: boolean;
  /**
   * New Prepaid activation: the page is laid out as the postpaid one - an Offers tab (the Sales App's offers) and a Standard Plans tab (the packs, SIM-only first) - and the
   * plan is chosen from either. Off (port-in onto prepaid, a pack change): the packs alone, with no tabs.
   */
  tabs?: boolean;
  /** Told which tab a pack was chosen from ('specials' = Offers, 'for-you' = Standard Plans), so the journey can offer Customize Addons for a standard plan only. */
  onPlanTabChange?: (tab: string) => void;
}

// MPRA_001_QPC_01-02 (prepaid plan selection) - the prepaid counterpart of PostpaidPlanStep: the packs to choose from, filtered by the customer's segment (QPC_02).
// The pack's add-ons and discounts (QPC_01, QPC_03) are the Add-Ons capability's page, the step after this one (PrepaidAddonsStep).
export function PrepaidPlanStep({ hiddenProductId, packsOnly, selectedProductId, onSelectProduct, onDeselectProduct, segment, tabs, onPlanTabChange }: PrepaidPlanStepProps) {
  const [plans, setPlans] = useState<PrepaidPlan[]>([]);
  const [offers, setOffers] = useState<PrepaidPlan[]>([]);
  const [activeTab, setActiveTab] = useState<'specials' | 'for-you'>('specials');
  const [detailPack, setDetailPack] = useState<PrepaidPlan | null>(null);

  useEffect(() => {
    listEntities<PrepaidPlan>('products').then((all) => {
      setPlans(tabs ? standardPrepaidPlans(all, { segment, hiddenProductId }) : offeredPrepaidPacks(all, { segment, hiddenProductId, packsOnly }));
      setOffers(tabs ? prepaidOffers(all, { segment }) : []);
    });
  }, [segment, hiddenProductId, packsOnly, tabs]);

  // Choosing a pack also records the tab it was chosen from.
  const selectPack = (productId: string) => {
    onSelectProduct(productId);
    onPlanTabChange?.(activeTab);
  };
  const shown = tabs && activeTab === 'specials' ? offers : plans;

  const packGrid = (
    <div className="space-y-3">
      {shown.length > 0 && (
        <div className={tabs ? 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(max(15rem,calc((100%-2rem)/3)),1fr))]' : 'grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4'}>
          {shown.map((p) => (
            <PrepaidPlanCard
              key={p.productId}
              p={p}
              selectedProductId={selectedProductId}
              onSelectProduct={selectPack}
              onDeselectProduct={onDeselectProduct}
              setDetailPack={setDetailPack}
            />
          ))}
        </div>
      )}
      {shown.length === 0 && <p className="text-muted">{tabs && activeTab === 'specials' ? 'No offers are available right now.' : 'No Prepaid Plan products are available right now.'}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {tabs ? (
        <TabStrip
          label="Plan Groups"
          items={[{ key: 'specials', label: 'Offers' }, { key: 'for-you', label: 'Standard Plans' }]}
          active={activeTab}
          onChange={setActiveTab}
        />
      ) : (
        <div>
          <p className="caption-muted">Select a starter pack. For a SIM without a bundle, choose New Prepaid Standard SIM.</p>
        </div>
      )}
      {packGrid}
      <PrepaidPackDetailsDrawer pack={detailPack} onClose={() => setDetailPack(null)} selectedProductId={selectedProductId} onSelectProduct={selectPack} />
    </div>
  );
}
