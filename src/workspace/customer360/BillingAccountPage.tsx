import { useEffect, useState } from 'react';
import { EmptyState, Badge, Button, Input, DateInput, Select, Icon, Tooltip, CHEVRON_LEFT } from 'dxp-ui';
import { useCustomerCreditBreakdown } from './useCreditLimitBreakdown';
import { RestrictedCustomerNotice } from '../../components/patterns/RestrictedCustomerNotice';
import { canViewCustomerSegment } from '../../engines/agentPrivilegeEngine';
import { useParams, useNavigate, Link } from '../../lib/router';

import { notificationActions } from '../../stores/notificationSlice';
import { canEditCustomerRecords } from '../../engines/agentPrivilegeEngine';
import { useVerificationGate } from '../../components/patterns/useVerificationGate';
import { Drawer } from '../../capabilities';
import { SupportingDocumentField } from '../../components/domain/SupportingDocumentField';
import type { AdditionalDocument } from '../../components/domain/AdditionalDocumentsUpload';
import { requirementForCondition } from '../../engines/journeyDocuments';
import { BILL_TYPES, isValidVatExpiry } from '../../components/patterns/billingAccountModel';
import { PageHeader } from '../../components/patterns/PageHeader';
import { useSubmitGuard } from '../../hooks/useSubmit';
import { EntityMissing } from '../../components/patterns/EntityMissing';
import { formatAmountAny } from '../../lib/format';
import { useAction, useAppSelector } from '../../stores/hooks';
import { useEntityOps } from '../../services/entityHooks';
import { listEntities } from '../../services/entityOps';

interface BillingProfile {
  billingProfileId: string;
  accountId: string;
  name: string;
  billingCycle: string;
  billingType: string;
  /** How detailed the bill is (Detailed / Summary); set when the account is created, changed here. Absent on older records: unknown, not defaulted. */
  billType?: string;
  /** Optional VAT details, entered when the account was created (Mobile Postpaid Activation) and maintained here. */
  /** null once cleared: the change is journalled as JSON, where an absent key would not undo the stored value. */
  vatRegistrationNumber?: string | null;
  vatExpiryDate?: string | null;
  /** The VAT document that goes with the number (its file name and requirement): mandatory whenever a number is held. */
  vatDocument?: AdditionalDocument | null;
  billingAddress: string;
  billMedium: string;
  autoPayStatus: string;
  paymentMethod: string;
  billingLanguage: string;
  /** Set only while the profile is in collections ('In Collections'); absent otherwise. */
  collectionStatus?: string;
  creditLimitQAR: number;
  billingContactName?: string;
  billingContactPhone?: string;
  billingContactEmail?: string;
}

// BR-02: mirrors the disabled+Tooltip pattern already established in
// Customer360Layout.tsx's "Edit profile" button and InvoiceActions.tsx's
// "Restricted" state - a non-agent persona must never be able to open an
// edit drawer, not even a read-only one, since this page has no read-only
// drawer variant (the cards already show the data as read-only).
function EditButton({ canEdit, onClick }: { canEdit: boolean; onClick: () => void }) {
  if (!canEdit) {
    return (
      <Tooltip content="Not authorised to edit billing records" placement="top">
        <Button variant="secondary" size="sm" className="opacity-40 cursor-not-allowed" onClick={(e) => e.preventDefault()}>
          Edit
        </Button>
      </Tooltip>
    );
  }
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      Edit
    </Button>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="caption-muted">{label}</div>
      <div className="body-text">{value ?? '-'}</div>
    </div>
  );
}

// One editable item inside a grouped card: its fields on the left, its Edit on the right, a rule above every item but the first.
function EditableField({ canEdit, onEdit, first, children }: { canEdit: boolean; onEdit: () => void; first?: boolean; children: React.ReactNode }) {
  return (
    <div className={`row-between items-start ${first ? '' : 'divider-top mt-3 pt-3'}`}>
      <div className="min-w-0 flex-1">{children}</div>
      <EditButton canEdit={canEdit} onClick={onEdit} />
    </div>
  );
}

