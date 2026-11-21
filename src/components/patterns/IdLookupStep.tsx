import { useEffect, useRef } from 'react';
import { formatDateTime } from '../../lib/format';
import { QidNumberField, QidTypeSelector } from '../domain/QidInput';
import type { QidType } from '../domain/QidInput';
import { IdScannerPanel } from './IdScannerPanel';
import { Badge, DateInput } from 'dxp-ui';
import { GCC_ID_NOT_APPLICABLE_LABEL, gccIdNotApplicableMessage, isUnrecognisedGccId } from '../../data/gccCitizenship';
import { NewCustomerDetailsForm } from './NewCustomerDetailsForm';
import { UNSUPPORTED_ID_TYPE_TITLE, unsupportedIdTypeDetail } from '../../data/idTypes';
import { useIdLookup } from './useIdLookup';
import { IdLookupStatus } from './IdLookupStatus';
import { MoiResultPanel } from './MoiResultPanel';
import { RestrictedCustomerNotice } from './RestrictedCustomerNotice';
import { idVerificationIssue } from './idReconciliation';
import { ValidationStatus } from './ValidationStatus';
import type { IdLookupValue } from './idLookupModel';
import { DEMO_TYPED_DETAILS, detailsOf, formatDmyOnBlur, TYPED_DETAILS_ID_TYPES } from './idLookupModel';
import { SHOW_DEMO_CONTENT } from '../../data/synthetic/syntheticMarker';


interface IdLookupStepProps {
  /** Leaves out the "MOI validated at ..." line under Identity Details (the Customer Representative page does not show it). */
  hideMoiNote?: boolean;
  /** With showMoiDetails off, the caller places the "MOI validated" badge itself (see GuidedContactStep) instead of it appearing by the ID field. */
  hideMoiBadge?: boolean;
  value?: IdLookupValue;
  onChange: (value: IdLookupValue) => void;
  /**
   * Render the Name/DOB/Nationality read-out inside the MOI panel. Default
   * true, which is what the six other journeys using this step rely on.
   *
   * GuidedContactStep passes false: as of 2026-09-24 it renders those three
   * as editable, prefilled fields of its own, so showing them read-only here
   * as well would put the same data on screen twice with only one copy
   * editable. The "MOI Validated" badge still renders either way - the fetch
   * succeeding is a separate fact from where the data is displayed.
   */
  showMoiDetails?: boolean;
  /**
   * Which ID types this journey offers. Defaults to all four; New Postpaid
   * narrows it to QID and Diplomatic ID. See QidTypeSelector.allowedTypes.
   */
  allowedIdTypes?: QidType[];
  /** Shown greyed and unselectable, with `unavailableIdTypesHint` beneath. */
  unavailableIdTypes?: QidType[];
  unavailableIdTypesHint?: string;
  /**
   * Scan-first with AUTOMATIC document-type detection (2026-09-28 direction).
   *
   * OPT-IN, and off by default on purpose. Only New Postpaid passes it. The
   * other eight journeys sharing this step offer all four ID types and never
   * narrow them, so hiding their selector behind a spent scan budget would
   * leave an agent who needs Passport or GCC ID unable to reach it without
   * first failing two scans they never wanted to run.
   *
   * When on:
   *   - the type selector is hidden until the fallback opens
   *   - the scan identifies the document rather than trusting a prior choice
   *   - the attempt budget is two rather than four
   */
  autoDetectIdType?: boolean;
  /**
   * Typed entry from the start, for a device with a keyboard (the web build of a journey that is otherwise
   * scanner-led): the ID number field is open as soon as a type is chosen and the scanner follows it as the
   * alternative. Off, a QID is read by the scanner and typing opens only after the scan budget is spent.
   */
  manualEntry?: boolean;
  /** Offer to create a new customer when no registry knows the ID (QID, Passport, Diplomatic ID). Default true; a journey bound to a customer never offers it. */
  allowNewCustomer?: boolean;
  /** Creates the customer in the backend once an identity the agent typed has been validated with MOI (the Customer Identification capability supplies it). */
  persistNewCustomer?: (identity: IdLookupValue) => Promise<void>;
  /** What typing the ID by hand means in the journey (its own rule, e.g. needing approval), said under the scanner once the scan attempts are used up. Absent: not said. */
  manualEntryNotice?: string;
  /** Opens the typed-details section (the "Retake scan (5)" form) as soon as an ID type is chosen. */
  typedDetails?: boolean;
  /** Offers Upload document beside Initiate scan in the scanner section. */
  bothCaptureActions?: boolean;
  /**
   * Scan -> verify -> Fetch (2026-09-30), OPT-IN for the same reason as
   * autoDetectIdType. What the agent does depends on the pass over the reader
   * (see CaptureMode): the first scan and Retake 1 read the number and expiry
   * and call MOI by themselves; Retake 2 reads the number and the agent types
   * the expiry; Retake 3 onwards fills the number from the barcode button and
   * the agent types the expiry. Where the agent types, they press Fetch. Once
   * MOI has answered, the number and expiry are shown (read-only) with the
   * validated identity rather than as fields of their own.
   */
  verifyThenFetch?: boolean;
  /**
   * Whoever this ID belongs to is handled as a genuine NEW customer (New
   * Connection - New Customer): identity from NAS where NAS has it, the
   * Siebel customerId/employer/phone are NOT carried, and the email is the
   * NAS one (masked by the Contact step).
   */
  asNewCustomer?: boolean;
  /** Identify someone other than the customer on screen (see useIdLookup). */
  unbound?: boolean;
  /** Demo reader: present this customer's own document and card (see useIdLookup). */
  scanAsCustomerId?: string;
  /**
   * Prototype rule (journey started from Customer 360): the customer is the one
   * the journey was opened for, whatever number the scan returned - the demo
   * scanner returns the same QID every time. Identity is taken from this record.
   */
  asCustomerId?: string;
}

