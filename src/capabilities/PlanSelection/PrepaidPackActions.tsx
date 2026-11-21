import { usePackHasAddons } from '../AddonsSelection/usePackHasAddons';
import { AddDiscountAction } from './AddDiscountAction';
import { CustomiseAddonsAction } from './CustomiseAddonsAction';

/**
 * What sits beside Continue once a prepaid pack is chosen - the same two actions as the postpaid plan page: "Customise Add-ons" (the way to the Addons page, shown only when
 * the pack has add-ons) and "Edit Discount" (the pack's discount, "No Discount" until one is chosen). Continue itself goes straight on, passing over the Addons page.
 */
export function PrepaidPackActions({
  productId,
  discountId,
  onSelectDiscount,
  setCustomise,
  goNext,
  discountEditable = true,
  customisable,
}: {
  productId: string | undefined;
  discountId: string | undefined;
  onSelectDiscount: (id: string | undefined) => void;
  setCustomise: () => void;
  goNext: () => void;
  /** False for New Prepaid activation: a pack there has no discount to edit, so only Customise Add-ons sits beside Continue. */
  discountEditable?: boolean;
  /** Customise is always offered (New Prepaid: the Addons page also carries the recharge, so it is never empty). Omitted: only when the pack has add-ons. */
  customisable?: boolean;
}) {
  const packHasAddons = usePackHasAddons(productId);
  const hasAddons = customisable ?? packHasAddons;
  return (
    <>
      <CustomiseAddonsAction productId={productId} preBundled={false} available={hasAddons} setCustomise={setCustomise} goNext={goNext} />
      {/* A prepaid pack has no tabs and no Special Discount: its discounts are the ordinary ones the catalogue lists for the pack. */}
      {discountEditable && <AddDiscountAction productId={productId} tab={undefined} discountId={discountId} onSelectDiscount={onSelectDiscount} customerBenefits={undefined} specialDiscountType={undefined} customerBenefit={undefined} />}
    </>
  );
}
