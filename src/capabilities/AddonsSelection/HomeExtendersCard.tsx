import { useEffect } from 'react';
import { Badge, Button, INSTALLATION_WIFI, Icon, OptionToggle } from 'dxp-ui';
import { extenderCharge, type ExtenderTerms, type HomeExtendersSelection } from '../../engines/homeExtenders';
import { formatAmount } from '../../lib/format';
import { SerialCaptureField } from './SerialCaptureField';
import { scanMockSerial } from '../../data/reference/deviceScanMock';

/**
 * The Mesh tab's Wi-Fi Extenders: what the plan includes ("4 Extenders included with your plan"), the quantity the customer asks for, and how that splits into Free and Chargeable units. Nothing is
 * added for the agent beyond that; the quantity opens at the plan's allowance and the units beyond the plan's allowance are chargeable at the Extender add-on's price, recurring or one-time.
 */
export function HomeExtendersCard({ terms, selection, onChange, serials = true }: { terms: ExtenderTerms; selection: HomeExtendersSelection | undefined; onChange: (next: HomeExtendersSelection | undefined) => void; serials?: boolean }) {
  const quantity = selection?.quantity ?? 0;
  const c = extenderCharge(selection ?? { quantity: 0, terms });
  // Zero is the agent's own answer (kept), so the default below is not applied again after they take the Extenders off.
  // The serial numbers follow the quantity: taking an Extender off drops the last one's.
  const set = (q: number) => onChange({ quantity: q, billing: selection?.billing, terms, serials: selection?.serials?.slice(0, q) });
  const included = terms.freeAllowance;
  // The quantity starts at the Extenders the plan includes (all free); the agent changes it to what the customer asks for.
  useEffect(() => {
    if (!selection && included > 0) onChange({ quantity: included, terms });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection === undefined, included]);
  return (
    <section aria-label="Wi-Fi Extenders" className="card card-static-highlight p-4 stack gap-3">
      {/* Singled out at the top of the Mesh tab: what the plan includes, and the quantity the customer asks for. */}
      <div className="row gap-4">
        <span className="option-glyph glyph-chosen">
          <Icon path={INSTALLATION_WIFI} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="title title-lg">Wi-Fi Extenders</h3>
          <p className="text-secondary">{included > 0 ? `${included} ${included === 1 ? 'Extender' : 'Extenders'} included with your plan.` : 'No Extenders are included with your plan.'} Additional Extenders are chargeable.</p>
        </div>
        {included > 0 && <Badge variant="success">{included} Included Free</Badge>}
      </div>
      <div className="row gap-3 divider-top pt-3">
        <span className="title title-md flex-1">Quantity Requested</span>
        <Button variant="secondary" size="icon" aria-label="Fewer Extenders" className="btn-icon-bordered text-fg size-9" disabled={quantity <= 0} onClick={() => set(quantity - 1)}>
          <span aria-hidden="true" className="title title-xl">−</span>
        </Button>
        <span aria-live="polite" className="title title-xl min-w-8 text-center">{quantity}</span>
        <Button variant="secondary" size="icon" aria-label="More Extenders" className="btn-icon-bordered text-fg size-9" onClick={() => set(quantity + 1)}>
          <span aria-hidden="true" className="title title-xl">+</span>
        </Button>
      </div>
      {/* Each Mesh extender's serial number, scanned or entered (Instant Activation: the field engineer scans them otherwise). */}
      {serials && quantity > 0 && (
        <div className="divider-top pt-3 fields-2">
          {Array.from({ length: quantity }, (_, i) => (
            <SerialCaptureField
              key={i}
              divided={false}
              kind="Mesh"
              label={quantity > 1 ? `Mesh Extender ${i + 1} Serial Number` : 'Mesh Extender Serial Number'}
              sample={() => scanMockSerial('mesh', (selection?.serials ?? []).filter(Boolean))}
              serial={selection?.serials?.[i]}
              onChange={(serial) => {
                const next = Array.from({ length: quantity }, (_, j) => selection?.serials?.[j] ?? '');
                next[i] = serial ?? '';
                onChange({ quantity, billing: selection?.billing, terms, serials: next });
              }}
            />
          ))}
        </div>
      )}
      {quantity > 0 && (
        <dl className="stack rows-rule">
          {c.free > 0 && (
            <div className="split-nowrap gap-2">
              <dt className="text-fg">
                {c.free} {c.free === 1 ? 'Extender' : 'Extenders'}
              </dt>
              <dd>
                <Badge variant="success">Free</Badge>
              </dd>
            </div>
          )}
          {c.chargeable > 0 && (
            <div className="split-nowrap gap-2">
              <dt className="text-fg">
                {c.chargeable} additional {c.chargeable === 1 ? 'Extender' : 'Extenders'} (Chargeable)
              </dt>
              <dd className="row gap-2">
                <span className="font-semibold">
                  QAR {formatAmount(c.totalQAR)}
                  {c.billing === 'monthly' ? ' /mo' : ' one-time'}
                </span>
              </dd>
            </div>
          )}
        </dl>
      )}
      {c.chargeable > 0 && terms.oneTimeQAR !== undefined && (
        <div className="stack gap-1">
          <OptionToggle
            label="Billing for Additional Extenders"
            items={[
              { key: 'monthly', label: `Recurring · QAR ${formatAmount(terms.monthlyQAR)} each` },
              { key: 'one-time', label: `One-Time · QAR ${formatAmount(terms.oneTimeQAR)} each` },
            ]}
            active={c.billing}
            onChange={(billing) => onChange({ quantity, billing, terms, serials: selection?.serials })}
          />
        </div>
      )}
    </section>
  );
}