// Pattern 2: Customer/Contact Lookup Step (QID/Kahramaa ID Scan + MOI Validation) -
// the ID Type selector, number field, and Fetch action stay on screen at all
// times; the MOI result renders directly beneath them once resolved, rather
// than replacing the input entirely. Editing the number after a result exists
// clears that result immediately - a fetched result stays pinned to the exact
// value it came from, never left showing stale demographic data for a field
// the agent has since changed. Switching ID Type clears the result AND the
// number, since a number entered under one scheme is never valid under
// another. The returned
// name/DOB/nationality are still read-only display per the Retail Sales
// restriction carried over from the 66-persona model's PERSONA-001 ("cannot
// manually enter ID details, only re-scan/search") - only the lookup ID
// number itself is directly editable.
export function IdLookupStep({ value = {}, onChange, showMoiDetails = true, allowedIdTypes, unavailableIdTypes, unavailableIdTypesHint, autoDetectIdType = false, manualEntry = false, allowNewCustomer = true, persistNewCustomer, verifyThenFetch = false, asNewCustomer = false, asCustomerId, unbound = false, scanAsCustomerId, hideMoiBadge = false, hideMoiNote = false, manualEntryNotice, typedDetails = false, bothCaptureActions = false }: IdLookupStepProps) {
  const {
    loading,
    notFound,
    setNotFound,
    accessRestricted,
    linkProblem,
    reconciliation,
    clearReconciliation,
    numberInputRef,
    latest,
    idType,
    typeChosen,
    demoType,
    effectiveScannable,
    unsupportedType,
    unsupportedScanTried,
    handleIdTypeChange,
    contextIdentity,
    contextNoDocument,
    ownerMismatch,
    contextHeldTypes,
    failure,
    retrying,
    duplicates,
    expiredNotice,
    runMoiValidation,
    scanComplete,
    verifyOnDemand,
    verifyRequested,
    startVerification: startVerificationOfScan,
    verifyReady,
    scanBudgetSpent,
    manualEntryUnlocked,
    captureMode,
    handleScanAttempt,
    handleRetakeDone,
    handleDemoScan,
    handleBarcodeScan,
    handleKeyDown,
    canEnterDetails,
    createNewCustomer,
    retryValidation,
  } = useIdLookup({ value, onChange, allowedIdTypes, autoDetectIdType, verifyThenFetch, asNewCustomer, asCustomerId, unbound, scanAsCustomerId, manualEntry, typedDetails, allowNewCustomer, persistNewCustomer });

  // Built once and placed by ID type below. Only the showMoiDetails={false}
  // shape gets a loose badge at all - the other journeys keep theirs inside
  // the bordered panel it heads, where it introduces the identity read-out.
  const verificationIssue = idVerificationIssue({ linkProblem, notFound, reconciliation, ownerMismatch });

  const moiBadge =
    !showMoiDetails && !hideMoiBadge && value.moiResult ? (
      <Badge variant="success-solid">
        {/* verifyThenFetch: one line, the time folded into the badge. */}
        {verifyThenFetch && value.moiResult.moiUpdateTime
          ? `MOI validated successfully at ${formatDateTime(value.moiResult.moiUpdateTime)}`
          : 'MOI validated successfully'}
      </Badge>
    ) : undefined;

  // "MOI Update Time" (2026-09-28) - see MoiResult.moiUpdateTime's own note
  // for the evidenced field name. toLocaleString() rather than a hand-rolled
  // formatter, matching how this app already renders absolute timestamps
  // elsewhere (TaskDetailView.tsx, BulkNotesSection.tsx).
  const moiUpdateTimeText = value.moiResult?.moiUpdateTime
    ? `MOI Update Time: ${formatDateTime(value.moiResult.moiUpdateTime)}`
    : undefined;

  // The scanner, shown only for a Qatar ID. The other three document
  // types are single-sided in this corpus (a passport is scanned at its
  // photo page, GCC/Diplomatic IDs have no evidenced reverse capture),
  // so offering a two-face capture for them would invent a step. Reuses
  // the same QidImageUpload the Passport-to-QID and SIM Swap journeys
  // already gate on, rather than a second scanner with its own shape.
  //
  // NOTHING HERE EXPOSES THE SIMULATION. The counter ("Scan attempts:
  // n / 4") and the "Simulate scan failure" button that used to sit
  // under this card are both gone as of 2026-09-25. They were debug
  // affordances: the counter published the exact budget the agent was
  // told not to be shown, and the button described the app to itself.
  // The budget now shows up the only way it should - as a scan that
  // fails - and the failure message says what the agent can do about it
  // without mentioning attempts.
  // The typed-details section carries its own ID number and expiry (no barcode button, no Fetch, no hint), so the number row is not drawn beside it.
  const detailsOpen = canEnterDetails && !value.moiResult;
  // Typed details from the start: once MOI has validated them they stay on screen, as typed and read-only, above the validated identity.
  // DEMO: choosing an ID type fills the typed details in (once per choice: a field the agent clears is not filled again).
  const demoDetails = SHOW_DEMO_CONTENT && typedDetails && typeChosen ? DEMO_TYPED_DETAILS[idType] : undefined;
  const prefilledFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!demoDetails || !detailsOpen || value.moiResult || prefilledFor.current === idType) return;
    prefilledFor.current = idType;
    onChange({ ...value, idNumber: demoDetails.idNumber, scannedExpiry: demoDetails.expiry, moiResult: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idType, demoDetails, detailsOpen]);
  const detailsLocked = typedDetails && Boolean(value.moiResult) && typeChosen && allowNewCustomer && !asCustomerId && TYPED_DETAILS_ID_TYPES.includes(idType);
  // A Passport's own "Validate with MOI" (read the scanned passport) is not offered while the typed-details section, which has its own, is open.
  const startVerification = detailsOpen ? undefined : startVerificationOfScan;

  // verifyThenFetch: what the agent may change depends on how the capture came in - see CaptureMode.
  const numberLocked = captureMode === 'ocr-auto' || captureMode === 'ocr-number';
  const expiryLocked = captureMode === 'ocr-auto';

  // Keyed by the document type: choosing another type is a new document in the reader, so the scanner's own count (the "Retake scan (n)" label)
  // starts again with the lookup's attempt count, and the two never drift apart.
  // Typed details from the start: no scan beside them; the document is taken by the page itself after the validated details (see the Contact page that sets it).
  const scannerBlock = effectiveScannable && !typedDetails && (
    <IdScannerPanel
      key={idType}
      value={value}
      onChange={onChange}
      latest={latest}
      idType={idType}
      verifyThenFetch={Boolean(verifyThenFetch)}
      autoDetectIdType={Boolean(autoDetectIdType)}
      contextNoDocument={contextNoDocument}
      contextHeldTypes={contextHeldTypes}
      contextIdentity={contextIdentity}
      scanComplete={scanComplete}
      setNotFound={setNotFound}
      clearReconciliation={clearReconciliation}
      demoType={demoType}
      handleScanAttempt={handleScanAttempt}
      handleRetakeDone={handleRetakeDone}
      handleDemoScan={handleDemoScan}
      scanBudgetSpent={scanBudgetSpent}
      bothCaptureActions={bothCaptureActions}
      manualEntryNotice={manualEntryNotice}
      onVerify={verifyOnDemand ? startVerification : undefined}
      verifyDisabled={!verifyReady}
      verifying={(verifyRequested || loading) && !value.moiResult && !notFound && !reconciliation && !linkProblem && !ownerMismatch}
    />
  );

  // FALLBACK ONLY as of 2026-09-28 for the scan-first flow. Automatic
  // detection is the primary path there: the reader identifies the
  // document, so asking the agent to classify it first was asking a
  // question the scanner answers. For the eight journeys that still lead
  // with a type selector (autoDetectIdType false), this is unconditional
  // and unchanged - those journeys have no detector to defer to, so the
  // selector remains the first thing the agent does, not a fallback.
  // `manualEntryUnlocked` is latched - see fallbackUnlocked.
  const selectorBlock = (!autoDetectIdType || manualEntryUnlocked) && (
    <QidTypeSelector
      idType={typeChosen ? idType : undefined}
      onIdTypeChange={handleIdTypeChange}
      allowedTypes={allowedIdTypes}
      unavailableTypes={unavailableIdTypes}
      unavailableHint={unavailableIdTypesHint}
    />
  );

  // An upload and the barcode passes show the fields empty, for the agent to fill: no number is read off the card for them.
  const typedCapture = captureMode === 'upload' || captureMode === 'barcode';
  // verifyThenFetch: once MOI has answered, the number and expiry live in the validated data, so they are not repeated as fields.
  // A clear read (first scan, Retake 1) goes straight to MOI, so its number and expiry are never shown as fields - not while MOI is being
  // called either, or they would flash up and vanish. They appear only if the lookup comes back with a problem the agent must see.
  const autoLookupClean = captureMode === 'ocr-auto' && !notFound && !reconciliation && !linkProblem && !ownerMismatch;
  const numberBlock = typeChosen && !unsupportedType && !(verifyThenFetch && (value.moiResult || autoLookupClean)) && (!effectiveScannable || (scanComplete && Boolean(value.idNumber)) || manualEntryUnlocked || typedCapture) && (
    <QidNumberField
      idType={idType}
      inputRef={numberInputRef}
      barcodeNumber={idType === 'QID' ? contextIdentity?.idNo : undefined}
      onBarcodeScan={captureMode === 'barcode' ? handleBarcodeScan : undefined}
      value={value.idNumber ?? ''}
      onChange={(idNumber: string) => {
        setNotFound(false);
        clearReconciliation();
        onChange({ ...value, idNumber, moiResult: undefined });
      }}
      onFetch={runMoiValidation}
      fetching={loading}
      // The message is the error panel below (idVerificationIssue); the field keeps its red border.
      invalid={Boolean(verificationIssue)}
      inlineField={
        verifyThenFetch && effectiveScannable && (scanComplete || manualEntryUnlocked) ? (
          <DateInput
            label="Expiry Date"
            // Fetch stays disabled until it is filled (fetchDisabled below), so it is mandatory.
            required
            value={value.scannedExpiry ?? ''}
            // Locked while the reader supplied it (the OCR passes); typed for an upload, the barcode pass and after.
            readOnly={expiryLocked}
            // Leaving the field tidies the date to DD/MM/YYYY (30112029 -> 30/11/2029).
            onBlur={(e) => {
              const tidy = formatDmyOnBlur(e.target.value);
              if (tidy !== e.target.value) onChange({ ...value, scannedExpiry: tidy, moiResult: undefined });
            }}
            onChange={(e) => {
              clearReconciliation();
              onChange({ ...value, scannedExpiry: e.target.value, moiResult: undefined });
            }}
          />
        ) : undefined
      }
      readOnly={verifyThenFetch ? numberLocked : effectiveScannable && scanComplete}
      // Also disabled once the fetch has succeeded (moiResult set). Editing
      // the number or expiry clears moiResult, which re-enables it.
      fetchDisabled={Boolean(value.moiResult) || (verifyThenFetch && !value.scannedExpiry)}
      // verifyThenFetch: the scanned values are locked, Fetch stays available.
      showFetch={verifyThenFetch}
      hideFetch={verifyOnDemand}
      // The scanned path has no Fetch button, so it also lost the
      // "Fetching…" label that button carried - and the MOI lookup this
      // step fires automatically takes two mock calls at 200-600ms each.
      // Without this line the number simply appears and the screen sits
      // still for up to a second before the MOI badge shows up, which
      // reads as nothing happening. The hint is the only thing left in
      // that state that can say otherwise.
      hint={
        effectiveScannable && scanComplete
          ? loading
            ? 'Checking the MOI registry…'
            : value.moiResult
              ? undefined // validated: the "verify, then Fetch" prompt has been acted on
              : verifyOnDemand && captureMode === 'barcode'
                ? 'Enter the passport number and expiry date from the document, then select Validate with MOI.'
                : captureMode === 'upload'
                ? 'Enter the ID number and expiry date from the document, then select Fetch.'
                : captureMode === 'barcode'
                  ? 'Select the barcode icon to scan the ID number, enter the expiry date from the document, then select Fetch.'
                  : captureMode === 'ocr-number'
                    ? 'ID number read from the scanned document. Enter the expiry date from the document, then select Fetch.'
                    : 'Read from the scanned document.'
          : undefined
      }
      // The MOI badge, right-aligned on this field's label row - the
      // "Qatar ID (QID) Number" line, or "Passport Number" and so on for
      // the other types.
      //
      // One placement for all four ID types, which is why there is no
      // per-type routing here any more. It briefly sat on the scanner
      // card's "Qatar ID" header instead, but that card only exists for a
      // QID, so the other three needed a second home and the badge had
      // two possible parents.
      //
      // Safe to live inside the field: moiResult cannot outlive it.
      // Setting it requires an idNumber, and everything that hides the
      // field again - Retake, an ID Type switch - clears moiResult in the
      // same update.
      status={moiBadge}
      statusDetail={verifyThenFetch ? undefined : moiUpdateTimeText}
    />
  );
  const numberRow = detailsOpen ? null : numberBlock;

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      {/* Scan-first flow (2026-09-28): the scanner leads, and the type
          selector - now purely a fallback - follows it, since it is
          something the scanner's own failure hands off to rather than a
          question asked ahead of it. The eight selector-led journeys keep
          their original order: selector first, since they have no
          detector for the scanner to lead with. */}
      {autoDetectIdType ? (
        <>
          {scannerBlock}
          {selectorBlock}
        </>
      ) : manualEntry ? (
        // Typed entry first (a keyboard device): selector, the number field, then the scanner as the alternative.
        <>
          {selectorBlock}
          {numberRow}
          {scannerBlock}
        </>
      ) : (
        <>
          {selectorBlock}
          {scannerBlock}
        </>
      )}

      {/* "Others" (and any unsupported type): the scan is refused, with this message, and the journey cannot go on until a supported type is chosen. */}
      {unsupportedType && unsupportedScanTried && (
        <ValidationStatus variant="business-failure" title={UNSUPPORTED_ID_TYPE_TITLE}>
          {unsupportedIdTypeDetail(idType)}
        </ValidationStatus>
      )}

      {/* The number field comes AFTER the scanner and only once there is a
          number to show. Scanning is the primary path, so leading with an
          empty, locked text box asked the agent to read past the thing they
          cannot use to reach the thing they can.

          Three states:
          - non-QID: no scanner exists for these documents, so the field is
            the only way in and is always editable, with Fetch.
          - QID, scan complete AND a number extracted: shown read-only, no
            Fetch - the scan already triggered the lookup.
          - QID, scan budget exhausted: the manual fallback opens, editable
            and empty, and Fetch returns with it. Nothing announces the
            threshold - see the note above.

          The `idNumber` half of the second condition matters: a completed
          scan and an extracted number are NOT simultaneous. Reading the
          number is its own mock call, so for up to 600ms after the capture
          there is a scan but no digits - and rendering then put an EMPTY
          read-only box on screen under the hint "Read from the scanned
          document.", which is a claim about a value that had not arrived.
          Waiting for the number means the field appears already populated.

          Before any of those, for a QID, it is not rendered at all. */}
      {(autoDetectIdType || !manualEntry) && numberRow}

      {/* The fifth retake: the agent types the customer's details from the document (what the reader could not give). */}
      {(detailsOpen || detailsLocked) && (
        <NewCustomerDetailsForm
          key={idType}
          locked={detailsLocked}
          initial={detailsLocked ? detailsOf(value) : demoDetails ? { ...demoDetails.input, expiry: demoDetails.expiry } : undefined}
          idType={idType}
          idNumber={value.idNumber}
          expiry={value.scannedExpiry}
          onIdNumberChange={(idNumber) => {
            setNotFound(false);
            clearReconciliation();
            onChange({ ...value, idNumber, moiResult: undefined });
          }}
          onExpiryChange={(scannedExpiry) => {
            clearReconciliation();
            onChange({ ...value, scannedExpiry, moiResult: undefined });
          }}
          documents={value.qidScans?.documents}
          onDocumentsChange={(documents) => onChange({ ...value, qidScans: { ...(value.qidScans ?? {}), documents: documents.length ? documents : undefined } })}
          // Typed details from the start: the documents are taken only once what was typed has been validated by MOI.
          showUploads={!typedDetails}
          problem={linkProblem}
          onCreate={createNewCustomer}
        />
      )}

      {/* No registry knows this ID: the status below says so ("No MOI record found for this ID - try again."). No create-customer form is offered. */}

      {/* A protected-segment customer this role may not see: the access restriction is all that is shown (it blocks Continue: nothing is identified). */}
      {accessRestricted && <RestrictedCustomerNotice compact />}

      {/* ---- Validation status. Each state looks different (see ValidationStatus):
          technical failure = amber and unresolved, business result = red, pending
          = neutral, success = green. A technical failure never reads as "not found". */}
      <IdLookupStatus
        loading={loading}
        failure={failure}
        retrying={retrying}
        expiredNotice={expiredNotice}
        duplicates={duplicates}
        hasMoiResult={Boolean(value.moiResult)}
        runMoiValidation={retryValidation}
      />

      {/* Every ID verification error is an error panel naming the specific issue (a business failure: the system answered and the answer is no). */}
      {verificationIssue && (
        <ValidationStatus variant="business-failure" title={verificationIssue.title}>
          {verificationIssue.detail}
        </ValidationStatus>
      )}
      {/* The ID was chosen as a GCC ID but the record's nationality is outside the six GCC states: the ID does not apply to this customer. */}
      {isUnrecognisedGccId(value.idType, value.moiResult?.nationality) && (
        <ValidationStatus variant="business-failure" title={GCC_ID_NOT_APPLICABLE_LABEL}>
          {gccIdNotApplicableMessage(value.moiResult?.nationality)}
        </ValidationStatus>
      )}

      {value.moiResult && showMoiDetails && (
        <MoiResultPanel
          moiResult={value.moiResult}
          idType={value.idType}
          idNumber={verifyThenFetch ? value.idNumber : undefined}
          hideDocumentType={verifyThenFetch}
          statusText={hideMoiNote ? undefined : value.moiResult.moiUpdateTime ? `MOI validated at ${formatDateTime(value.moiResult.moiUpdateTime)}` : 'MOI validated'}
        />
      )}
    </div>
  );
}
