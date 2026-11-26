import { useEffect } from 'react';
import { Button, OptionToggle, Switch } from 'dxp-ui';
import { SerialCaptureField } from './SerialCaptureField';
import { scanMockSerial } from '../../data/reference/deviceScanMock';
import { MAX_EXTRA_STBS, extraStbCount, type HomeIptvSelection, type StbChoice } from '../../engines/homeIptv';
import { formatAmount } from '../../lib/format';
import type { AddonProduct } from './AddonsPicker';


/** The IPTV tab's switch: IPTV is an add-on the agent turns on; its bundle plans (Paid and Free) are listed once it is on. */
export function IptvEnable({ enabled, onChange }: { enabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="card p-4">
      <div className="split">
        <div>
          <p className="title title-md font-semibold">Enable IPTV</p>
          <p className="caption-secondary">{enabled ? 'Choose an IPTV bundle plan below.' : 'Turn on to add IPTV and see the available bundle plans.'}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onChange} aria-label="Enable IPTV" />
      </div>
    </div>
  );
}

/**
 * Inside the chosen bundle's own card: the set-top box choices, made right there (no side drawer) - the box the bundle comes with (Lite or Premium, free or chargeable by the bundle's own terms; "No STB" only
 * where the plan does not include IPTV), then whether the customer needs additional physical STBs and how many (always chargeable).
 */
export function IptvStbChoices({ bundle, selection, onChange, serials = true }: { bundle: AddonProduct | undefined; selection: HomeIptvSelection; onChange: (next: HomeIptvSelection) => void; serials?: boolean }) {
  // The choice follows the bundle: another bundle starts its box choice again.
  const bundleId = bundle?.productId;
  useEffect(() => {
    if (bundleId === selection.bundleId) return;
    const fresh: HomeIptvSelection = { ...selection, bundleId, stbOffered: bundle?.stb?.included === true, stb: bundle?.stb?.included === true ? 'none' : undefined, stbSerial: undefined, extraStbs: undefined, extraStbSerials: undefined };
    onChange(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleId]);
  if (!bundle) return <p className="muted-body">Choose an IPTV bundle plan to continue.</p>;
  const terms = bundle.stb;
  // The serials already on this order's boxes: a scan never reads one of them again.
  const stbSerialsTaken = [selection.stbSerial, ...(selection.extraStbSerials ?? [])].filter((x): x is string => Boolean(x));
  // Nothing to choose for this bundle: no link, no drawer.
  if (!terms?.included) return null;
  // The quantity is the bundle's own box plus the additional boxes requested (1 by default).
  const quantity = 1 + extraStbCount(selection);
  const setQuantity = (n: number) => onChange({ ...selection, extraStbs: Math.max(0, n - 1), extraStbSerials: selection.extraStbSerials?.slice(0, Math.max(0, n - 1)) });
  // No STB (the default), Lite or Premium. The boxes' own terms (free or chargeable) are charged as before and read on the order.
  const items: { key: StbChoice; label: string }[] = [
    { key: 'none', label: 'No STB' },
    { key: 'lite', label: 'Lite' },
    { key: 'premium', label: 'Premium' },
  ];
  return (
    <div className="divider-top option-row-aside stack gap-3">
      <div className="row gap-3">
        <span className="title title-md font-semibold">Choose STB:</span>
        <OptionToggle
          label="Choose STB"
          items={items}
          active={selection.stb}
          onChange={(key) => (key === selection.stb ? undefined : onChange({ ...selection, stb: key as StbChoice, stbSerial: undefined, ...(key === 'none' ? { extraStbs: undefined, extraStbSerials: undefined } : {}) }))}
        />
      </div>
      {/* How many boxes: one by default (the bundle's own); each more is an additional box, charged by the bundle's extra-box price. */}
      {(selection.stb === 'lite' || selection.stb === 'premium') && (
        <div className="row gap-3">
          <span className="title title-md font-semibold flex-1">Quantity</span>
          <Button variant="secondary" size="icon" aria-label="Fewer STBs" className="btn-icon-bordered text-fg size-11" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}>
            <span aria-hidden="true" className="title title-xl">−</span>
          </Button>
          <span aria-live="polite" className="title title-lg">{quantity}</span>
          <Button variant="secondary" size="icon" aria-label="More STBs" className="btn-icon-bordered text-fg size-11" disabled={quantity >= 1 + MAX_EXTRA_STBS} onClick={() => setQuantity(quantity + 1)}>
            <span aria-hidden="true" className="title title-xl">+</span>
          </Button>
        </div>
      )}
      {quantity > 1 && (selection.stb === 'lite' || selection.stb === 'premium') && (
        <p className="caption-secondary">Additional boxes: QAR {formatAmount(bundle.extraStbPriceQAR ?? 0)} each, one-time.</p>
      )}
      {/* Each additional box has its own serial number, captured as the first box's is. */}
      {serials && quantity > 1 && (selection.stb === 'lite' || selection.stb === 'premium') && (
        <div className="stack gap-3">
          {Array.from({ length: quantity - 1 }, (_, i) => (
            <SerialCaptureField
              key={i}
              kind="STB"
              sample={() => scanMockSerial('stb', stbSerialsTaken)}
              label={`Additional STB ${i + 1} Serial Number`}
              serial={selection.extraStbSerials?.[i]}
              onChange={(serial) => {
                const next = Array.from({ length: quantity - 1 }, (_, j) => selection.extraStbSerials?.[j] ?? '');
                next[i] = serial ?? '';
                onChange({ ...selection, extraStbSerials: next });
              }}
            />
          ))}
        </div>
      )}
      {/* A Lite or Premium box is a physical unit: its serial number is captured here by scanning its barcode (and can be removed). */}
      {serials && (selection.stb === 'lite' || selection.stb === 'premium') && (
        <SerialCaptureField kind="STB" label="STB Serial Number" sample={() => scanMockSerial('stb', stbSerialsTaken)} serial={selection.stbSerial} onChange={(stbSerial) => onChange({ ...selection, stbSerial })} />
      )}
    </div>
  );
}
