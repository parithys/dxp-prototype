import { useEffect } from 'react';
import { Badge, Button, INSTALLATION_WIFI, Icon, OptionToggle } from 'dxp-ui';
import { extenderCharge, type ExtenderTerms, type HomeExtendersSelection } from '../../engines/homeExtenders';
import { formatAmount } from '../../lib/format';

/**
 * The Mesh tab's Wi-Fi Extenders: what the plan includes ("4 Extenders included with your plan"), the quantity the customer asks for, and how that splits into Free and Chargeable units. Nothing is
 * added for the agent beyond that; the quantity opens at the plan's allowance and the units beyond the plan's allowance are chargeable at the Extender add-on's price, recurring or one-time.
 */
export function HomeExtendersCard({ terms, selection, onChange }: { terms: ExtenderTerms; selection: HomeExtendersSelection | undefined; onChange: (next: HomeExtendersSelection | undefined) => void }) {
  const quantity = selection?.quantity ?? 0;
  const c = extenderCharge(selection ?? { quantity: 0, terms });
  // Zero is the agent's own answer (kept), so the default below is not applied again after they take the Extenders off.
  const set = (q: number) => onChange({ quantity: q, billing: selection?.billing, terms });
  const included = terms.freeAllowance;
  // The quantity starts at the Extenders the plan includes (all free); the agent changes it to what the customer asks for.
  useEffect(() => {
    if (!selection && included > 0) onChange({ quantity: included, terms });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection === undefined, included]);
  return (
    <section aria-label="Wi-Fi Extenders" className="card card-static-highlight p-6 stack gap-4">
      {/* Singled out at the top of the Mesh tab: what the plan includes, and the quantity the customer asks for. */}
      <div className="row gap-4">
        <span className="option-glyph option-glyph-lg glyph-chosen">
          <Icon path={INSTALLATION_WIFI} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="title title-xl">Wi-Fi Extenders</h3>
          <p className="text-secondary">{included > 0 ? `${included} ${included === 1 ? 'Extender' : 'Extenders'} included with your plan.` : 'No Extenders are included with your plan.'} Additional Extenders are chargeable.</p>
        </div>
        {included > 0 && <Badge variant="success">{included} Included Free</Badge>}
      </div>
      <div className="row gap-4 divider-top pt-4">
        <span className="title title-md flex-1">Quantity Requested</span>
        <Button variant="secondary" size="icon" aria-label="Fewer Extenders" disabled={quantity <= 0} onClick={() => set(quantity - 1)}>
          -
        </Button>
        <span aria-live="polite" className="title title-2xl min-w-10 text-center">{quantity}</span>
        <Button variant="secondary" size="icon" aria-label="More Extenders" onClick={() => set(quantity + 1)}>
          +
        </Button>
      </div>
      {quantity > 0 && (
        <dl className="stack gap-2 divider-top pt-4">
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
                {c.chargeable} additional {c.chargeable === 1 ? 'Extender' : 'Extenders'}
              </dt>
              <dd className="row gap-2">
                <Badge variant="tag-amber">Chargeable</Badge>
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
            onChange={(billing) => onChange({ quantity, billing, terms })}
          />
        </div>
      )}
    </section>
  );
}
