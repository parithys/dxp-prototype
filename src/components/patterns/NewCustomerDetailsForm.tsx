import { IconButton, Button, Input, DateInput, Select, Icon, TRASH, UPLOAD_ICON, ErrorBanner } from 'dxp-ui';
import { useEffect, useRef, useState } from 'react';
import { ID_UPLOAD_ACCEPT, idFileProblem } from '../domain/idUploadModel';
import { UPLOAD_RULES } from '../domain/documentUploadRules';
import { useConfirmedRemoval } from '../domain/useConfirmedRemoval';
import { NATIONALITIES } from '../../data/nationalities';
import { idTypeDef, type IdType } from '../../data/idTypes';
import { buildNewCustomerIdentity, formatDmyOnBlur, type NewCustomerErrors, type NewCustomerInput, type NewCustomerMoi } from './idLookupModel';

const GENDER_OPTIONS = ['Male', 'Female'].map((g) => ({ value: g, label: g }));
const NATIONALITY_OPTIONS = NATIONALITIES.map((n) => ({ value: n, label: n }));

/**
 * The agent types the customer's details from the document when the reader has not given them (opened by the Contact step's
 * "Retake scan (5)"): the ID number and its expiry, names, nationality, date of birth and gender. What is typed is checked by buildNewCustomerIdentity
 * (nothing is assumed, every field but the middle name is required) and handed on as the customer's identity; the lookup then refuses a
 * person who is already a customer (createNewCustomer) and marks the identity as typed, so the order goes for manager approval.
 */
