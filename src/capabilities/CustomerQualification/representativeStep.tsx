import { ExistingConnectionsSummary } from '../EligibilityGate/ExistingConnectionsSummary';
import { existingConnectionsSummary } from '../EligibilityGate/existingConnectionsSummaryModel';
import { CustomerIdentification } from '../CustomerIdentification/CustomerIdentification';
import { StatusSlot, StatusSlotProvider, type WizardStep } from 'dxp-ui';
import { contactSummary } from './summary';
import { contactIdentificationProps } from './contactIdentity';
import { isIdTypeSupported } from '../../data/idTypes';
import { under18ApproverRole } from '../../data/under18Exception';

import { notificationActions } from '../../stores/notificationSlice';
import { requirementForCondition } from '../../engines/journeyDocuments';
import type { AdditionalDocument } from '../DocumentUpload';
import { CUSTOMER_IDENTIFICATION_LABEL } from '../../data/stepLabels';
import { hasIdentityDetails, isValidAltPhone, isValidEmail } from '../../components/patterns/guidedContactModel';
import type { GuidedContactValue } from '../../components/patterns/guidedContactModel';
import { newIdentityOf } from '../EligibilityGate/newIdentity';
import { BillingAccountAutoResolver } from '../../components/patterns/BillingAccountAutoResolver';
import type { BillingAccountValue } from '../../components/patterns/billingAccountModel';
import { EligibilityGateStep } from '../EligibilityGate/EligibilityGateStep';
import { accountTypeForJourney } from '../../engines/creditLimit';
import type { EligibilityResult } from '../../components/domain/eligibilityTypes';
import { LAUNCH_CUSTOMER_KEY } from '../../components/patterns/wizard/useJourneyStartResume';
import { CustomerStatusBanner } from './JourneyBanners';
import { EligibilityOutcomePanel, OutcomeActions } from '../EligibilityGate/EligibilityOutcomes';
import { SpecialDiscountsIdentification, isSpecialDiscountsValid } from '../SpecialDiscountsIdentification';
import type { SpecialDiscountsValue } from '../SpecialDiscountsIdentification';
import { store } from '../../stores/store';
import { under18RequestHolds } from './step';
import type { QualificationContext } from './step';
import { isRepresentativeOrder } from './representative';
import { representativeHeaderAction } from './RepresentativeToggle';

/**
 * The Contact page of the Customer Representative scenario: a DUPLICATE of customerQualificationStep (step.tsx), made so that everything specific to a representative lives
 * here and the existing Contact page is untouched. It has the same key ('contact') - so the milestones, the summary, the draft and the customer lock treat it as the Contact
 * page - and is active only while "Customer Representative" is ticked (the existing page is skipped then, see representativeContactSteps).
 *
 * `values.contact` stays the ACTUAL customer; the representative's own details are kept under `values.customerRepresentative`.
 */
