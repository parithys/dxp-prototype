import { useState } from 'react';
import { Pagination } from 'dxp-ui';
import { SPECIAL_DISCOUNT_RATE, specialOfferPlanName, type PostpaidPlan, type PlanGroupKey, type TabKey } from './postpaidPlanModel';
import { PostpaidPlanCard } from './PostpaidPlanCard';
import { STANDARD_PLANS_PAGE_SIZE } from './planPaging';

interface PlanGroupPanelProps {
  groupPlans: (key: PlanGroupKey) => PostpaidPlan[];
  activeTab: TabKey;
  selectedProductId: string | undefined;
  billLimit: number | undefined;
  onSelectProduct: (productId: string) => void;
  onDeselectProduct?: () => void;
  setDetailPlan: (plan: PostpaidPlan) => void;
  /** The customer's validated Special Discount: names the plans on the Special Offers tab. */
  specialDiscountType?: 'mada' | 'b2b2c' | 'retired' | 'none';
  /** The chosen plan's applied discount as a fraction (0.25 = 25%): its card shows the discounted price. */
  discountPct?: number;
}

export function PlanGroupPanel({
  groupPlans,
  activeTab,
  selectedProductId,
  billLimit,
  onSelectProduct,
  onDeselectProduct,
  setDetailPlan,
  specialDiscountType,
  discountPct = 0,
}: PlanGroupPanelProps) {
  const plans = groupPlans(activeTab as PlanGroupKey);
  const paged = activeTab === 'for-you';
  // A different tab, search or filter is a different list: it starts on its first page (the page is kept with the list it was chosen on).
  const listKey = `${activeTab}|${plans.map((p) => p.productId).join(',')}`;
  const [paging, setPaging] = useState({ listKey, page: 1 });
  const page = paging.listKey === listKey ? paging.page : 1;
  const setPage = (n: number) => setPaging({ listKey, page: n });
  const shown = paged ? plans.slice((page - 1) * STANDARD_PLANS_PAGE_SIZE, page * STANDARD_PLANS_PAGE_SIZE) : plans;
  return (
    <div className="space-y-3">
      {plans.length === 0 ? (
        <p className="muted-body">No plans match that search or filter.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(max(15rem,calc((100%-2rem)/3)),1fr))] gap-4">
        {shown.map((p) => (
          <PostpaidPlanCard
            key={p.productId}
            p={p}
            selectedProductId={selectedProductId}
            billLimit={billLimit}
            onSelectProduct={onSelectProduct}
            onDeselectProduct={onDeselectProduct}
            setDetailPlan={setDetailPlan}
            compact={activeTab === 'specials'}
            // Special Offers are the plans the customer's Special Discount applies to: every card, the chosen one included, shows the discounted price from the
            // start. (The chosen plan's discount is picked a moment after the click, once its discounts load; following it would add the struck-through line then and
            // make the card jump.) Other tabs show a discount only on the chosen plan.
            discountPct={activeTab === 'special' ? SPECIAL_DISCOUNT_RATE : p.productId === selectedProductId ? discountPct : 0}
            displayName={activeTab === 'special' ? specialOfferPlanName(p.name, specialDiscountType) : undefined}
          />
        ))}
        </div>
      )}
      {paged && <Pagination page={page} total={plans.length} pageSize={STANDARD_PLANS_PAGE_SIZE} onPage={setPage} />}
    </div>
  );
}
