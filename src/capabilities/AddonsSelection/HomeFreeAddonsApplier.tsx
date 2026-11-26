import { useEffect } from 'react';
import { listEntities } from '../../services/entityOps';
import { isFreeAddon, isAddonAvailable, defaultedFree } from '../../engines/addonCategories';
import { homePlayOf } from '../../components/patterns/homePlanModel';

type Values = Record<string, unknown>;

/**
 * The plan's free add-ons put on the order for the agent, once per plan, whether or not the Add-ons page is shown (it is passed over when the agent does not ask to customise): the same rule as the
 * page's own default (AddonsPicker `freeByDefault`) - every free, available add-on of the plan but, unless the plan includes IPTV, IPTV's, and one only of an exclusive group's alternatives (`defaultedFree`) - and the same
 * marker (`freeAddonsFor`), so the two never apply it twice and an add-on the agent takes off stays off. Renders nothing.
 */
export function HomeFreeAddonsApplier({ values, setValue }: { values: Values; setValue: (field: string, value: unknown) => void }) {
  const planId = values.productId as string | undefined;
  const done = values.freeAddonsFor as string | undefined;
  useEffect(() => {
    if (!planId || done === planId) return;
    let cancelled = false;
    void Promise.all([
      listEntities<{ addonDiscountId: string; category: string; planId?: string; price: number; addonCategory?: string; exclusiveGroup?: string; defaultSelected?: boolean; addonStatus?: string }>('addons-discounts'),
      listEntities<{ productId: string; type?: string; iptvIncluded?: boolean }>('products'),
    ]).then(([all, products]) => {
      if (cancelled) return;
      const iptvIncluded = homePlayOf(products.find((p) => p.productId === planId)) === 'triple';
      const free = defaultedFree(
        all
          .filter((d) => d.category === 'Paid Add-on' && d.planId === planId)
          .map((d) => ({ id: d.addonDiscountId, exclusiveGroup: d.exclusiveGroup, addonCategory: d.addonCategory, defaultSelected: d.defaultSelected, addon: { mrcQAR: d.price, addonStatus: d.addonStatus } }))
          .filter(({ addon }) => isFreeAddon(addon) && isAddonAvailable(addon)),
        iptvIncluded
      ).map(({ id }) => id);
      const have = (values.addonIds as string[] | undefined) ?? [];
      const add = free.filter((id) => !have.includes(id));
      if (add.length > 0) setValue('addonIds', [...have, ...add]);
      setValue('freeAddonsFor', planId);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, done]);
  return null;
}
