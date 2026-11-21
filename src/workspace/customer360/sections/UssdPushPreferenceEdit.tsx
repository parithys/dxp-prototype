import { useState } from 'react';
import { Button, OptionToggle, Tooltip } from 'dxp-ui';
import { Drawer } from '../../../capabilities';
import { useVerificationGate } from '../../../components/patterns/useVerificationGate';
import { canEditCustomerRecords } from '../../../engines/agentPrivilegeEngine';
import { useEntityOps } from '../../../services/entityHooks';
import { useSubmit } from '../../../hooks/useSubmit';
import { notificationActions } from '../../../stores/notificationSlice';
import { useAction, useAppSelector } from '../../../stores/hooks';

/** The two values of the preference. A line with none recorded shows "-" (unknown), and the agent chooses one. */
const USSD_PUSH_OPTIONS = [
  { key: 'Yes', label: 'Yes' },
  { key: 'No', label: 'No' },
] as const;
type UssdPushPreference = (typeof USSD_PUSH_OPTIONS)[number]['key'];

/**
 * A mobile line's USSD Push Preference on Customer 360 > Products & Services: the value, and Edit to change it (Yes / No). Saved on the line (the installed
 * asset). Like the billing edits it is for agents authorised to edit customer records (BR-02) and asks for the customer's identity to be verified first (BR-01).
 */
export function UssdPushPreferenceEdit({
  customerId,
  customerName,
  installedAssetId,
  serviceLabel,
  value,
  onSaved,
}: {
  customerId: string;
  customerName: string;
  /** The line's installed-asset id: the record the preference is saved on. */
  installedAssetId: string;
  /** Names the line in the drawer and the confirmation ("+97455513001"). */
  serviceLabel: string;
  value: string | undefined;
  onSaved: (value: UssdPushPreference) => void;
}) {
  const [open, setOpen] = useState(false);
  const canEdit = canEditCustomerRecords(useAppSelector((s) => s.persona.activePersonaId));
  const { requireVerification, gate } = useVerificationGate(customerId, customerName);
  return (
    <span className="cluster gap-2">
      <span>{value ?? '-'}</span>
      {canEdit ? (
        <Button variant="secondary" size="sm" aria-label={`Edit USSD Push Preference for ${serviceLabel}`} onClick={() => requireVerification(() => setOpen(true))}>
          Edit
        </Button>
      ) : (
        <Tooltip content="Not authorised to edit customer records" placement="top">
          <Button variant="secondary" size="sm" disabled aria-label={`Edit USSD Push Preference for ${serviceLabel}`}>
            Edit
          </Button>
        </Tooltip>
      )}
      {gate}
      {open && (
        <UssdPushPreferenceDrawer
          installedAssetId={installedAssetId}
          serviceLabel={serviceLabel}
          current={value === 'Yes' || value === 'No' ? value : undefined}
          onClose={() => setOpen(false)}
          onSaved={(v) => {
            onSaved(v);
            setOpen(false);
          }}
        />
      )}
    </span>
  );
}

function UssdPushPreferenceDrawer({
  installedAssetId,
  serviceLabel,
  current,
  onClose,
  onSaved,
}: {
  installedAssetId: string;
  serviceLabel: string;
  current: UssdPushPreference | undefined;
  onClose: () => void;
  onSaved: (value: UssdPushPreference) => void;
}) {
  const ops = useEntityOps();
  const pushToast = useAction(notificationActions.pushToast);
  const [choice, setChoice] = useState<UssdPushPreference | undefined>(current);
  const { run, pending } = useSubmit(async () => {
    if (!choice) return;
    await ops.updateRecord('installed-assets', 'installedAssetId', installedAssetId, { ussdPushPreference: choice });
    pushToast('success', `USSD Push Preference for ${serviceLabel} changed to ${choice}.`);
    onSaved(choice);
  }, 'The USSD Push Preference could not be saved. Please try again.');
  return (
    <Drawer
      open
      onClose={onClose}
      title="Edit USSD Push Preference"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending || !choice || choice === current} onClick={() => void run()}>
            {pending ? 'Saving…' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <p className="caption-muted">{serviceLabel}</p>
        <OptionToggle label="USSD Push Preference" items={[...USSD_PUSH_OPTIONS]} active={choice} onChange={setChoice} />
      </div>
    </Drawer>
  );
}
