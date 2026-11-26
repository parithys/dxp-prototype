import { useEffect } from 'react';
import { GuidedActivationWizard, idLookupStep } from '../../../capabilities';
import type { IdLookupValue } from '../../../components/patterns/idLookupModel';
import * as sums from '../../../components/patterns/wizard/commonSummaries';
import { attachSummaries, Button, Card, type WizardStep } from 'dxp-ui';
import { MAX_RESERVATIONS_PER_AGENT, toLocalMsisdn } from '../../../components/domain/msisdnPickerModel';
import { FREE_NUMBER_PRICE_CEILING_QAR } from '../../../engines/postpaidPricing';
import { formatQar } from '../../../lib/format';
import { notificationActions } from '../../../stores/notificationSlice';
import { useAction, useAppSelector } from '../../../stores/hooks';
import { useEntityOps, useEntityRecords } from '../../../services/entityHooks';
import { cachedEntities, entityOps } from '../../../services/entityOps';

export interface ReservedNumber {
  msisdn: string;
  customerName: string;
  idNumber: string;
}

const WIZARD_ID = 'reserve-number';

/** Why the number cannot be reserved right now, or undefined when it can. Read from the live inventory, never assumed. */

/** Why the number cannot be reserved right now, or undefined when it can. Read from the live inventory, never assumed. */
function blockedReason(
  numbers: Record<string, unknown>[] | undefined,
  msisdn: string,
  agentName: string
): string | undefined {
  if (!numbers) return undefined;
  const held = numbers.filter((n) => n.status === 'Reserved' && n.reservedBy === agentName).length;
  if (held >= MAX_RESERVATIONS_PER_AGENT) return `You already hold ${MAX_RESERVATIONS_PER_AGENT} reserved numbers. Release one before reserving another.`;
  const record = numbers.find((n) => n.msisdn === msisdn);
  if (record && record.status !== 'AVAILABLE') return `${toLocalMsisdn(msisdn)} is ${String(record.status).toLowerCase()} and cannot be reserved.`;
  return undefined;
}

function ReserveSummary({ msisdn, priceQAR, values, setValue }: { msisdn: string; priceQAR: number; values: Record<string, unknown>; setValue: (field: string, value: unknown) => void }) {
  const numbers = useEntityRecords('numbers');
  const agentName = useAppSelector((s) => s.auth.profile?.name) ?? '';
  const identity = values.identity as IdLookupValue | undefined;
  const reason = blockedReason(numbers, msisdn, agentName);
  // Kept on the values so the step's Continue gate (a pure function of them) can read it.
  useEffect(() => {
    if (values.reserveBlocked !== reason) setValue('reserveBlocked', reason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reason]);

  const star = priceQAR >= FREE_NUMBER_PRICE_CEILING_QAR;
  return (
    <div className="space-y-4">
      <Card className="p-4 card-surface space-y-2">
        <div className="spread">
          <span className="text-secondary">Number</span>
          <span className="title title-sm">{toLocalMsisdn(msisdn)}</span>
        </div>
        <div className="spread">
          <span className="text-secondary">{star ? 'Star Number price' : 'Category'}</span>
          <span className="body-text">{star ? formatQar(priceQAR) : 'Free'}</span>
        </div>
        <div className="spread">
          <span className="text-secondary">Reserved For</span>
          <span className="body-text text-right">{identity?.moiResult?.name ?? '-'}</span>
        </div>
        <div className="spread">
          <span className="text-secondary">{identity?.idType ?? 'ID'} number</span>
          <span className="body-text">{identity?.idNumber ?? '-'}</span>
        </div>
      </Card>
      {reason ? (
        <p role="alert" className="text-danger text-[length:var(--fs-body)]">{reason}</p>
      ) : (
        <p className="caption-secondary">Reserving holds this number against the customer above until it is used on an order or released.</p>
      )}
    </div>
  );
}

/**
 * Reserve Number: the number chosen in the Number Management Portal is reserved against a customer. The agent identifies the customer
 * first (the shared Customer Verification: ID type, scan, MOI), then reviews and reserves. The reservation is written to the number
 * inventory (status Reserved, held by the agent, for the identified customer's ID) only at the last step; abandoning leaves the
 * number available.
 */

/**
 * Reserve Number: the number chosen in the Number Management Portal is reserved against a customer. The agent identifies the customer
 * first (the shared Customer Verification: ID type, scan, MOI), then reviews and reserves. The reservation is written to the number
 * inventory (status Reserved, held by the agent, for the identified customer's ID) only at the last step; abandoning leaves the
 * number available.
 */
export function ReserveNumberWizard({
  msisdn,
  priceQAR,
  onReserved,
}: {
  msisdn: string;
  priceQAR: number;
  onReserved: (reserved: ReservedNumber) => void;
}) {
  const updateRecord = useEntityOps().updateRecord;
  const pushToast = useAction(notificationActions.pushToast);
  const agentName = useAppSelector((s) => s.auth.profile?.name) ?? '';

  const steps: WizardStep[] = attachSummaries(
    [
      idLookupStep({ key: 'contact', field: 'identity' }),
      {
        key: 'reserve',
        label: 'Reserve Number',
        heading: 'Reserve This Number',
        subheading: 'Check the details, then reserve the number for the customer.',
        render: ({ values, setValue }) => <ReserveSummary msisdn={msisdn} priceQAR={priceQAR} values={values} setValue={setValue} />,
        isValid: (values) => !values.reserveBlocked,
        primaryAction: ({ goNext, defaultButton, values }) => (values.reserveBlocked ? defaultButton : <Button onClick={goNext}>Reserve Number</Button>),
      },
    ],
    { contact: sums.identitySummary('identity') }
  );

  return (
    <GuidedActivationWizard
      wizardId={WIZARD_ID}
      title="Reserve Number"
      steps={steps}
      // The portal draws the title band (same band, with its own Abandon Order that confirms as a reservation, not an order), so the wizard leaves its own out.
      hideTitleBand
      onSubmit={async (values) => {
        const identity = values.identity as IdLookupValue;
        const patch = { status: 'Reserved', reservedBy: agentName, reservedForQid: identity.idNumber, reservedAt: new Date().toISOString() };
        await entityOps.loadKind('numbers');
        const existing = (cachedEntities('numbers') ?? []).find((n) => n.msisdn === msisdn);
        if (!existing) throw new Error(`${msisdn} is not in the number inventory.`);
        await updateRecord('numbers', 'msisdn', msisdn, patch);
        pushToast('success', `${toLocalMsisdn(msisdn)} reserved for ${identity.moiResult?.name ?? 'the customer'}.`);
        onReserved({ msisdn, customerName: identity.moiResult?.name ?? '-', idNumber: identity.idNumber ?? '' });
      }}
    />
  );
}