// CUS-001-BAM-01: a genuine navigation target distinct from the Customer 360
// Billing tab, reachable from the Account Hierarchy view's Billing Account
// node. CUS-001-BAM-02/03: view billing profile + billing contact.
// CUS-001-BAM-04/05/06/07: edit billing contact/address/language/payment
// mode, gated behind BR-01 verification and BR-02 role check.
export function BillingAccountPage() {
  const { billingProfileId } = useParams<{ billingProfileId: string }>();
  const navigate = useNavigate();
  const updateRecord = useEntityOps().updateRecord;
  const pushToast = useAction(notificationActions.pushToast);
  const { guard } = useSubmitGuard();
  const activePersonaId = useAppSelector((s) => s.persona.activePersonaId);
  const canEdit = canEditCustomerRecords(activePersonaId);

  const [profile, setProfile] = useState<BillingProfile | null | undefined>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('this customer');
  // The account belongs to a protected-segment customer this role may not see: nothing of the account is kept or drawn, only the restriction.
  const [blocked, setBlocked] = useState(false);
  const limits = useCustomerCreditBreakdown(customerId || undefined);
  const [editField, setEditField] = useState<'contact' | 'address' | 'language' | 'billType' | 'vat' | 'payment' | null>(null);

  const { requireVerification, gate } = useVerificationGate(customerId, customerName);

  // A new load (another account, a retry, another persona) starts from a clean slate: adjusted during render, not in the effect.
  const loadKey = `${billingProfileId ?? ''}|${reloadKey}|${activePersonaId ?? ''}`;
  const [startedKey, setStartedKey] = useState(loadKey);
  if (startedKey !== loadKey) {
    setStartedKey(loadKey);
    if (billingProfileId) {
      setLoadFailed(false);
      setBlocked(false);
      setProfile(null);
    }
  }

  useEffect(() => {
    if (!billingProfileId) return;
    (async () => {
      const profiles = await listEntities<BillingProfile>('billing-profiles');
      const found = profiles.find((p) => p.billingProfileId === billingProfileId);
      if (!found) {
        setProfile(undefined);
        return;
      }
      const accounts = await listEntities<{ accountId: string; customerId: string }>('accounts');
      const account = accounts.find((a) => a.accountId === found.accountId);
      if (account) {
        const customers = await listEntities<{ customerId: string; name: string; segment?: string }>('customers');
        const customer = customers.find((c) => c.customerId === account.customerId);
        // Authorisation BEFORE the account is kept: a protected customer's account never reaches the page.
        if (customer && !canViewCustomerSegment(activePersonaId, customer.segment)) {
          setBlocked(true);
          return;
        }
        setCustomerId(account.customerId);
        if (customer) setCustomerName(customer.name);
      }
      setProfile(found);
    })().catch((err) => {
      console.error('[BillingAccountPage] load failed:', err);
      setLoadFailed(true);
    });
  }, [billingProfileId, reloadKey, activePersonaId]);

  if (blocked) {
    return (
      <div className="p-8 max-w-2xl">
        <RestrictedCustomerNotice backTo="/customer-search" backLabel="Back to Customer Search" />
      </div>
    );
  }
  if (loadFailed) {
    return <EntityMissing what="billing account" loading={false} error onRetry={() => setReloadKey((k) => k + 1)} backTo="/customer-search" backLabel="Back to Customer Search" />;
  }
  if (profile === null) return <div className="p-8 text-fg-2" role="status">Loading billing account…</div>;
  if (profile === undefined) {
    return (
      <EmptyState title="Billing Account Not Found" message={<>No billing account found for “{billingProfileId}”.</>} />
    );
  }

  // BR-02: only reachable via EditButton, which itself only wires onClick to
  // this function when canEdit is true - non-agents never get a click
  // handler that could call openEdit at all.
  const openEdit = (field: typeof editField) => {
    requireVerification(() => setEditField(field));
  };

  // BR-05: billing-profile maintenance requires the customer/billing-account
  // context to already be confirmed - satisfied structurally here, since
  // this drawer only ever opens against the profile this page already
  // resolved and displayed (there's no path to editing an unselected
  // account). BR-04's ticket-on-change applies to demographic/contact/
  // address changes specifically, not billing-profile edits, so this saves
  // directly with a confirmation toast rather than a ticket.
  const save = (patch: Partial<BillingProfile>, kind: string) =>
    guard(async () => {
    await updateRecord('billing-profiles', 'billingProfileId', profile.billingProfileId, patch);
    pushToast('success', `${kind} updated for billing account ${profile.billingProfileId}.`);
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
    setEditField(null);
    });

  return (
    <div className="p-8 w-full">
      <PageHeader
        title={<>{profile.name}</>}
        badges={<Badge variant="filled-neutral">{profile.billingProfileId}</Badge>}
        description={<>
          {customerName} · {customerId} ·{' '}
          <Link to={`/customer/${customerId}`} className="link">
            View Customer 360
          </Link>
        </>}
      />

      {customerId ? (
        <Link to={`/customer/${customerId}`} className="back-link-quiet mb-4">
          <Icon path={CHEVRON_LEFT} className="size-3.5 " />
          Back to Customer 360
        </Link>
      ) : (
        <button type="button" onClick={() => navigate(-1)} className="back-link-quiet mb-4">
          <Icon path={CHEVRON_LEFT} className="size-3.5 " />
          Back to Customer 360
        </button>
      )}

      {/* Three groups: how the bill is produced, who and where it goes to, and how it is paid (with the credit limit it is held against). Each editable item keeps its own Edit. */}
      <div className="two-up">
        <section className="card p-5">
          <h3 className="caption-heading mb-3">Bill Preferences</h3>
          <div className="fields-2">
            <Field label="Billing Cycle" value={profile.billingCycle} />
            <Field label="Billing Mode" value={profile.billingType} />
            <Field label="Bill Medium" value={profile.billMedium} />
          </div>
          <EditableField canEdit={canEdit} onEdit={() => openEdit('billType')}>
            <Field label="Bill Type" value={profile.billType} />
          </EditableField>
          <EditableField canEdit={canEdit} onEdit={() => openEdit('language')}>
            <Field label="Billing Language" value={profile.billingLanguage} />
          </EditableField>
          <EditableField canEdit={canEdit} onEdit={() => openEdit('vat')}>
            <div className="fields-2">
              <Field label="VAT Registration Number" value={profile.vatRegistrationNumber} />
              <Field label="VAT Expiry Date" value={profile.vatExpiryDate} />
            </div>
          </EditableField>
        </section>

        <section className="card p-5">
          <h3 className="caption-heading mb-3">Contact &amp; Address</h3>
          <EditableField first canEdit={canEdit} onEdit={() => openEdit('contact')}>
            <div className="fields-sm">
              <Field label="Billing Contact" value={profile.billingContactName} />
              <Field label="Phone" value={profile.billingContactPhone} />
              <Field label="Email" value={profile.billingContactEmail} />
            </div>
          </EditableField>
          <EditableField canEdit={canEdit} onEdit={() => openEdit('address')}>
            <Field label="Billing Address" value={profile.billingAddress} />
          </EditableField>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h3 className="caption-heading mb-3">Payment &amp; Credit</h3>
          <EditableField first canEdit={canEdit} onEdit={() => openEdit('payment')}>
            <div className="fields-2">
              <Field label="Payment Method" value={profile.paymentMethod} />
              <Field label="AutoPay Status" value={profile.autoPayStatus} />
            </div>
          </EditableField>
          {/* The credit limit: the figure first, then what it is made of - the default, any Credit Control change and a deposit increase - with the overall as the total. */}
          <div className="divider-top mt-3 pt-3 space-y-3">
            <div>
              <div className="caption-muted">Credit Limit</div>
              <div className="title title-xl">{`${formatAmountAny(limits?.overall ?? profile.creditLimitQAR)} QAR`}</div>
            </div>
            <dl className="summary-panel">
              <div className="split">
                <dt>Default</dt>
                <dd>{limits ? `${formatAmountAny(limits.default)} QAR` : '-'}</dd>
              </div>
              <div className="split">
                <dt>Credit Control Team</dt>
                <dd>{limits ? (limits.creditControl === null ? '-' : `${formatAmountAny(limits.creditControl)} QAR`) : '-'}</dd>
              </div>
              <div className="split">
                <dt>Increased Due to Deposit</dt>
                <dd>{limits ? (limits.depositIncrease ? `${formatAmountAny(limits.depositIncrease)} QAR` : '-') : '-'}</dd>
              </div>
              <div className="split summary-total">
                <dt>Overall</dt>
                <dd>{limits?.overall !== undefined ? `${formatAmountAny(limits.overall)} QAR` : '-'}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      {gate}

      {editField === 'contact' && (
        <ContactEditDrawer profile={profile} onClose={() => setEditField(null)} onSave={(p) => save(p, 'Billing Contact')} />
      )}
      {editField === 'address' && (
        <AddressEditDrawer profile={profile} onClose={() => setEditField(null)} onSave={(p) => save(p, 'Billing Address')} />
      )}
      {editField === 'language' && (
        <LanguageEditDrawer profile={profile} onClose={() => setEditField(null)} onSave={(p) => save(p, 'Billing Language')} />
      )}
      {editField === 'billType' && (
        <BillTypeEditDrawer profile={profile} onClose={() => setEditField(null)} onSave={(p) => save(p, 'Bill Type')} />
      )}
      {editField === 'vat' && (
        <VatEditDrawer profile={profile} onClose={() => setEditField(null)} onSave={(p) => save(p, 'VAT Details')} />
      )}
      {editField === 'payment' && (
        <PaymentEditDrawer profile={profile} onClose={() => setEditField(null)} onSave={(p) => save(p, 'Payment Mode')} />
      )}
    </div>
  );
}

