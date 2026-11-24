import { useEffect, useState, type ReactNode } from 'react';
import { Button, Drawer, Switch } from 'dxp-ui';
import { SerialCaptureField } from './SerialCaptureField';
import { scanMockSerial } from '../../data/reference/deviceScanMock';
import { CARD_IDLE, CARD_SELECTED, SelectedTick } from '../../components/primitives/offerCardParts';
import { MAX_EXTRA_STBS, extraStbChargeQar, asksAdditionalStbs, extraStbCount, isIptvComplete, type HomeIptvSelection, type StbChoice } from '../../engines/homeIptv';
import { formatAmount } from '../../lib/format';
import type { AddonProduct } from './AddonsPicker';

const qar = (n: number) => (n > 0 ? `QAR ${formatAmount(n)} one-time` : 'Free');

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
 * Under the bundle plans: a card reading back the set-top box choices, and the side drawer where they are made - the set-top box the chosen bundle comes with (Premium, Lite or none - free
 * or chargeable by the bundle's own terms), then, whatever was chosen, whether the customer needs additional physical STBs and how many (always chargeable). The drawer opens when a bundle
 * is chosen; Edit reopens it.
 */
export function IptvStbPanel({ bundle, selection, onChange, serials = true }: { bundle: AddonProduct | undefined; selection: HomeIptvSelection; onChange: (next: HomeIptvSelection) => void; serials?: boolean }) {
  // The choice follows the bundle: another bundle starts its box choice again.
  const bundleId = bundle?.productId;
  const [open, setOpen] = useState(false);
  // What the choice was when the drawer opened: Cancel puts it back.
  const [opened, setOpened] = useState<HomeIptvSelection>(selection);
  const openDrawer = (from: HomeIptvSelection) => {
    setOpened(from);
    setOpen(true);
  };
  useEffect(() => {
    if (bundleId === selection.bundleId) return;
    const fresh: HomeIptvSelection = { ...selection, bundleId, stbOffered: bundle?.stb?.included === true, stb: undefined, stbSerial: undefined, extraStbs: undefined, extraStbSerials: undefined };
    onChange(fresh);
    if (bundleId) openDrawer(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleId]);
  if (!bundle) return <p className="muted-body">Choose an IPTV bundle plan to continue.</p>;
  const terms = bundle.stb;
  const count = extraStbCount(selection);
  const asked = selection.extraStbs !== undefined;
  // The serials already on this order's boxes: a scan never reads one of them again.
  const stbSerialsTaken = [selection.stbSerial, ...(selection.extraStbSerials ?? [])].filter((x): x is string => Boolean(x));
  const options: { key: StbChoice; title: string; note: string; price: string | undefined }[] = terms?.included
    ? [
        { key: 'lite', title: 'Lite STB', note: 'The lite box for this bundle', price: qar(terms.litePriceQAR) },
        { key: 'premium', title: 'Premium STB', note: 'The premium box for this bundle', price: qar(terms.premiumPriceQAR) },
        { key: 'none', title: 'No STB', note: 'Proceed without a set-top box', price: undefined },
      ]
    : [];
  return (
    <>
      {/* No card: the drawer opens by itself when a bundle is chosen, and this link is the way back to it. */}
      <Button variant="link" className="link" onClick={() => openDrawer(selection)}>
        {isIptvComplete(selection, serials) ? 'Edit Set-Top Box' : 'Choose Set-Top Box'}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Set-Top Box"
        footer={
          // One child: the drawer's footer lays its children out as equal columns, so the two buttons sit together at the right, each as wide as its label.
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                onChange(opened);
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button disabled={!isIptvComplete(selection, serials)} onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="stack gap-6">
          <p className="caption-secondary">
            For <span className="font-semibold text-fg">{bundle.name}</span>
          </p>
          {terms?.included && (
            <section aria-label="Set-Top Box" className="stack gap-3">
              <div>
                <h3 className="title title-lg">Set-Top Box</h3>
                <p className="caption-secondary">Included with the bundle. Choose the box, or go without one.</p>
              </div>
              <div role="radiogroup" aria-label="Set-Top Box" className="stack gap-3">
                {options.map((o) => (
                  <ChoiceRow key={o.key} selected={selection.stb === o.key} title={o.title} note={o.note} aside={o.price} onSelect={() => (o.key === selection.stb ? undefined : onChange({ ...selection, stb: o.key, stbSerial: undefined, ...(o.key === 'none' ? { extraStbs: undefined, extraStbSerials: undefined } : {}) }))}
                  >
                    {/* A Premium or Lite box is a physical unit: its serial number is captured here by scanning its barcode (and can be removed). */}
                    {serials && o.key !== 'none' && <SerialCaptureField kind="STB" label="STB Serial Number" sample={() => scanMockSerial('stb', stbSerialsTaken)} serial={selection.stbSerial} onChange={(stbSerial) => onChange({ ...selection, stbSerial })} />}
                  </ChoiceRow>
                ))}
              </div>
            </section>
          )}
          {/* Asked only once a Premium or Lite STB is chosen: with No STB the section stays hidden. */}
          {asksAdditionalStbs(selection) && (
            <section aria-label="Additional Set-Top Boxes" className="stack gap-3">
              <div>
                <h3 className="title title-lg">Additional Set-Top Boxes</h3>
                <p className="caption-secondary">Extra physical boxes for other TVs. Always chargeable: QAR {formatAmount(bundle.extraStbPriceQAR ?? 0)} each, one-time.</p>
              </div>
              <div role="radiogroup" aria-label="Additional Set-Top Boxes" className="stack gap-3">
                <ChoiceRow
                  selected={count > 0}
                  title="Add Additional STBs"
                  note="Choose how many"
                  aside={count > 0 ? `QAR ${formatAmount(extraStbChargeQar(bundle, selection))}` : undefined}
                  onSelect={() => onChange({ ...selection, extraStbs: Math.max(1, count) })}
                >
                  {count > 0 && (
                    <>
                    <div className="row gap-3 divider-top pt-3">
                      <span className="caption-secondary flex-1">Quantity</span>
                      <Button variant="secondary" size="icon" aria-label="Fewer additional STBs" className="btn-icon-bordered text-fg size-11" disabled={count <= 0} onClick={() => onChange({ ...selection, extraStbs: count - 1, extraStbSerials: selection.extraStbSerials?.slice(0, count - 1) })}>
                        <span aria-hidden="true" className="title title-xl">−</span>
                      </Button>
                      <span aria-live="polite" className="title title-lg">{count}</span>
                      <Button variant="secondary" size="icon" aria-label="More additional STBs" className="btn-icon-bordered text-fg size-11" disabled={count >= MAX_EXTRA_STBS} onClick={() => onChange({ ...selection, extraStbs: count + 1 })}>
                        <span aria-hidden="true" className="title title-xl">+</span>
                      </Button>
                    </div>
                    {/* Each additional box has its own serial number, captured as the first box's is. */}
                    {serials && (<div className="stack gap-3">
                      {Array.from({ length: count }, (_, i) => (
                        <SerialCaptureField
                          key={i}
                          kind="STB"
                          sample={() => scanMockSerial('stb', stbSerialsTaken)}
                          label={`Additional STB ${i + 1} Serial Number`}
                          serial={selection.extraStbSerials?.[i]}
                          onChange={(serial) => {
                            const next = Array.from({ length: count }, (_, j) => selection.extraStbSerials?.[j] ?? '');
                            next[i] = serial ?? '';
                            onChange({ ...selection, extraStbSerials: next });
                          }}
                        />
                      ))}
                    </div>)}
                    </>
                  )}
                </ChoiceRow>
                <ChoiceRow selected={asked && count === 0} title="No Additional STBs" note="The customer needs no extra boxes" onSelect={() => onChange({ ...selection, extraStbs: 0, extraStbSerials: undefined })} />
              </div>
            </section>
          )}
        </div>
      </Drawer>
    </>
  );
}

/** One answer as a selectable card (the app's card-selection pattern: tick and wash when chosen), the price or charge on the right; its own controls sit inside it. */
function ChoiceRow({ selected, title, note, aside, onSelect, children }: { selected: boolean; title: string; note: string; aside?: string; onSelect: () => void; children?: ReactNode }) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`option-card gap-3 p-4 ${selected ? CARD_SELECTED : CARD_IDLE}`}
    >
      {selected && <SelectedTick />}
      <div className="split">
        <div>
          <p className="title title-md font-semibold">{title}</p>
          <p className="caption-secondary">{note}</p>
        </div>
        {aside && <p className="title title-md whitespace-nowrap">{aside}</p>}
      </div>
      {selected && children && <div onClick={(e) => e.stopPropagation()}>{children}</div>}
    </div>
  );
}