export function representativeContactStep({ flow, existingCustomerId, guardedContactChange, journeyType = 'postpaid', manualEntry, productAgnostic = false, journeyChosenLater = false, knownCustomer = false, knownCustomerId, skipLineLimit = false, requestKind }: QualificationContext): WizardStep {
  const prepaid = journeyType === 'prepaid';
  return {
    key: 'contact',
    // Active only in the Customer Representative scenario; the existing Contact page takes the other case, at the same place in the journey.
    skip: (values) => !isRepresentativeOrder(values),
    summary: prepaid ? contactSummary.filter((f) => f.key !== 'customerType') : contactSummary,
    label: CUSTOMER_IDENTIFICATION_LABEL,
    // 2026-09-28: the separate 'eligibility' step is GONE - no more
    // rail entry, no more skip()/autoAdvanceWhen() dance to hide it on
    // a clean run. Eligibility now lives permanently as a stacked
    // panel at the foot of THIS step, still driven by the same
    // MOI-resolved idNumber, still evaluated the moment MOI resolves
    // (not gated on a Continue click - see the note above isValid).
    // Passing checks render nothing at all (EligibilityGateStep
    // returns null); only what needs the agent's attention appears.
    // The same "Customer Representative" checkbox as the existing page, on the heading's row: unticking it goes back to the existing Contact page.
    headerAction: representativeHeaderAction,
    // The Existing Connections Summary: a full-width banner just below the page title, on this page only (an existing customer who holds connections); it is informational and never blocks Continue.
    belowTitle: ({ values }) => {
      const summary = existingConnectionsSummary(values.eligibility as EligibilityResult | undefined);
      return summary ? <ExistingConnectionsSummary summary={summary} /> : null;
    },
    render: ({ values, setValue }) => {
      // Who the journey identifies and how: one definition, shared with the Capability Library preview (contactIdentity.ts), and the eligibility check below judges the same customer.
      const launchedFor = values[LAUNCH_CUSTOMER_KEY] as string | undefined;
      const identity = contactIdentificationProps({ flow, existingCustomerId, launchedFor, knownCustomer, knownCustomerId, journeyType, manualEntry });
      const { asNewCustomer, asCustomerId } = identity;
      const contact = values.contact as GuidedContactValue | undefined;
      const eligibility = values.eligibility as EligibilityResult | undefined;
      return (
        <StatusSlotProvider>
        {/* The step's status messages (ID verification and validation panels, scan failures) are all shown here, directly under the step title. */}
        <StatusSlot />
        {/* The customer's eligibility results come first, directly under the step title: a stop or an approval is seen before anything is filled in. Nothing is shown on a clean pass. */}
        <div className="space-y-4 mb-6 empty:hidden">
          <CustomerStatusBanner customerId={eligibility?.customerId} />
          <EligibilityOutcomePanel />
          <EligibilityGateStep
            // Linked to an existing customer through their Passport: judged as that customer, on the QID presented.
            asNewCustomer={asNewCustomer && !contact?.moiResult?.linkedIdUpdate}
            linkedIdDocument={contact?.moiResult?.linkedIdUpdate}
            asCustomerId={asCustomerId}
            announcePass={false}
            announceConnectionLimits
            // A customer created here (no registry knows the ID) is judged on what the agent entered.
            newIdentity={newIdentityOf(contact)}
            // A journey that has not chosen its product yet cannot judge the line count: the mobile limit would end a Fixed Line sale. Product Selection judges it.
            skipLineLimit={skipLineLimit || productAgnostic}
            // MNP does not know its connection type until Plan Type: the approvals that depend on it (the ID type's, the line-count and
            // passport BAU ones - a prepaid line needs none of the ID-type approval) are announced there, for the plan type chosen.
            // A stop is still shown here, because it blocks Continue.
            showRow={(row) =>
              // The upfront payment (HRN) and the ID type's Credit Control approval (a Passport on a postpaid line) depend on the journey, which a
              // product-agnostic Customer Verification has not chosen yet (neither applies to Prepaid): the product stage announces them.
              !(productAgnostic && (row.id === 'hrn' || row.id === 'id-type-routing')) &&
              (values.product !== 'mnp' || !((row.id === 'active-lines' || row.id === 'id-type-routing') && row.tone === 'approval-routing'))
            }
            requestKind={requestKind}
            journeyType={journeyType}
            // A journey started as New Prepaid has product = prepaid in its draft before Customer Verification judges the customer: the under-18 exception is Prepaid's.
            exceptionJourney={values.product === 'prepaid' ? 'prepaid' : undefined}
            // The agent submitted an Exception Request from the footer: the journey goes on, with the age check routed for approval instead of stopped.
            exceptionRequested={under18RequestHolds(values)}
            // The customer's full set of checks, as the single-product journeys always showed them at Customer Verification: ID type
            // approval, the active-line limit, collections and the rest. (Prepaid and MNP judge a few of them differently once the product
            // is chosen; Product Selection re-judges those.)
            scope="product"
            // The journey is not known yet: the ID type's approval depends on it, so it is judged at the product stage, not here.
            deferIdTypeRouting={journeyChosenLater}
            // Only once MOI has validated the ID (after Fetch) - an unfetched or
            // OCR-misread number must not be run through eligibility.
            idNumber={contact?.moiResult ? contact.idNumber : undefined}
            // Feeding the previous result back in is what makes this a
            // one-time check across re-entries to the step.
            result={eligibility}
            onResult={(r) => setValue('eligibility', r)}
            // No in-panel buttons here: the footer's primary action
            // carries the outcome (see primaryAction below).
          />
        </div>
        <CustomerIdentification
          // The props Customer Verification takes in this journey: shared with the Capability Library preview (contactIdentity.ts).
          {...identity}
          // No "Others" card on this page: an unsupported document type never identifies a customer.
          allowedIdTypes={identity.allowedIdTypes.filter((t) => t !== 'Other ID')}
          // Customer Representative: the ID is captured by the reader (Initiate scan) or by Upload document, whichever the agent has.
          bothCaptureActions
          value={(values.contact as GuidedContactValue) ?? {}}
          onChange={(v) => guardedContactChange(v, setValue)}
        />
        {/* Customer Type used to be its own step; it now follows the
            eligibility panel here, once identity is fetched and
            eligibility has cleared (no hard/soft stop). Same container
            as the eligibility panel so there is a single divider. */}
        {!prepaid && contact?.moiResult && eligibility && !eligibility.hardStop && (productAgnostic || !eligibility.softStop) && (
          <div className="mt-6 pt-6 divider-top space-y-4">
            {/* Headless: stands in for the skipped Billing Profile page. */}
            {/* Product-agnostic identification leaves the billing account to the product stage (not every product has one). */}
            {!productAgnostic && (
              <BillingAccountAutoResolver
                customerId={eligibility.customerId}
                customerName={contact.moiResult.name}
                accountType={accountTypeForJourney('postpaid')}
                value={(values.billingAccount as BillingAccountValue) ?? {}}
                onChange={(v) => setValue('billingAccount', v)}
              />
            )}
            {/* Special Discounts do not apply to the Under-18 Exception flow. */}
            {!under18RequestHolds(values) && (
            <SpecialDiscountsIdentification
              value={(values.customerType as SpecialDiscountsValue) ?? {}}
              onChange={(v) => {
                // A different Special Discount type (or Standard) retires the discount chosen under the previous one: the plan step offers the new
                // type's discount (and selects it once validated), so nothing from the old choice reaches Checkout or the order.
                const before = values.customerType as SpecialDiscountsValue | undefined;
                if (before && (before.type !== v.type || Boolean(before.rejected) !== Boolean(v.rejected))) setValue('discountId', undefined);
                setValue('customerType', v);
              }}
              derivedCompany={
                contact.isB2B2C
                  ? { companyName: contact.companyName, companyAccountId: contact.companyAccountId, companyIsNew: contact.companyIsNew }
                  : undefined
              }
            />
            )}
          </div>
        )}
        </StatusSlotProvider>
      );
    },
    // Continue is the MOI-driven gate, unchanged in kind (2026-09-28):
    // it was always contingent on MOI resolving; it now ALSO requires
    // eligibility to have resolved and cleared. "Cleared" excludes a
    // hard stop (no path exists), a soft stop (Switch to Prepaid is
    // the only path, and that button leaves this wizard rather than
    // calling Continue), and approval-routing (Proceed to Approval is
    // the only path - see onProceedToApproval above). Advisory-only
    // (HRN with no other issue) is NOT excluded: it never sets
    // hardStop/softStop and contributes no 'approval-routing' check,
    // so Continue stays available exactly as a clean pass would.
    // Saved as a draft only once MOI has validated the customer and nothing hard-stops the order.
    canSaveDraft: (values) => {
      const e = values.eligibility as EligibilityResult | undefined;
      return Boolean((values.contact as GuidedContactValue | undefined)?.moiResult) && Boolean(e) && !e!.hardStop;
    },
    isValid: (values) => {
      const c = values.contact as GuidedContactValue | undefined;
      const e = values.eligibility as EligibilityResult | undefined;
      const identityOk = Boolean(
        c?.moiResult && hasIdentityDetails(c ?? {}) && isValidEmail(c?.email) && (!c?.workEmail || isValidEmail(c.workEmail)) && (!c?.altPhone || isValidAltPhone(c.altPhone)) && (!c?.personalMobile || isValidAltPhone(c.personalMobile))
      );
      if (!identityOk || !e) return false;
      // An unsupported document type ("Others") never identifies a customer: no way on until a supported type is chosen.
      if (!isIdTypeSupported(c?.idType)) return false;
      // A soft stop (a postpaid collections block) belongs to the product chosen later, not to identification.
      if (e.hardStop || (!productAgnostic && e.softStop)) return false;
      // An approval-routing outcome no longer blocks Continue: the journey
      // goes on and the order is held for approval when it is SUBMITTED
      // (see pendingApproval at submit).
      return prepaid || under18RequestHolds(values) || isSpecialDiscountsValid(values.customerType as SpecialDiscountsValue | undefined);
    },
    // "Add a text link on the left side. On click, open a popup
    // showing all eligibility checks performed and their results"
    // (2026-09-28) - the inline panel above goes silent the moment
    // every check clears, so this is the only way back to the full
    // seven-check report once that happens. Renders nothing until
    // eligibility has actually run (EligibilityChecksLink's own
    // guard on `eligibility` being set).
    // Hard stop -> Abandon Order; soft stop -> Proceed to Payment /
    // Continue Prepaid; approval routing -> Request Approval (the same
    // forward path Continue would take, unguarded by isValid, with the
    // order held for approval on submit); advisory / clean -> Continue.
    primaryAction: ({ values, setValue, defaultButton }) => (
      <OutcomeActions
        // With the product not chosen yet, a collections soft stop is not an end of the road (prepaid is still offered): Continue goes on to
        // Product Selection rather than offering the Postpaid-only "Proceed to Payment".
        eligibility={productAgnostic && (values.eligibility as EligibilityResult | undefined)?.softStop ? { ...(values.eligibility as EligibilityResult), softStop: false } : (values.eligibility as EligibilityResult | undefined)}
        defaultButton={defaultButton}
        // An applicant under 18 may Apply for Exception: the Court Type Order is attached (under the document the journey's rules name, so the
        // CAF's Additional Documents shows it as already attached) and the request recorded. The journey then continues and the order is held for
        // the agent's manager (see submit). The age check itself is not lifted.
        exception={{
          requirement: requirementForCondition('minor-applicant'),
          approverRole: under18ApproverRole(store.getState().persona.activePersonaId),
          onSubmit: (document) => {
            const caf = (values.caf as { additionalDocuments?: AdditionalDocument[] } | undefined) ?? {};
            const kept = (caf.additionalDocuments ?? []).filter((d) => d.requirementId !== document.requirementId);
            setValue('caf', { ...caf, additionalDocuments: [...kept, document] });
            // Special Discounts do not apply to this flow: nothing chosen earlier carries into the order.
            setValue('customerType', { type: 'none' }); // Standard: Continue is not held for a discount that is not offered
            setValue('discountId', undefined);
            setValue('under18Request', { submittedAt: new Date().toISOString(), documentId: document.id, idNumber: (values.contact as GuidedContactValue | undefined)?.idNumber });
            store.dispatch(notificationActions.pushToast('success', 'Exception request submitted for approval.', { detail: `The order will be held for ${under18ApproverRole(store.getState().persona.activePersonaId)} approval.` }));
          },
        }}
      />
    ),
  };
}
