import { TRASH, IconButton, Button, Badge, Modal } from 'dxp-ui';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from '../../../lib/router';
import { existingCustomerPath } from '../../../navigation/journeyPaths';
import { AddConnectionModal } from '../../../capabilities';
import { useSubmitGuard } from '../../../hooks/useSubmit';
import { notificationActions } from '../../../stores/notificationSlice';
import { useAction } from '../../../stores/hooks';

import { addonChargeForLinesQar, addonChargePerLineQar, packageAddonOptions } from '../../../engines/familyPackageAddons';
import type { FamilyAddonProduct, FamilyPackageAddon } from '../../../engines/familyPackageAddons';
import { formatQar } from '../../../lib/format';
import { canChangeFamilyOwner, connectionOptions, FAMILY_ROLES, familyOwnerChange, familyOwnerLine, lineCatalogueOf, isOrderApproved, lineLabel, packageLinesOf, packagePlanId, primaryLine1Activated } from '../../../engines/familyPackage';
import type { FamilyLine, FamilyOrder } from '../../../engines/familyPackage';
import { ActionButton, GridTable, Panel, StatusPill } from './C360Kit';
import { IC } from './c360KitModel';
import type { GridCol } from './C360Kit';
import { useCanStartNewConnection, useStartNewConnection } from '../useStartNewConnection';
import { useEntityLists, useEntityOps } from '../../../services/entityHooks';

interface PlanRow {
  productId: string;
  name: string;
  planClass?: string;
}

/**
 * Customer 360 > Products & Services > Family Package: the lines the customer holds on one Ahli (Family) plan, and the action that adds another. The rules
 * (Primary Line 1 first and approved, any type after it, every line on Primary Line 1's plan, the limits) are engines/familyPackage.ts. An empty package starts
 * the New Postpaid journey with a Family Plan (Primary Line 1); a package with lines opens Add Another Connection, which starts that journey for the type chosen.
 */

/**
 * Customer 360 > Products & Services > Family Package: the lines the customer holds on one Ahli (Family) plan, and the action that adds another. The rules
 * (Primary Line 1 first and approved, any type after it, every line on Primary Line 1's plan, the limits) are engines/familyPackage.ts. An empty package starts
 * the New Postpaid journey with a Family Plan (Primary Line 1); a package with lines opens Add Another Connection, which starts that journey for the type chosen.
 */
const FAMILY_KINDS = ['family-package-lines', 'family-package-addons', 'orders', 'products', 'customers'] as const;