export function NewCustomerDetailsForm({
  idType,
  idNumber,
  expiry,
  onIdNumberChange,
  onExpiryChange,
  documents = [],
  onDocumentsChange,
  problem,
  onCreate,
  showUploads = true,
  locked = false,
  initial,
}: {
  /** The document the details are typed from: its number and expiry are typed here too (the scan did not give them, so there is no reader button and no Fetch). */
  idType: IdType;
  idNumber?: string;
  /** DD/MM/YYYY. */
  expiry?: string;
  onIdNumberChange: (idNumber: string) => void;
  onExpiryChange: (expiry: string) => void;
  /** The documents uploaded here, by name (no preview): any number, picked together or one after another. */
  documents?: { name: string }[];
  onDocumentsChange: (documents: { name: string }[]) => void;
  /** Why the last attempt was refused (e.g. the person is already a customer). */
  problem?: string;
  onCreate: (moi: NewCustomerMoi) => Promise<void> | void;
  /** The document upload section; off where the documents are taken only after the typed details are validated. */
  showUploads?: boolean;
  /** The details have been validated: they stay on screen as typed, read-only, and there is no further validation to run. */
  locked?: boolean;
  /** What to show when this form opens already validated (a page opened again after the validation): the validated identity's own details. */
  initial?: Partial<NewCustomerInput>;
}) {
  const blank: NewCustomerInput = { nationality: '', firstName: '', middleName: '', lastName: '', dob: '', gender: '', expiry: '' };
  const { confirmRemoval, dialog: removeDialog } = useConfirmedRemoval();
  const [input, setInput] = useState<NewCustomerInput>({ ...blank, ...initial });
  // The validation was undone (another ID type, a new number): what was typed belongs to the person before, so the form starts again.
  const wasLocked = useRef(locked);
  useEffect(() => {
    if (wasLocked.current && !locked) setInput(blank);
    wasLocked.current = locked;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);
  const [errors, setErrors] = useState<NewCustomerErrors>({});
  const [idNumberError, setIdNumberError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const idDef = idTypeDef(idType);
  const picker = useRef<HTMLInputElement>(null);
  const [uploadProblems, setUploadProblems] = useState<string[]>([]);

  // Several files at once: each is checked by the identity-upload rules (type, size); the good ones are added and the rest reported by name.
  const takeFiles = (list: FileList | null) => {
    const picked = list ? [...list] : [];
    if (picker.current) picker.current.value = '';
    if (!picked.length) return;
    const problems: string[] = [];
    const added: { name: string }[] = [];
    for (const f of picked) {
      const bad = idFileProblem(f);
      if (bad) problems.push(bad);
      else if (![...documents, ...added].some((d) => d.name === f.name)) added.push({ name: f.name });
    }
    setUploadProblems(problems);
    if (added.length) onDocumentsChange([...documents, ...added]);
  };

  // Every detail but the middle name (and the optional documents) must be in before the validation can be run.
  const complete = [idNumber, expiry, input.firstName, input.lastName, input.nationality, input.dob, input.gender].every((v) => Boolean(v?.trim()));

  const set = (patch: Partial<NewCustomerInput>) => setInput((i) => ({ ...i, ...patch }));
  const text = (key: keyof NewCustomerInput) => ({
    value: input[key],
    error: errors[key],
    onChange: (e: { target: { value: string } }) => set({ [key]: e.target.value }),
  });
  const date = (key: 'dob') => ({
    ...text(key),
    // Leaving the field tidies the date to DD/MM/YYYY (30112029 -> 30/11/2029).
    onBlur: (e: { target: { value: string } }) => set({ [key]: formatDmyOnBlur(e.target.value) }),
  });

  const submit = async () => {
    if (busy) return;
    const built = buildNewCustomerIdentity({ ...input, expiry: formatDmyOnBlur(expiry ?? '') }, NATIONALITIES);
    const missingNumber = !idNumber?.trim();
    setIdNumberError(missingNumber ? `Enter the ${idDef?.numberLabel ?? 'ID number'}.` : undefined);
    if (built.errors || missingNumber) {
      setErrors(built.errors ?? {});
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onCreate(built.moi);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Customer details" className="space-y-4">
      {removeDialog}
      <div>
        <h3 className="title title-md font-semibold">{locked ? 'Customer Details' : 'Enter Customer Details'}</h3>
        <p className="caption-muted">{locked ? 'The details entered for this customer; the details MOI validated follow below.' : 'Type the details exactly as they appear on the document. An identity entered by hand is sent for manager approval.'}</p>
      </div>
      <div className="fields-3">
        <div className="sm:col-span-2">
          <Input
            label={idDef?.numberLabel ?? 'ID Number'}
            required
            value={idNumber ?? ''}
            error={idNumberError}
            placeholder={idDef?.placeholder}
            readOnly={locked}
            inputMode={idDef?.numericNumber ? 'numeric' : 'text'}
            autoCapitalize={idDef?.numericNumber ? undefined : 'characters'}
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => {
              setIdNumberError(undefined);
              onIdNumberChange(e.target.value);
            }}
          />
        </div>
        <DateInput
          label="Expiry Date"
          required
          value={expiry ?? ''}
          error={errors.expiry}
          readOnly={locked}
          // Leaving the field tidies the date to DD/MM/YYYY (30112029 -> 30/11/2029).
          onBlur={(e) => onExpiryChange(formatDmyOnBlur(e.target.value))}
          onChange={(e) => onExpiryChange(e.target.value)}
        />
      </div>
      <div className="fields-3">
        <Input label="First Name" required readOnly={locked} {...text('firstName')} />
        <Input label="Middle Name" readOnly={locked} {...text('middleName')} />
        <Input label="Last Name" required readOnly={locked} {...text('lastName')} />
        <Select label="Nationality" required disabled={locked} options={NATIONALITY_OPTIONS} value={input.nationality} error={errors.nationality} onChange={(e) => set({ nationality: e.target.value })} />
        <DateInput label="Date of Birth" required readOnly={locked} {...date('dob')} />
        <Select label="Gender" required disabled={locked} options={GENDER_OPTIONS} value={input.gender} error={errors.gender} onChange={(e) => set({ gender: e.target.value })} />
      </div>
      {showUploads && !locked && (
      <div className="space-y-2">
        <h4 className="title title-md font-semibold">Upload Documents</h4>
        <div className="centered-stack gap-3 dropzone px-6 py-6">
          <p className="caption-secondary text-center">Upload the documents from files instead of scanning them. Select as many as you need at once.</p>
          <input ref={picker} type="file" multiple accept={ID_UPLOAD_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => takeFiles(e.target.files)} />
          <Button type="button" variant="secondary" size="sm" onClick={() => picker.current?.click()}>
            <Icon path={UPLOAD_ICON} className="size-4 " />
            Upload Documents
          </Button>
          <span className="caption-muted">{UPLOAD_RULES.identity.formatsLabel}, up to {UPLOAD_RULES.identity.maxLabel} per file</span>
          {documents.length > 0 && (
            <ul aria-label="Uploaded documents" className="stack gap-1 w-full max-w-md data-rows-ruled">
              {documents.map((d) => (
                <li key={d.name} className="split-nowrap data-row">
                  <span className="value-text truncate">{d.name}</span>
                  <IconButton icon={TRASH} tone="danger" label={`Remove ${d.name}`} onClick={() => confirmRemoval(d.name, () => onDocumentsChange(documents.filter((x) => x.name !== d.name)))} />
                </li>
              ))}
            </ul>
          )}
          {uploadProblems.map((m) => (
            <p key={m} role="alert" className="text-danger text-[length:var(--fs-caption)] text-center">
              {m}
            </p>
          ))}
        </div>
      </div>
      )}
      {!locked && problem && <ErrorBanner message={problem} />}
      {!locked && (
        <div className="actions-end">
          <Button type="button" onClick={submit} disabled={busy || !complete} aria-busy={busy}>
            Validate with MOI
          </Button>
        </div>
      )}
    </section>
  );
}
