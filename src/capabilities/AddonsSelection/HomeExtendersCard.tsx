import { useEffect } from 'react';
import { INSTALLATION_WIFI, Icon, OptionToggle } from 'dxp-ui';
import { CARD_SELECTED, SelectedTick } from '../../components/primitives/offerCardParts';
import { freePeriodLabel } from '../../engines/addonCategories';
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
  const included = terms.freeAllowance;
  // The quantity starts at the Extenders the plan includes (all free); the agent changes it to what the customer asks for.
  useEffect(() => {
    if (!selection && included > 0) onChange({ quantity: included, terms });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection === undefined, included]);
  return (
    // The same look as a selected add-on card (its tick and wash): the plan's Extenders are on the order from the start, so it is selected by default and has nothing to toggle.
    <section aria-label="Wi-Fi Extenders" className={`relative card-option ${CARD_SELECTED}`}>
      <SelectedTick />
      <div className="row option-row">
        <span className="option-glyph option-glyph-lg glyph-chosen">
          <Icon path={INSTALLATION_WIFI} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="title title-md font-semibold leading-snug">{included > 0 ? `${included} Free Wi-Fi ${included === 1 ? 'Extender' : 'Extenders'}` : 'Wi-Fi Extenders'}</p>
          <p className="caption-secondary">{included > 0 ? `${included} ${included === 1 ? 'Extender' : 'Extenders'} included with your plan.` : 'No Extenders are included with your plan.'}</p>
          {/* The plan's Extenders stay free for as long as the service has the plan. */}
          {included > 0 && <p className="mt-1 caption-muted">{freePeriodLabel({ lifetime: true })}</p>}
        </div>
        {included > 0 && (
          <div className="aside-value">
            <p className="title title-xl">Free</p>
          </div>
        )}
      </div>
      {/* Each Mesh extender's serial number, scanned or entered (Instant Activation: the field engineer scans them otherwise). */}
      {serials && quantity > 0 && (
        <div className="divider-top option-row-aside fields-2">
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