function ContactEditDrawer({ profile, onClose, onSave }: { profile: BillingProfile; onClose: () => void; onSave: (patch: Partial<BillingProfile>) => void }) {
  const [name, setName] = useState(profile.billingContactName ?? '');
  const [phone, setPhone] = useState(profile.billingContactPhone ?? '');
  const [email, setEmail] = useState(profile.billingContactEmail ?? '');
  return (
    <Drawer
      open
      onClose={onClose}
      title="Edit Billing Contact"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ billingContactName: name, billingContactPhone: phone, billingContactEmail: email })}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
    </Drawer>
  );
}

function AddressEditDrawer({ profile, onClose, onSave }: { profile: BillingProfile; onClose: () => void; onSave: (patch: Partial<BillingProfile>) => void }) {
  const [address, setAddress] = useState(profile.billingAddress);
  return (
    <Drawer
      open
      onClose={onClose}
      title="Edit Billing Address"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!address.trim()} onClick={() => onSave({ billingAddress: address })}>
            Save Changes
          </Button>
        </>
      }
    >
      <Input label="Billing Address" value={address} onChange={(e) => setAddress(e.target.value)} />
    </Drawer>
  );
}

function LanguageEditDrawer({ profile, onClose, onSave }: { profile: BillingProfile; onClose: () => void; onSave: (patch: Partial<BillingProfile>) => void }) {
  const [language, setLanguage] = useState(profile.billingLanguage);
  return (
    <Drawer
      open
      onClose={onClose}
      title="Edit Billing Language"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ billingLanguage: language })}>Save Changes</Button>
        </>
      }
    >
      <Select
        label="Billing Language"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        options={[
          { value: 'English', label: 'English' },
          { value: 'Arabic', label: 'Arabic' },
        ]}
      />
    </Drawer>
  );
}

