import { useEffect } from 'react';
import { listEntities } from '../../services/entityOps';
import { isFreeAddon, isAddonAvailable } from '../../engines/addonCategories';

type Values = Record<string, unknown>;

/**
 * The plan's free add-ons put on the order for the agent, once per plan, whether or not the Add-ons page is shown (it is passed over when the agent does not ask to customise): the same rule as the
 * page's own default (AddonsPicker `freeByDefault`) - a free, available add-on of the plan that is not one of several alternatives (an exclusive group - the IPTV bundles) and not IPTV - and the same
 * marker (`freeAddonsFor`), so the two never apply it twice and an add-on the agent takes off stays off. Renders nothing.
 */
export function HomeFreeAddonsApplier({ values, setValue }: { values: Values; setValue: (field: string, value: unknown) => void }) {
  const planId = values.productId as string | undefined;
  const done = values.freeAddonsFor as string | undefined;
  useEffect(() => {
    if (!planId || done === planId) return;
    let cancelled = false;
    void listEntities<{ addonDiscountId: string; category: string; planId?: string; price: number; addonCategory?: string; exclusiveGroup?: string; addonStatus?: string }>('addons-discounts').then((all) => {
      if (cancelled) return;
      const free = all
        .filter((d) => d.category === 'Paid Add-on' && d.planId === planId && !d.exclusiveGroup && d.addonCategory !== 'IPTV')
        .map((d) => ({ id: d.addonDiscountId, addon: { mrcQAR: d.price, addonStatus: d.addonStatus } }))
        .filter(({ addon }) => isFreeAddon(addon) && isAddonAvailable(addon))
        .map(({ id }) => id);
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