export function FamilyPackagePanel({ customerId }: { customerId: string; customerName?: string }) {
  const { records } = useEntityLists(FAMILY_KINDS);
  const loadKind = useEntityOps().loadKind;
  const [addOpen, setAddOpen] = useState(false);
  const removeRecord = useEntityOps().removeRecord;
  const updateRecord = useEntityOps().updateRecord;
  const pushToast = useAction(notificationActions.pushToast);
  const { guard: guardOwnerChange, pending: changingOwner } = useSubmitGuard('The Family Owner could not be changed. Please try again.');
  // The Primary line the agent is about to make the Family Owner (confirmed in a dialog first).
  const [ownerTarget, setOwnerTarget] = useState<FamilyLine | undefined>();
  const navigate = useNavigate();
  const location = useLocation();
  // Customize Add-ons is its own page; Save and Cancel there come back to this page, on this tab.
  const customizeAddons = () => navigate(`/customer/${customerId}/family-package/add-ons`, { state: { returnTo: { path: location.pathname, state: (location.state ?? undefined) as Record<string, unknown> | undefined } } });
  const startNewConnection = useStartNewConnection(customerId);
  const canStart = useCanStartNewConnection();

  useEffect(() => {
    for (const kind of FAMILY_KINDS) void loadKind(kind, true);
  }, [loadKind]);

  const lines = useMemo(
    () => packageLinesOf((records['family-package-lines'] ?? []) as unknown as FamilyLine[], customerId).sort((a, b) => FAMILY_ROLES.indexOf(a.role) - FAMILY_ROLES.indexOf(b.role) || a.sequence - b.sequence),
    [records, customerId]
  );
  const orders = useMemo(() => (records.orders ?? []) as unknown as (FamilyOrder & { status?: string; approvalStatus?: string })[], [records.orders]);
  const products = useMemo(() => (records.products ?? []) as unknown as PlanRow[], [records.products]);
  const customers = useMemo(() => (records.customers ?? []) as unknown as { customerId: string; name?: string; nationality?: string; idType?: string }[], [records.customers]);
  const ownerLine = familyOwnerLine(lines);
  // The add-ons' eligibility is the Family Owner's: whoever holds the owner line (Primary Line 1 unless changed).
  const owner = useMemo(() => customers.find((c) => c.customerId === (ownerLine?.customerId ?? customerId)), [customers, ownerLine?.customerId, customerId]);
  const holderName = (l: FamilyLine) => customers.find((c) => c.customerId === l.customerId)?.name ?? l.customerId ?? '-';
  // Primary Line 1 and 2 can be held by different customers: the holder is shown only then.
  const holders = new Set(lines.map((l) => l.customerId));
  const packageId = lines[0]?.packageId;
  const held = useMemo(() => ((records['family-package-addons'] ?? []) as unknown as FamilyPackageAddon[]).filter((a) => a.packageId === packageId), [records, packageId]);
  const catalogue = products as unknown as FamilyAddonProduct[];
  const planName = (id: string) => products.find((p) => p.productId === id)?.name ?? id;

  const empty = lines.length === 0;
  const options = connectionOptions(lines, orders, lineCatalogueOf(products));
  const activated = primaryLine1Activated(lines, orders);
  const canChangeOwner = canStart && canChangeFamilyOwner(lines, orders);
  // Add-ons are the package's, managed here: the existing catalogue and eligibility (the package plan's, the owner's), each line paying the add-on's charge.
  const addonOptions = activated ? packageAddonOptions(catalogue, held, { planId: packagePlanId(lines), nationality: owner?.nationality, idType: owner?.idType }) : [];
  const addonById = (id: string) => catalogue.find((p) => p.productId === id);
  const addonCols: GridCol<FamilyPackageAddon>[] = [
    { key: 'name', header: 'Add-on', render: (h) => addonById(h.addonId)?.name ?? h.addonId },
    { key: 'perLine', header: 'Per Line', render: (h) => { const a = addonById(h.addonId); return a ? `${formatQar(addonChargePerLineQar(a))}/mo` : '-'; } },
    { key: 'lines', header: 'Lines', render: () => String(lines.length) },
    { key: 'total', header: 'All Lines', render: (h) => { const a = addonById(h.addonId); return a ? `${formatQar(addonChargeForLinesQar(a, lines.length))}/mo` : '-'; } },
    { key: 'remove', header: '', render: (h) => <IconButton icon={TRASH} tone="danger" label={`Remove ${addonById(h.addonId)?.name ?? 'add-on'}`} onClick={() => void removeRecord('family-package-addons', 'addonRecordId', h.addonRecordId)} /> },
  ];

  const confirmOwnerChange = () => {
    if (!ownerTarget) return;
    const changes = familyOwnerChange(lines, ownerTarget.lineId);
    if (!changes) {
      setOwnerTarget(undefined);
      return;
    }
    void guardOwnerChange(async () => {
      for (const c of changes) {
        await updateRecord('family-package-lines', 'lineId', c.lineId, { isFamilyOwner: c.isFamilyOwner }, { how: 'Family Owner changed (Customer 360 > Family Package)' });
      }
      pushToast('success', `${lineLabel(ownerTarget)} is now the Family Owner`);
      setOwnerTarget(undefined);
    });
  };

  const cols: GridCol<FamilyLine>[] = [
    {
      key: 'line',
      header: 'Line',
      // The Family Owner is Primary Line 1 until the agent changes it to Primary Line 2 (once both Primary Lines are active).
      render: (l) => (
        <span className="row">
          {lineLabel(l)}
          {ownerLine?.lineId === l.lineId && <Badge variant="tag-primary">Family Owner</Badge>}
        </span>
      ),
    },
    ...(holders.size > 1 ? [{ key: 'holder', header: 'Holder', render: (l: FamilyLine) => holderName(l) } as GridCol<FamilyLine>] : []),
    // A line on a tier's own plan is shown by the Family Plan it belongs to; the line's catalogue plan name is long and says the same thing.
    { key: 'plan', header: 'Plan', render: (l) => planName(l.tierPlanId ?? l.planId) },
    { key: 'msisdn', header: 'Number', render: (l) => l.msisdn ?? '-' },
    { key: 'order', header: 'Order', render: (l) => l.orderId },
    {
      key: 'status',
      header: 'Approval',
      render: (l) => {
        const o = orders.find((x) => x.orderId === l.orderId);
        return <StatusPill status={isOrderApproved(o) ? 'Approved' : (o?.approvalStatus ?? 'Unknown')} />;
      },
    },
    // Change Family Owner: offered on the Primary line that is not the owner, once both Primary Lines are active.
    {
      key: 'owner',
      header: '',
      render: (l) =>
        canChangeOwner && l.role === 'Primary' && ownerLine?.lineId !== l.lineId ? (
          <Button variant="tertiary" size="sm" onClick={() => setOwnerTarget(l)}>
            Make Family Owner
          </Button>
        ) : null,
    },
  ];
  const subtitle = empty
    ? 'No Family Package yet. It starts with Primary Line 1, a New Postpaid activation on an Ahli plan.'
    : activated
      ? options.length > 0
        ? `Every line is on ${planName(packagePlanId(lines) ?? '')}.`
        : `Every line is on ${planName(packagePlanId(lines) ?? '')}. No further connection types can be added.`
      : 'Primary Line 1 is awaiting approval: the other connections open once it is approved.';

  return (
    <>
      <Panel
        icon={IC.box}
        title={`Family Package (${lines.length})`}
        action={
          empty ? (
            <ActionButton primary disabled={!canStart} onClick={startNewConnection}>Start Family Package</ActionButton>
          ) : (
            <ActionButton primary disabled={options.length === 0} onClick={() => setAddOpen(true)}>Add Another Connection</ActionButton>
          )
        }
      >
        <p className="caption-secondary pb-2">{subtitle}</p>
        {lines.length > 0 && <GridTable cols={cols} rows={lines} rowKey={(l) => l.lineId} empty="" />}
        {/* The add-ons belong to the package, not to one line: every line carries them, so they sit inside the Family Package. */}
        {!empty && (
          <section aria-label="Package Add-ons" className="divider-top mt-4 pt-4 pb-2">
            <div className="row-between">
              <h4 className="title title-sm font-semibold">Package Add-ons ({held.length})</h4>
              <ActionButton primary disabled={addonOptions.length === 0} onClick={customizeAddons}>Add Add-on</ActionButton>
            </div>
            <p className="caption-secondary py-2">Add-ons belong to the Family Package and are managed here. Every line carries them, and each line pays the add-on's charge.</p>
            {held.length > 0 && <GridTable cols={addonCols} rows={held} rowKey={(h) => h.addonRecordId} empty="" />}
          </section>
        )}
      </Panel>
      <Modal
        open={ownerTarget !== undefined}
        onClose={() => setOwnerTarget(undefined)}
        title="Change Family Owner"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOwnerTarget(undefined)} disabled={changingOwner}>
              Cancel
            </Button>
            <Button disabled={changingOwner} aria-busy={changingOwner} onClick={confirmOwnerChange}>
              Make Family Owner
            </Button>
          </>
        }
      >
        {ownerTarget && (
          <p className="body-text">
            {lineLabel(ownerTarget)} ({holderName(ownerTarget)}) becomes the Family Owner. Supplementary and Secondary connections added from now on are registered with their ID
            only{ownerLine && ownerLine.customerId !== ownerTarget.customerId ? `, so ${holderName(ownerLine)} (${lineLabel(ownerLine)}) no longer needs to visit the store` : ''}.
          </p>
        )}
      </Modal>
      <AddConnectionModal open={addOpen} onClose={() => setAddOpen(false)} customerId={customerId} onStart={(familyLine) => navigate(existingCustomerPath(customerId), { state: { startFresh: true, familyLine } })} />
    </>
  );
}