// Bill Type is chosen when the account is created (Mobile Postpaid Activation never changes it); this is where an existing account's is changed.
function BillTypeEditDrawer({ profile, onClose, onSave }: { profile: BillingProfile; onClose: () => void; onSave: (patch: Partial<BillingProfile>) => void }) {
  const [billType, setBillType] = useState(profile.billType ?? '');
  return (
    <Drawer
      open
      onClose={onClose}
      title="Edit Bill Type"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!billType || billType === profile.billType} onClick={() => onSave({ billType })}>Save Changes</Button>
        </>
      }
    >
      <Select label="Bill Type" value={billType} onChange={(e) => setBillType(e.target.value)} options={BILL_TYPES} />
    </Drawer>
  );
}

// VAT is optional and belongs to the account, not to a journey: Mobile Postpaid Activation sets it only when it creates the account, and this is where it is changed.
// Emptying the number clears the expiry and the document with it; an expiry is DD/MM/YYYY and needs a number to go with it; a number makes the VAT document mandatory.
function VatEditDrawer({ profile, onClose, onSave }: { profile: BillingProfile; onClose: () => void; onSave: (patch: Partial<BillingProfile>) => void }) {
  const [number, setNumber] = useState(profile.vatRegistrationNumber ?? '');
  const [expiry, setExpiry] = useState(profile.vatExpiryDate ?? '');
  const [document, setDocument] = useState<AdditionalDocument | undefined>(profile.vatDocument ?? undefined);
  const hasNumber = Boolean(number.trim());
  const expiryError = !isValidVatExpiry(expiry) ? 'Enter the date as DD/MM/YYYY.' : expiry.trim() && !hasNumber ? 'Enter the VAT Registration Number first.' : undefined;
  const missingDocument = hasNumber && !document;
  const unchanged =
    number.trim() === (profile.vatRegistrationNumber ?? '') &&
    (hasNumber ? expiry.trim() : '') === (profile.vatExpiryDate ?? '') &&
    (hasNumber ? document?.id : undefined) === (profile.vatDocument?.id ?? undefined);
  return (
    <Drawer
      open
      onClose={onClose}
      title="Edit VAT Details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={Boolean(expiryError) || missingDocument || unchanged}
            onClick={() => onSave({ vatRegistrationNumber: hasNumber ? number.trim() : null, vatExpiryDate: hasNumber && expiry.trim() ? expiry.trim() : null, vatDocument: hasNumber ? (document ?? null) : null })}
          >
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="VAT Registration Number" value={number} onChange={(e) => setNumber(e.target.value)} helperText={hasNumber ? 'VAT document upload is required.' : undefined} />
        <DateInput label="VAT Expiry Date" value={expiry} onChange={(e) => setExpiry(e.target.value)} error={expiryError} />
        {/* Always shown and marked required, as in Mobile Postpaid Activation; Save is held for it once a number is entered. */}
        <SupportingDocumentField label="VAT Document" requirement={requirementForCondition('vat-registration')} document={document} onChange={setDocument} />
      </div>
    </Drawer>
  );
}

function PaymentEditDrawer({ profile, onClose, onSave }: { profile: BillingProfile; onClose: () => void; onSave: (patch: Partial<BillingProfile>) => void }) {
  const [paymentMethod, setPaymentMethod] = useState(profile.paymentMethod);
  return (
    <Drawer
      open
      onClose={onClose}
      title="Edit Payment Mode"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({ paymentMethod, autoPayStatus: paymentMethod === 'AutoPay' ? 'Enrolled' : 'Not Enrolled' })}
          >
            Save Changes
          </Button>
        </>
      }
    >
      <Select
        label="Payment Method"
        value={paymentMethod}
        onChange={(e) => setPaymentMethod(e.target.value)}
        options={[
          { value: 'Invoice', label: 'Invoice' },
          { value: 'AutoPay', label: 'AutoPay' },
        ]}
      />
    </Drawer>
  );
}
