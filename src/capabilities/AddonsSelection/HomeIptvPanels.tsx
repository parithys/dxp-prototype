import { useEffect, useState, type ReactNode } from 'react';
import { Button, Drawer, Switch } from 'dxp-ui';
import { CARD_IDLE, CARD_SELECTED, SelectedTick } from '../../components/primitives/offerCardParts';
import { MAX_EXTRA_STBS, extraStbChargeQar, extraStbCount, iptvOneTimeLines, isIptvComplete, stbLabel, type HomeIptvSelection, type StbChoice } from '../../engines/homeIptv';
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
export function IptvStbPanel({ bundle, selection, onChange }: { bundle: AddonProduct | undefined; selection: HomeIptvSelection; onChange: (next: HomeIptvSelection) => void }) {
  // The choice follows the bundle: another bundle starts its box choice again.
  const bundleId = bundle?.productId;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (bundleId === selection.bundleId) return;
    onChange({ ...selection, bundleId, stbOffered: bundle?.stb?.included === true, stb: undefined, extraStbs: undefined });
    if (bundleId) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleId]);
  if (!bundle) return <p className="muted-body">Choose an IPTV bundle plan to continue.</p>;
  const terms = bundle.stb;
  const count = extraStbCount(selection);
  const asked = selection.extraStbs !== undefined;
  const options: { key: StbChoice; title: string; note: string; price: string }[] = terms?.included
    ? [
        { key: 'premium', title: 'Premium STB', note: 'The premium box for this bundle', price: qar(terms.premiumPriceQAR) },
        { key: 'lite', title: 'Lite STB', note: 'The lite box for this bundle', price: qar(terms.litePriceQAR) },
        { key: 'none', title: 'No STB', note: 'Proceed without a set-top box', price: 'No charge' },
      ]
    : [];
  const oneTime = iptvOneTimeLines(bundle, selection);
  const oneTimeTotal = oneTime.reduce((sum, l) => sum + l.amountQAR, 0);
  const readBack = [selection.stb ? stbLabel(selection.stb) : terms?.included ? 'Set-top box not chosen' : undefined, asked ? (count > 0 ? `${count} additional STB${count > 1 ? 's' : ''}` : 'No additional STBs') : 'Additional STBs not answered'].filter(Boolean).join(' · ');
  return (
    <>
      <div className="card p-4">
        <div className="split">
          <div>
            <p className="title title-md font-semibold">Set-Top Box</p>
            <p className="caption-secondary">{readBack}</p>
          </div>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {isIptvComplete(selection) ? 'Edit' : 'Choose'}
          </Button>
        </div>
      </div>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Set-Top Box"
        footer={
          <>
            <p className="caption-secondary flex-1">{oneTimeTotal > 0 ? `One-time charges today: QAR ${formatAmount(oneTimeTotal)}` : 'No one-time charges'}</p>
            <Button disabled={!isIptvComplete(selection)} onClick={() => setOpen(false)}>
              Done
            </Button>
          </>
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
                  <ChoiceRow key={o.key} selected={selection.stb === o.key} title={o.title} note={o.note} aside={o.price} onSelect={() => onChange({ ...selection, stb: o.key })} />
                ))}
              </div>
            </section>
          )}
          <section aria-label="Additional Set-Top Boxes" className="stack gap-3">
            <div>
              <h3 className="title title-lg">Additional Set-Top Boxes</h3>
              <p className="caption-secondary">Extra physical boxes for other TVs. Always chargeable: QAR {formatAmount(bundle.extraStbPriceQAR ?? 0)} each, one-time.</p>
            </div>
            <div role="radiogroup" aria-label="Additional Set-Top Boxes" className="stack gap-3">
              <ChoiceRow selected={asked && count === 0} title="No Additional STBs" note="The customer needs no extra boxes" onSelect={() => onChange({ ...selection, extraStbs: 0 })} />
              <ChoiceRow
                selected={count > 0}
                title="Add Additional STBs"
                note="Choose how many"
                aside={count > 0 ? `QAR ${formatAmount(extraStbChargeQar(bundle, selection))}` : undefined}
                onSelect={() => onChange({ ...selection, extraStbs: Math.max(1, count) })}
              >
                {count > 0 && (
                  <div className="row gap-3 divider-top pt-3">
                    <span className="caption-secondary flex-1">Quantity</span>
                    <Button variant="secondary" size="icon-sm" aria-label="Fewer additional STBs" disabled={count <= 1} onClick={() => onChange({ ...selection, extraStbs: count - 1 })}>
                      -
                    </Button>
                    <span aria-live="polite" className="title title-lg">{count}</span>
                    <Button variant="secondary" size="icon-sm" aria-label="More additional STBs" disabled={count >= MAX_EXTRA_STBS} onClick={() => onChange({ ...selection, extraStbs: count + 1 })}>
                      +
                    </Button>
                  </div>
                )}
              </ChoiceRow>
            </div>
          </section>
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
