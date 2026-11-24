import type { SummaryField } from '../../components/patterns/wizard/stepSummary';
import { at } from '../summaryKit';
import { extraStbCount, stbLabel, type HomeIptvSelection } from '../../engines/homeIptv';
import { extendersSummaryText, type HomeExtendersSelection } from '../../engines/homeExtenders';

/** What the Addons page of a postpaid or prepaid journey adds to the Journey Summary: the add-ons, the discount and the bill limit, each only once chosen. */
export const addonsSummary: SummaryField[] = [
  { key: 'addons', label: 'Add-Ons', type: 'multi', optional: true, labelFrom: { kind: 'products', idField: 'productId', labelField: 'name' }, value: (v) => at(v, 'addonIds') },
  { key: 'discount', label: 'Discount', type: 'select', optional: true, labelFrom: { kind: 'addons-discounts', idField: 'addonDiscountId', labelField: 'name' }, value: (v) => at(v, 'discountId') },
  { key: 'billLimit', label: 'Bill Limit', type: 'text', optional: true, value: (v) => at(v, 'billLimit') },
];

/** What a home journey's Add-ons page adds to the Journey Summary: a home plan's add-ons are plan-bound add-ons/discounts records, named from there. */
export const homeAddonsSummary: SummaryField[] = [
  { key: 'addons', label: 'Add-Ons', type: 'multi', optional: true, labelFrom: { kind: 'addons-discounts', idField: 'addonDiscountId', labelField: 'name' }, value: (v) => at(v, 'addonIds') },
  { key: 'extenders', label: 'Wi-Fi Extenders', type: 'text', optional: true, value: (v) => extendersSummaryText(v.extenders as HomeExtendersSelection | undefined) },
  {
    key: 'iptvStb',
    label: 'IPTV Set-Top Box',
    type: 'text',
    optional: true,
    value: (v) => {
      const iptv = v.iptv as HomeIptvSelection | undefined;
      if (!iptv?.enabled || !iptv.bundleId) return undefined;
      const extra = extraStbCount(iptv);
      return [iptv.stb ? stbLabel(iptv.stb) : undefined, iptv.stbSerial ? `Serial ${iptv.stbSerial}` : undefined, extra > 0 ? `${extra} additional` : undefined, extra > 0 && iptv.extraStbSerials?.some(Boolean) ? `Additional serials ${iptv.extraStbSerials.slice(0, extra).filter(Boolean).join(' / ')}` : undefined].filter(Boolean).join(', ') || undefined;
    },
  },
];
