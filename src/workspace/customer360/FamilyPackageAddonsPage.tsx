import { useEffect, useMemo, useState } from 'react';
import { AddonsSelection } from '../../capabilities';
import { SelectedAddonsHeader } from '../../components/patterns/wizard/SelectedAddonsHeader';
import { useMinWidth, EmptyState, Button, Card } from 'dxp-ui';
import { PageHeader } from '../../components/patterns/PageHeader';
import { RestrictedCustomerNotice } from '../../components/patterns/RestrictedCustomerNotice';
import { canViewCustomerSegment } from '../../engines/agentPrivilegeEngine';
import { familyOwnerLine, packageLinesOf, packagePlanId, primaryLine1Activated } from '../../engines/familyPackage';
import type { FamilyLine, FamilyOrder } from '../../engines/familyPackage';
import type { FamilyPackageAddon } from '../../engines/familyPackageAddons';
import { useNavigate, useParams, useLocation } from '../../lib/router';
import { useSubmitGuard } from '../../hooks/useSubmit';
import { notificationActions } from '../../stores/notificationSlice';
import { store } from '../../stores/store';
import { useAction, useAppSelector } from '../../stores/hooks';
import { useEntityLists, useEntityOps } from '../../services/entityHooks';
import { PRODUCTS_TAB } from './sections/c360KitModel';

const KINDS = ['family-package-lines', 'family-package-addons', 'orders', 'customers'] as const;

/** Where the agent came from (Customer 360's Family Package), carried in location state so Save and Cancel return there. */
export interface FamilyAddonsReturn {
  returnTo?: { path: string; state?: Record<string, unknown> };
}

/**
 * Customise Add-ons for a Family Package: the same Add-ons page the postpaid journey uses (the AddonsSelection capability), reached from Customer 360 > Products & Services >
 * Family Package. The add-ons belong to the package, not to a line: every line carries them. Add-ons the package already holds are ticked; Save adds the ones newly ticked, removes the ones unticked and
 * returns the agent to the page they came from. The Selected Add-Ons tray totals the choice, as on the journey's Addons page.
 */
export function FamilyPackageAddonsPage() {
  const { customerId = '' } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { returnTo } = (location.state ?? {}) as FamilyAddonsReturn;
  const { records } = useEntityLists(KINDS);
  const loadKind = useEntityOps().loadKind;
  const createRecord = useEntityOps().createRecord;
  const removeRecord = useEntityOps().removeRecord;
  const isDesktop = useMinWidth(1024);
  const pushToast = useAction(notificationActions.pushToast);
  const personaId = useAppSelector((s) => s.persona.activePersonaId);
  const { guard, pending } = useSubmitGuard('The add-ons could not be saved. Please try again.');

  useEffect(() => {
    for (const kind of KINDS) void loadKind(kind, true);
  }, [loadKind]);

  // The package as a whole (its lines can be held by different customers); the add-ons are the package's, eligible by the Family Owner.
  const lines = useMemo(() => packageLinesOf((records['family-package-lines'] ?? []) as unknown as FamilyLine[], customerId), [records, customerId]);
  const orders = (records.orders ?? []) as unknown as FamilyOrder[];
  const ownerCustomerId = familyOwnerLine(lines)?.customerId ?? customerId;
  const owner = ((records.customers ?? []) as unknown as { customerId: string; name?: string; nationality?: string; idType?: string; segment?: string }[]).find((c) => c.customerId === ownerCustomerId);
  const packageId = lines[0]?.packageId;
  const held = useMemo(() => ((records['family-package-addons'] ?? []) as unknown as FamilyPackageAddon[]).filter((a) => a.packageId === packageId), [records, packageId]);
  const heldIds = useMemo(() => held.map((h) => h.addonId), [held]);

  // The ticks start from what the package holds; the agent's own changes replace them from then on.
  const [chosen, setChosen] = useState<string[] | undefined>();
  const selected = chosen ?? heldIds;

  const back = () => navigate(returnTo?.path ?? `/customer/${customerId}`, { state: { ...(returnTo?.state ?? {}), tab: PRODUCTS_TAB } });

  if (owner && !canViewCustomerSegment(personaId, owner.segment)) {
    return (
      <div className="p-8 max-w-2xl">
        <RestrictedCustomerNotice backTo="/customer-search" backLabel="Back to Customer Search" />
      </div>
    );
  }
  if (!owner || !packageId) {
    return <EmptyState title="No Family Package" message="This customer has no Family Package to add add-ons to." />;
  }
  if (!primaryLine1Activated(lines, orders)) {
    return <EmptyState title="Family Package Not Active" message="Add-ons open once Primary Line 1 is approved." />;
  }

  const newIds = selected.filter((id) => !heldIds.includes(id));
  const removedRecords = held.filter((h) => !selected.includes(h.addonId));
  const changes = newIds.length + removedRecords.length;
  const save = () =>
    guard(async () => {
      for (const addonId of newIds) {
        await createRecord('family-package-addons', { addonRecordId: `FPA-${Date.now().toString().slice(-7)}-${addonId}`, packageId, customerId, addonId, addedAt: new Date().toISOString(), addedBy: store.getState().auth.profile?.userId });
      }
      for (const h of removedRecords) await removeRecord('family-package-addons', 'addonRecordId', h.addonRecordId);
      if (newIds.length > 0) pushToast('success', newIds.length === 1 ? 'Add-on added to the Family Package' : `${newIds.length} add-ons added to the Family Package`);
      if (removedRecords.length > 0) pushToast('success', removedRecords.length === 1 ? 'Add-on removed from the Family Package' : `${removedRecords.length} add-ons removed from the Family Package`);
      back();
    });

  const tray = (variant: 'floating' | 'header') => <SelectedAddonsHeader variant={variant} selectedIds={selected} selectedBilling={{}} onChange={setChosen} />;

  return (
    <div className="p-8 pb-28 w-full">
      <PageHeader title="Customise Add-Ons" description={<>Family Package · {owner.name ?? customerId} · {lines.length} {lines.length === 1 ? 'line' : 'lines'}</>} />
      <Card className="p-5 space-y-4">
        {/* The Selected Add-Ons tray: in the card's top-right corner on a wide screen, floating at the bottom of a small one (as on the journey's Addons page). */}
        {isDesktop && (
          <div className="sticky-corner">
            <div className="pointer-events-auto row">{tray('header')}</div>
          </div>
        )}
        <p className="caption-secondary lg:pr-[var(--size-step-header-pad-tray)]">
          Add-ons belong to the Family Package: every line carries them, and each line pays the add-on&apos;s charge. Add-ons the package already holds are ticked; tick to add, untick to remove, then Save.
        </p>
        <AddonsSelection
          kind="postpaid"
          planId={packagePlanId(lines)}
          addonIds={selected}
          onAddonsChange={setChosen}
          customerContext={{ nationality: owner.nationality, idType: owner.idType }}
        />
      </Card>
      {!isDesktop && tray('floating')}
      {/* Floating action bar, as on every journey page: always in view, however long the add-ons list is. */}
      <div className="action-bar bottom-0">
        <div className="actions-end footer-bar-pad">
          <Button variant="secondary" onClick={back}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || changes === 0}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
