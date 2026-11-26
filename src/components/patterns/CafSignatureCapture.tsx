import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Checkbox, Icon, OptionToggle, PEN_ICON, PRINT_ICON, SignatureCapture } from 'dxp-ui';
import { SelectedTick } from '../primitives/offerCardParts';
import { CafDocumentUpload } from '../domain/CafDocumentUpload';
import type { CafDocument } from '../domain/CafDocumentUpload';
import { AdditionalDocumentsUpload } from '../domain/AdditionalDocumentsUpload';
import type { AdditionalDocument } from '../domain/AdditionalDocumentsUpload';
import type { DocumentRequirement, JourneyDocument } from '../../engines/journeyDocuments';
import { composeSignedCafImage } from '../../lib/signedCafImage';
import type { TncLegalFacts } from './checkoutSummaryModel';
import { buildTncBullets } from './cafTermsModel';
import type { TncBulletTemplate } from './cafTermsModel';
import { FullTerms } from './CafTerms';
import { CAF_TYPES, detectCafType } from './cafTypes';
import type { CafType } from './cafTypes';
import { listEntities } from '../../services/entityOps';
import { useCafLanguage } from './cafLanguageContext';
import { SECONDARY_CONTACT_TERMS } from '../../data/secondaryContactTerms';
import { CafPaperPanel } from './CafPaperPanel';
import { mandatoryDocumentLabels, paperCopiesOf } from '../../engines/journeyDocuments';
import { CARD_IDLE, CARD_SELECTED } from '../primitives/offerCardParts';
import type { PaperCafCopy } from './CafPaperPanel';
import { printFullTerms } from './cafPrint';

interface CafSignatureCaptureProps {
  value: {
    cafType?: CafType;
    signatureDataUrl?: string;
    /** Full variant: the signed form as one image (key terms, agreements, signature, who signed), for Journey Documents. */
    /** Full variant: the signed form as one image (key terms, agreements, signature, who signed), for Journey Documents. */
    signedCafDataUrl?: string;
    /** The customer has ticked "I have read and agree to the full Terms and Conditions." */
    /** The customer has ticked "I have read and agree to the full Terms and Conditions." */
    termsAccepted?: boolean;
    /** With a Supplementary Form: the primary customer has read it and agrees (the one signature then covers both forms). */
    /** With a Supplementary Form: the primary customer has read it and agrees (the one signature then covers both forms). */
    supplementaryAgreed?: boolean;
    /** Full variant: the customer agrees to marketing communications and special offers (Campaigns). Ticked unless the agent unticks it. */
    /** Full variant: the customer agrees to marketing communications and special offers (Campaigns). Ticked unless the agent unticks it. */
    marketingConsent?: boolean;
    /** With a Supplementary Form: the secondary contact has read it and agrees, and signs it on its own (the Supplementary Form only). */
    /** With a Supplementary Form: the secondary contact has read it and agrees, and signs it on its own (the Supplementary Form only). */
    secondaryAgreed?: boolean;
    secondarySignatureDataUrl?: string;
    /** Signed on paper: the signed Primary CAF, and - with a Secondary Contact - the signed Supplementary CAF, scanned or uploaded back. Both present = the CAF is signed (type Manual). */
    paperPrimary?: PaperCafCopy | PaperCafCopy[];
    paperSecondary?: PaperCafCopy | PaperCafCopy[];
    documents?: CafDocument[];
    /** Post-signature supporting documents - see AdditionalDocumentsUpload. */
    /** Post-signature supporting documents - see AdditionalDocumentsUpload. */
    additionalDocuments?: AdditionalDocument[];
    /** Reported by the form once signed: a document type is chosen with no file yet, or a required document is missing. The step holds Continue (its footer's) while this is true. */
    /** Reported by the form once signed: a document type is chosen with no file yet, or a required document is missing. The step holds Continue (its footer's) while this is true. */
    documentsBlocked?: boolean;
    /** The language the customer read and signed in (English unless they chose Arabic on the signing screen). */
    termsLanguage?: 'en' | 'ar';
  };
  onChange: (value: CafSignatureCaptureProps['value']) => void;
  customerName?: string;
  /** Binds an ID Number line onto the CAF preview - module-hierarchy.json's
   * "CAF form dynamically binds Qatari ID/Passport number field for prepaid
   * subscribers." Omit for flows where this binding isn't evidenced. */
  /** Binds an ID Number line onto the CAF preview - module-hierarchy.json's
   * "CAF form dynamically binds Qatari ID/Passport number field for prepaid
   * subscribers." Omit for flows where this binding isn't evidenced. */
  idLabel?: string;
  idValue?: string;
  /**
   * Customer-facing order summary, rendered under the signature block
   * (2026-09-27 walkthrough). The agent reads this to the customer BEFORE
   * they sign, so it is the same set of facts Checkout showed - passed in
   * already derived, so the two surfaces cannot disagree about what was sold.
   * Omitted by the other five journeys that share this component, which
   * render the CAF without a commercial summary exactly as before.
   */
  /**
   * Customer-facing order summary, rendered under the signature block
   * (2026-09-27 walkthrough). The agent reads this to the customer BEFORE
   * they sign, so it is the same set of facts Checkout showed - passed in
   * already derived, so the two surfaces cannot disagree about what was sold.
   * Omitted by the other five journeys that share this component, which
   * render the CAF without a commercial summary exactly as before.
   */
  orderSummary?: { label: string; value: string; labelAr?: string; valueAr?: string }[];
  /**
   * New Connection layout: no Key Information panel and no order read-back here (Checkout shows the order); the page is
   * the full Terms & Conditions followed by the application form and signature.
   */
  /**
   * New Connection layout: no Key Information panel and no order read-back here (Checkout shows the order); the page is
   * the full Terms & Conditions followed by the application form and signature.
   */
  fullTerms?: boolean;
  /** Open the signature pad inline, under the Please Sign button, instead of in a drawer. */
  /** Open the signature pad inline, under the Please Sign button, instead of in a drawer. */
  inlineSignaturePad?: boolean;
  /** Post-signature document labels as a list of values instead of free text. */
  /** Post-signature document labels as a list of values instead of free text. */
  documentLabelOptions?: string[];
  /** The mandatory document types for this order (a product a type is not for does not carry it). Absent: every configured mandatory type. */
  documentMandatoryLabels?: string[];
  /**
   * Which journey's application form this is (postpaid by default). Prepaid carries its own form title and its own
   * Terms & Conditions (Mobile Prepaid BRSD MPRA_001_CAF_02 / CAF_03); the signature, agreement and documents
   * behaviour is the same capability for both.
   */
  /**
   * Which journey's application form this is (postpaid by default). Prepaid carries its own form title and its own
   * Terms & Conditions (Mobile Prepaid BRSD MPRA_001_CAF_02 / CAF_03); the signature, agreement and documents
   * behaviour is the same capability for both.
   */
  journey?: 'postpaid' | 'prepaid';
  /** A Customer Representative signs for the actual customer (`customerName`): the form keeps its layout, the signer, the heading and the terms wording change. */
  authorizedRepresentative?: { name: string };
  /** Extra rows on the application form (the prepaid form's mobile numbers and SIM serials, for example), as label/value. */
  /** Extra rows on the application form (the prepaid form's mobile numbers and SIM serials, for example), as label/value. */
  formDetails?: { label: string; value: string }[];
  /** The journey's own Terms & Conditions sections, in place of the shared catalogue's (New Prepaid). They are also what the signed CAF image carries. */
  /** The journey's own Terms & Conditions sections, in place of the shared catalogue's (New Prepaid). They are also what the signed CAF image carries. */
  termsSections?: readonly { sectionId: string; title: string; body: string }[];
  /** An "iPAY Activation" Yes / No choice above the form (New Prepaid), editable until the CAF is signed. */
  /** An "iPAY Activation" Yes / No choice above the form (New Prepaid), editable until the CAF is signed. */
  ipayActivation?: { value: boolean; onChange: (value: boolean) => void };
  /** The iPAY Terms & Conditions: shown, after the iPAY Activation toggle, only while iPAY is Yes (with the full terms on the page; see FullTerms). */
  /** The iPAY Terms & Conditions: shown, after the iPAY Activation toggle, only while iPAY is Yes (with the full terms on the page; see FullTerms). */
  ipayTermsSections?: readonly { sectionId: string; title: string; body: string }[];
  /**
   * The Supplementary Form, when the line has an actual user other than the applicant: its rows (the actual user's details). The ONE signature
   * below then signs both forms - the CAF by the applicant and the Supplementary Form by the applicant and the actual user - and says so.
   */
  /**
   * The Supplementary Form, when the line has an actual user other than the applicant: its rows (the actual user's details). The ONE signature
   * below then signs both forms - the CAF by the applicant and the Supplementary Form by the applicant and the actual user - and says so.
   */
  supplementaryForm?: { rows: { label: string; value: string }[]; /** The secondary contact, who signs the Supplementary Form on their own. */ actualUserName?: string };
  /** Cap on post-signature documents (default 10). */
  /** Cap on post-signature documents (default 10). */
  maxAdditionalDocuments?: number;
  /** Documents this order requires (its scenario, the role): asked for in Additional Documents, after signing, and nowhere earlier. */
  /** Documents this order requires (its scenario, the role): asked for in Additional Documents, after signing, and nowhere earlier. */
  documentRequirements?: DocumentRequirement[];
  /** Everything the journey already holds, listed in Additional Documents to view and download. */
  /** Everything the journey already holds, listed in Additional Documents to view and download. */
  journeyDocuments?: JourneyDocument[];
  /** Link target for "the complete terms", shown beneath the summary. */
  /** Link target for "the complete terms", shown beneath the summary. */
  termsUrl?: string;
  /**
   * Opt-in (2026-09-28, Postpaid only). When true:
   *  - the manual CAF-Type picker is replaced by detectCafType()'s real
   *    device-capability check, set once and never re-offered to the agent;
   *  - CAF-Touch Screen requires the SAME in-app signature CAF-Digital does
   *    (under the original three-way design only Digital did - Touch Screen
   *    meant signing on a separate off-screen terminal - but that no longer
   *    fits once a device check, not an agent, is choosing between them: both
   *    detectable outcomes now mean "sign on THIS screen", just with a
   *    finger instead of a mouse);
   *  - the legacy "Signed documents" upload (CafDocumentUpload) is dropped,
   *    since there is no more off-screen-signed paper to scan back once
   *    signing always happens in-app;
   *  - a concise, dynamic T&C bullet summary (tnc-summary-bullets.json +
   *    legalFacts) renders ahead of the commercial orderSummary, with a
   *    "View Full Terms & Conditions" link as the stated fallback;
   *  - the CAF preview stays on screen once signed (2026-09-28 "preview of
   *    the signed CAF"), and an AdditionalDocumentsUpload appears alongside
   *    it for whatever else needs attaching afterward - no signature
   *    required for any of those.
   * The other five journeys sharing this component (MNP, Passport-to-QID,
   * etc.) omit this prop and keep the original picker-led behaviour exactly
   * as it was.
   */
  /**
   * Opt-in (2026-09-28, Postpaid only). When true:
   *  - the manual CAF-Type picker is replaced by detectCafType()'s real
   *    device-capability check, set once and never re-offered to the agent;
   *  - CAF-Touch Screen requires the SAME in-app signature CAF-Digital does
   *    (under the original three-way design only Digital did - Touch Screen
   *    meant signing on a separate off-screen terminal - but that no longer
   *    fits once a device check, not an agent, is choosing between them: both
   *    detectable outcomes now mean "sign on THIS screen", just with a
   *    finger instead of a mouse);
   *  - the legacy "Signed documents" upload (CafDocumentUpload) is dropped,
   *    since there is no more off-screen-signed paper to scan back once
   *    signing always happens in-app;
   *  - a concise, dynamic T&C bullet summary (tnc-summary-bullets.json +
   *    legalFacts) renders ahead of the commercial orderSummary, with a
   *    "View Full Terms & Conditions" link as the stated fallback;
   *  - the CAF preview stays on screen once signed (2026-09-28 "preview of
   *    the signed CAF"), and an AdditionalDocumentsUpload appears alongside
   *    it for whatever else needs attaching afterward - no signature
   *    required for any of those.
   * The other five journeys sharing this component (MNP, Passport-to-QID,
   * etc.) omit this prop and keep the original picker-led behaviour exactly
   * as it was.
   */
  autoDetectDeviceType?: boolean;
  /** Raw order figures for the dynamic T&C bullets - see TncLegalFacts. */
  /** Raw order figures for the dynamic T&C bullets - see TncLegalFacts. */
  legalFacts?: TncLegalFacts;
  /** Save the draft, confirm with a toast and go to the dashboard (customer-facing action row). */
  /** Save the draft, confirm with a toast and go to the dashboard (customer-facing action row). */
  onSave?: () => void;
  /** Show the "I have read and agree" checkbox and keep Please Sign disabled until it is ticked. */
  /** Show the "I have read and agree" checkbox and keep Please Sign disabled until it is ticked. */
  requireTermsAgreement?: boolean;
  /** See FullTerms: 'page' lets the terms grow to full height so only the page scrolls. Defaults to the scrolling panel. */

  /** Key statements shown as the first lines of Key Terms & Conditions (full terms only). */
  /** Key statements shown as the first lines of Key Terms & Conditions (full terms only). */
  keyInformation?: React.ReactNode[];
}

// Pattern 6: CAF/Contract Signature Capture - CAF Type card selector (Digital/
// Manual/Touch Screen, styled like the ID Type picker), bilingual (EN / AR: the business's own documents)
// document preview pre-populated from
// applicant/billing/plan data, then a "Please Sign" pad modal (drawn signature,
// Clear/Done) - reused identically for CAF, MNP application, Passport-to-QID
// forms (SCR-058, SCR-069/070, SCR-084, SCR-127/129, etc.).

export function CafSignatureCapture({
  value,
  onChange,
  customerName,
  idLabel,
  idValue,
  orderSummary,
  fullTerms = false,
  inlineSignaturePad = false,
  documentLabelOptions,
  documentMandatoryLabels,
  maxAdditionalDocuments,
  documentRequirements,
  journeyDocuments,
  journey = 'postpaid',
  authorizedRepresentative,
  formDetails,
  termsSections,
  keyInformation,
  ipayActivation,
  ipayTermsSections,
  supplementaryForm,
  termsUrl,
  autoDetectDeviceType,
  legalFacts,
  onSave,
  requireTermsAgreement = false,
}: CafSignatureCaptureProps) {
  // Who signs, and for whom: the Authorised Representative signs on behalf of the actual customer; otherwise the customer signs for themself.
  const signerName = authorizedRepresentative?.name ?? customerName;
  const { lang, t, content } = useCafLanguage();
  const termsHolder = authorizedRepresentative ? t('authorisedRepresentative') : t('primaryContact');
  const actualCustomer = customerName ?? t('theActualCustomer');
  // The statement an authorised representative agrees to: the business's wording in the language, with the two names filled in.
  const onBehalfOf = authorizedRepresentative ? t('onBehalfStatement').replace('{representative}', authorizedRepresentative.name).replace('{customer}', actualCustomer) : undefined;
  // The latest value: an asynchronous write (a document read, the signed form drawn) must build on what the journey holds now, not on the render that started it.
  const valueRef = useRef(value);
  valueRef.current = value;
  // A document type is chosen but its file is not uploaded yet: Continue waits.
  const [documentPending, setDocumentPendingState] = useState(false);
  // How the customer signs (full variant): digitally on this screen (the default) or on paper (print, sign, upload the signed copies).
  const [signMode, setSignMode] = useState<'digital' | 'paper'>('digital');
  // The Secondary Contact signs the Supplementary Form the same two ways, chosen on its own card.
  const [secondaryMode, setSecondaryMode] = useState<'digital' | 'paper'>('digital');
  // A required document is not uploaded yet: Continue waits for it too.
  const [missingRequired, setMissingRequired] = useState(0);
  const setDocumentPending = setDocumentPendingState;
  const documentsBlock = documentPending || missingRequired > 0;
  // The wizard's footer owns Continue (page-level navigation floats at the bottom); it learns of a blocking document through the value.
  useEffect(() => {
    if (Boolean(valueRef.current.documentsBlocked) !== documentsBlock) onChange({ ...valueRef.current, documentsBlocked: documentsBlock });
  }, [documentsBlock]); // eslint-disable-line react-hooks/exhaustive-deps
  const [bulletTemplates, setBulletTemplates] = useState<TncBulletTemplate[]>([]);

  useEffect(() => {
    if (!autoDetectDeviceType) return;
    listEntities<TncBulletTemplate>('tnc-summary-bullets').then(setBulletTemplates);
  }, [autoDetectDeviceType]);

  // Auto-select ONCE, the moment this call site mounts with nothing chosen
  // yet - the same "derive a default without stomping an existing value"
  // shape Plan & Add-ons' Bill Limit default uses. Guarded on value.cafType
  // rather than re-running every render, so an agent who somehow lands back
  // here after signing does not have their recorded type silently replaced.
  useEffect(() => {
    if (!autoDetectDeviceType || value.cafType) return;
    onChange({ ...value, cafType: detectCafType() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDetectDeviceType]);

  // The CAF type follows how it was signed: Manual once every printed form is back signed, the device's own type again when a signed copy is removed.
  // Manual once the signed General Terms & Conditions are back and, with a Secondary Contact, the signed Supplementary Terms & Conditions too (both are mandatory).
  const paperComplete = paperCopiesOf(value.paperPrimary).length > 0 && (!supplementaryForm || paperCopiesOf(value.paperSecondary).length > 0);
  useEffect(() => {
    if (!autoDetectDeviceType) return;
    if (paperComplete && value.cafType !== 'Manual') onChange({ ...valueRef.current, cafType: 'Manual' });
    else if (!paperComplete && value.cafType === 'Manual') onChange({ ...valueRef.current, cafType: detectCafType() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDetectDeviceType, paperComplete, value.cafType]);

  // The terms the customer reads and signs, in the language chosen: the business's document, else the journey's catalogue (also what the signed image and the printed forms carry).
  const termsSectionsToSign = () =>
    (termsSections ? Promise.resolve([...termsSections, ...(ipayActivation?.value && ipayTermsSections ? ipayTermsSections : [])]) : listEntities<{ title: string; body: string; journey?: string }>('tnc-full-text').then((all) => all.filter((x) => !x.journey || x.journey === journey)))
      .then((sections) => content.primary?.sections ?? sections);

  if (autoDetectDeviceType) {
    // Both auto-detected outcomes sign in-app now - see the prop's own note
    // on why Touch Screen no longer means "signed off-screen" once a device
    // check, not the agent, is what chose it.
    const showsInAppSignature = value.cafType === 'Digital' || value.cafType === 'Touch Screen';
    const signed = showsInAppSignature && Boolean(value.signatureDataUrl);
    // With a Supplementary Form the secondary contact signs it too: the step is done only when both have signed.
    const secondarySigned = Boolean(value.secondarySignatureDataUrl) || paperCopiesOf(value.paperSecondary).length > 0;
    // Signed on paper instead: the signed General Terms & Conditions are back and, with a Secondary Contact, the signed Supplementary ones too.
    const paperDone = paperCopiesOf(value.paperPrimary).length > 0 && (!supplementaryForm || paperCopiesOf(value.paperSecondary).length > 0);
    const allSigned = (signed && (!supplementaryForm || secondarySigned)) || paperDone;
    const bullets = buildTncBullets(legalFacts, bulletTemplates);
    // How the customer signs: two cards side by side, Sign Digitally the default. The agent's choice, so not in the customer's pop-up.
    const modeCards = (mode: 'digital' | 'paper', setMode: (m: 'digital' | 'paper') => void, spacing: string) => (
      <div className={`agent-only ${spacing}`} role="radiogroup" aria-label="How the customer signs">
        <div className="grid grid-cols-2 gap-4">
          {([
            { key: 'digital', title: 'Sign Digitally', note: 'Tablet or signature device', icon: PEN_ICON },
            { key: 'paper', title: 'Print & Sign', note: 'Print, sign and upload', icon: PRINT_ICON },
          ] as const).map((o) => {
            const chosen = mode === o.key;
            return (
              <button key={o.key} type="button" role="radio" aria-checked={chosen} onClick={() => setMode(o.key)} className={`option-card gap-2 p-4 text-left ${chosen ? CARD_SELECTED : CARD_IDLE}`}>
                <span className="row gap-3">
                  <Icon path={o.icon} className="size-6" />
                  <span className="title title-md font-semibold">{o.title}</span>
                </span>
                <span className="caption-secondary">{o.note}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
    // Both terms sections print under the same visible label, so the accessible name adds which form (it still starts with the visible text).
    const printFull = () =>
                void termsSectionsToSign().then((sections) =>
                  printFullTerms({
                    title: journey === 'prepaid' ? 'Vodafone Prepaid Terms & Conditions' : 'Vodafone Terms & Conditions',
                    keyInformation: (keyInformation ?? []).filter((k): k is string => typeof k === 'string'),
                    sections: sections.map((x) => ({ title: x.title, body: x.body })),
                    supplementary: supplementaryForm ? { heading: 'Supplementary Terms & Conditions', sections: (content.secondary?.sections ?? SECONDARY_CONTACT_TERMS).map((x) => ({ title: x.title, body: x.body })) } : undefined,
                    ipay: ipayActivation?.value && ipayTermsSections?.length ? { heading: 'iPAY Terms & Conditions', sections: ipayTermsSections.map((x) => ({ title: x.title, body: x.body })) } : undefined,
                    fullTermsUrl: termsUrl,
                    // One consolidated document to sign: both contacts' details, the agreements and a signature line for each.
                    primary: { name: customerName, representativeName: authorizedRepresentative?.name, idLabel, idValue, details: formDetails },
                    secondary: supplementaryForm ? { name: supplementaryForm.actualUserName, rows: supplementaryForm.rows } : undefined,
                    agreements: [t('marketing'), t('signedAgreementFull'), ...(supplementaryForm ? [t('signedAgreementSupplementary')] : [])],
                    dir: lang === 'ar' ? 'rtl' : 'ltr',
                  })
                );
    return (
      <div className="space-y-4">
        {/* The wizard's own step heading is not rendered while this step is
            customer-facing (GuidedActivationWizard hides all of its chrome
            for that render, including <h2>{label}</h2>) - this stands in so
            the screen is not handed to a customer with no heading at all.
            Shown when `signed` now (2026-09-30, reversed along with
            customerFacing): the wizard's own "CAF & Signature" heading is
            present for the whole unsigned review, so repeating one here
            would say the same thing twice; once signed, that chrome - and
            its heading - disappears, and this is what fills the gap. */}
        {signed && <h2 className="title title-xl">{t('signed')}</h2>}

        {/* Concise, dynamic, business-maintained bullets (2026-09-28 request),
            read to the customer before signature. Moved above the CAF card
            (2026-09-30): the customer reads what they're agreeing to FIRST,
            then signs the form below it, rather than being asked to sign
            ahead of the terms that follow. The commercial recap
            (orderSummary) stays alongside rather than being replaced: what
            was bought and what terms bind the customer are complementary
            facts, not the same one restated. */}
        {!signed && !fullTerms && (bullets.length > 0 || (orderSummary && orderSummary.length > 0)) && (
          <>
          {/* Key Information is the part the customer must not skip, so it is a tinted panel with 4px
              brand-accent left and right edges and an uppercase heading (2026-10-04). Existing tokens only: --surface-warm
              fill, --accent edge; text stays --fg / --fg-2 (about 12:1 and 6:1 on that fill). */}
          <div className="my-2 consent-panel p-6 space-y-3">
            {/* Renamed from "What the customer is agreeing to" (2026-09-28
                request) to match the heading BR-009's Key Information panel
                already uses elsewhere (NewMnpWizard, NewPrepaidWizard) -
                Postpaid-only; the other five journeys sharing this component
                keep their own heading below, unaffected. */}
            <h4 className="title title-md uppercase tracking-wide">{t('keyInformation')}</h4>
            {bullets.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 caption-secondary">
                {bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {orderSummary && orderSummary.length > 0 && (
              <dl className={bullets.length > 0 ? 'pt-2 border-t border-border-soft' : undefined}>
                {orderSummary.map((row, i) => (
                  <div key={`${i}-${row.label}`} className="spread py-1.5 row-rule">
                    <dt className="text-fg text-[length:var(--fs-caption)]">{row.label}</dt>
                    <dd className="text-fg text-[length:var(--fs-caption)] text-right">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {/* Fallback, not the primary route (2026-09-28 request): the
                bullets above are the concise answer for the common cases;
                this is for anything they do not cover. */}
            {termsUrl && (
              <p className="caption-muted">
                For anything not covered above,{' '}
                <a href={termsUrl} target="_blank" rel="noreferrer" className="link underline">
                  View Full Terms & Conditions
                </a>
                .
              </p>
            )}
          </div>
          </>
        )}

        <FullTerms
          termsUrl={termsUrl}
          enabled={fullTerms}
          signed={signed}
          journey={journey}
          sections={termsSections}
          keyInformation={keyInformation}
          ipay={ipayActivation && ipayTermsSections ? { ...ipayActivation, sections: ipayTermsSections } : undefined}
          // Only with a Secondary Contact on the line (the Supplementary Form exists only then): the supplementary terms beside the general ones.
          supplementaryTerms={supplementaryForm ? { terms: SECONDARY_CONTACT_TERMS, primaryContactName: customerName, secondaryContactName: supplementaryForm.actualUserName } : undefined}
          closingHeader={
            signed ? (
              // Signed: the same heading row as the secondary contact's form (the name is on the Signed by line below).
              <div className="divider-bottom pb-4 caption-muted">
                <h3 className="title title-sm font-semibold">{t('keyTerms')}: {termsHolder}</h3>
                {signerName && <p className="text-fg font-medium">{signerName}</p>}
                {authorizedRepresentative && <p className="caption-muted">{t('onBehalfOf')} {actualCustomer}</p>}
              </div>
            ) : (
              <div className="mt-2 divider-top pt-4 caption-muted">
                <h3 className="title title-sm font-semibold">{t('terms')}: {termsHolder}</h3>
                {signerName && <p className="text-fg font-medium">{signerName}</p>}
                {authorizedRepresentative && <p className="caption-muted">{t('onBehalfOf')} {actualCustomer}</p>}
              </div>
            )
          }
        >
        {/* The statements, agreements and signature are laid out left to right, left-aligned, in either language (dir="ltr"; each sentence still takes its own reading direction). */}
        <div dir="ltr" className={`left-aligned ${fullTerms ? (signed ? '' : 'py-4 pr-4') : 'card p-4'} ${inlineSignaturePad ? '' : 'bg-surface'}`}>
          {/* With the full terms on the page the toggle is among them (FullTerms), before the iPAY terms; here only when there are none. */}
          {ipayActivation && !(fullTerms && ipayTermsSections) && (
            <div className="split-nowrap mb-3">
              <span className="value-text">iPAY Activation</span>
              {signed ? (
                <span className="text-fg font-medium">{ipayActivation.value ? 'Yes' : 'No'}</span>
              ) : (
                <OptionToggle
                  label="iPAY Activation"
                  className="w-44"
                  items={[{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }]}
                  active={ipayActivation.value ? 'yes' : 'no'}
                  onChange={(k) => ipayActivation.onChange(k === 'yes')}
                />
              )}
            </div>
          )}
          {formDetails && formDetails.length > 0 && (
            <dl className="mb-2">
              {formDetails.map((row, i) => (
                <div key={`${i}-${row.label}`} className="spread py-1 row-rule text-[length:var(--fs-caption)]">
                  <dt className="text-fg">{row.label}</dt>
                  <dd className="text-fg text-right">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {idLabel && (
            <p className="body-text">
              {idLabel}: <span className="font-medium">{idValue ?? '-'}</span>
            </p>
          )}
          {supplementaryForm && !fullTerms && (
            <div id="supplementary-form-primary" className="mt-3 card-frame-soft p-3 space-y-2" aria-label="Supplementary Form">
              <dl>
                <div className="spread py-1 divider-bottom text-[length:var(--fs-caption)]">
                  <dt className="text-fg">Primary Customer</dt>
                  <dd className="text-fg text-right">{customerName ?? '-'}</dd>
                </div>
                {supplementaryForm.rows.map((row, i) => (
                  <div key={`${i}-${row.label}`} className="spread py-1 row-rule text-[length:var(--fs-caption)]">
                    <dt className="text-fg">{row.label}</dt>
                    <dd className="text-fg text-right">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="caption-secondary">
                The primary customer's one signature below signs both forms: the Customer Application Form and this Supplementary Form.
              </p>
            </div>
          )}

          {signed ? (
            <div className={`${fullTerms ? '' : 'mt-3 '}stack gap-3 items-start`}>
              <Badge variant="success">{fullTerms ? `${t('signedBy')} ${signerName ?? t('thePrimaryCustomer')}${authorizedRepresentative ? ` ${t('onBehalfOf')} ${actualCustomer}` : ''}` : supplementaryForm ? 'Signed: CAF and Supplementary Form' : t('signed')}</Badge>
              <img src={value.signatureDataUrl} alt="Signature" className="signature-thumb" />
            </div>
          ) : paperDone ? (
            <div className={`${fullTerms ? '' : 'mt-3 '}stack gap-3 items-start`}>
              <Badge variant="success">Signed on paper: the signed {supplementaryForm ? 'CAF and Supplementary CAF are' : 'CAF is'} uploaded</Badge>
            </div>
          ) : (
            <>
              {fullTerms && modeCards(signMode, setSignMode, 'mb-6')}
              {/* Full variant: the marketing statement (text only, no checkbox), then the terms, then the supplementary terms. */}
              {fullTerms && onBehalfOf && <p dir="auto" className="body-text mb-3">{onBehalfOf}</p>}
              {fullTerms && (
                <p dir="auto" className="body-text">{t('understandCopy')}</p>
              )}
              {/* With a Secondary Contact the checkboxes follow on the same full-width panel, so the marketing line gets room before them. */}
              {fullTerms && <p dir="auto" className={`body-text mt-3 ${supplementaryForm ? 'mb-3' : ''}`}>{t('marketing')}</p>}
              {/* The on-screen agreements belong to signing digitally: on paper the customer reads and signs the printed form instead. */}
              {requireTermsAgreement && !(fullTerms && signMode === 'paper') && (
                <label className="mt-3 row gap-2 cursor-pointer">
                  <Checkbox
                    checked={Boolean(value.termsAccepted)}
                    onCheckedChange={(checked) => onChange({ ...value, termsAccepted: (checked === true) })}
                  />
                  <span dir="auto" className="body-text">
                    {fullTerms ? t('readAgreedFull') : 'I have read and agree to the full'}{' '}
                    {termsUrl ? (
                      <a href={termsUrl} target="_blank" rel="noreferrer" className="link underline">
                        {t('fullTermsLink')}
                      </a>
                    ) : (
                      t('fullTermsLink')
                    )}
                    .
                  </span>
                </label>
              )}
              {/* Only with a verified secondary contact (the Supplementary Form exists only then): otherwise there is nothing supplementary to agree to. */}
              {supplementaryForm && !(fullTerms && signMode === 'paper') && (
                <label className="mt-3 row gap-2 cursor-pointer">
                  <Checkbox checked={Boolean(value.supplementaryAgreed)} onCheckedChange={(checked) => onChange({ ...value, supplementaryAgreed: (checked === true) })} />
                  {fullTerms ? (
                    <span dir="auto" className="body-text">
                      {t('readAgreedSupplementary')}{' '}
                      {termsUrl ? (
                        <a href={termsUrl} target="_blank" rel="noreferrer" className="link underline">
                          {t('supplementaryTermsLink')}
                        </a>
                      ) : (
                        t('supplementaryTermsLink')
                      )}
                      .

                    </span>
                  ) : (
                    <span className="body-text">I have read and agree to the{' '}
                      <Button variant="link" type="button" className="underline" onClick={() => document.getElementById('supplementary-form-primary')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                        Supplementary Form
                      </Button>
                      .</span>
                  )}
                </label>
              )}
              {fullTerms && signMode === 'paper' ? null : (
              <SignatureCapture
                label={t('pleaseSign')}
                doneLabel={t('save')}
                clearLabel={t('clear')}
                // The full Terms and the supplementary terms are both mandatory before signing; marketing consent is optional.
                disabled={((requireTermsAgreement || fullTerms) && !value.termsAccepted) || (Boolean(supplementaryForm) && !value.supplementaryAgreed)}
                onSave={(dataUrl) => {
                  onChange({ ...value, signatureDataUrl: dataUrl, termsLanguage: lang });
                  if (!fullTerms) return;
                  // The signed CAF the journey keeps carries what the customer saw and agreed to, not only the pen stroke.
                  void termsSectionsToSign()
                    .then((sections) =>
                      composeSignedCafImage({
                        heading: `${t('keyTerms')}: ${termsHolder}`,
                        customerName: signerName,
                        // What the customer read: the sections in the language they chose.
                        sections: sections.map((x) => ({ title: x.title, body: x.body })),
                        agreements: [
                          ...(onBehalfOf ? [{ text: onBehalfOf, agreed: true }] : []),
                          { text: t('marketing'), agreed: value.marketingConsent !== false },
                          { text: t('signedAgreementFull'), agreed: Boolean(value.termsAccepted) },
                          ...(supplementaryForm ? [{ text: t('signedAgreementSupplementary'), agreed: Boolean(value.supplementaryAgreed) }] : []),
                        ],
                        signatureDataUrl: dataUrl,
                        direction: lang === 'ar' ? 'rtl' : 'ltr',
                        signedByText: `${t('signedBy')} ${signerName ?? t('thePrimaryCustomer')}`,
                      })
                    )
                    .then((signedCafDataUrl) => onChange({ ...valueRef.current, signatureDataUrl: dataUrl, signedCafDataUrl, termsLanguage: lang }))
                    .catch(() => undefined);
                }}
              />
              )}
            </>
          )}
        </div>
        </FullTerms>

        {/* Sign on paper: print the CAF (and, with a Secondary Contact, the Supplementary CAF) for the customer's pen signature and upload each signed copy back.
            The agent's alternative to signing on screen, offered until a signature is captured here; hidden in the customer's pop-up. */}
        {!signed && fullTerms && (signMode === 'paper' || paperDone) && (
          <div className="agent-only">
            <CafPaperPanel
              onPrintFullTerms={printFull}
              forms={[
                // The consolidated document is printed once; its signed copy comes back in a container per part, both mandatory.
                {
                  key: 'primary',
                  title: 'General Terms & Conditions',
                  documentType: 'CAF',
                  copies: paperCopiesOf(value.paperPrimary),
                  onCopies: (copies) => onChange({ ...valueRef.current, paperPrimary: copies.length > 0 ? copies : undefined }),
                },
                ...(supplementaryForm
                  ? [
                      {
                        key: 'secondary' as const,
                        title: 'Supplementary Terms & Conditions',
                        documentType: 'Supplementary Form',
                        copies: paperCopiesOf(value.paperSecondary),
                        onCopies: (copies: PaperCafCopy[]) => onChange({ ...valueRef.current, paperSecondary: copies.length > 0 ? copies : undefined }),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        )}

        {/* The secondary contact signs the Supplementary Form ONLY, on its own: the form shown separately, its own consent and its own pad,
            enabled once that consent is ticked. Shown after the primary customer has signed. */}
        {signed && supplementaryForm && (
          <section id="supplementary-form-secondary" aria-label="Supplementary Form - secondary contact" className="card p-4 space-y-3">
            <div className="caption-muted">
              <h3 className="title title-sm font-semibold">{t('supplementaryFormSecondary')}</h3>
              {supplementaryForm.actualUserName && <p className="text-fg font-medium">{supplementaryForm.actualUserName}</p>}
            </div>
            {/* The terms the secondary contact agrees to by signing. */}
            <ul className="space-y-2 text-[length:var(--fs-caption)]">
              {(content.secondary?.sections ?? SECONDARY_CONTACT_TERMS).map((term) => (
                <li key={term.title}>
                  <span dir="auto" className="text-fg font-semibold">{term.title}: </span>
                  <span dir="auto" className="text-fg-2">{term.body}</span>
                </li>
              ))}
            </ul>
            {secondarySigned && secondaryMode === 'digital' && Boolean(value.secondarySignatureDataUrl) ? (
              <div className="row">
                <Badge variant="success">{t('signedBy')} {supplementaryForm.actualUserName ?? t('secondaryContact')}</Badge>
                <img src={value.secondarySignatureDataUrl} alt="Secondary contact signature" className="signature-thumb" />
              </div>
            ) : (
              <>
                {modeCards(secondaryMode, setSecondaryMode, 'mt-2 mb-4')}
                {secondaryMode === 'paper' ? (
                  <div className="agent-only">
                    <CafPaperPanel
                      onPrintFullTerms={printFull}
                      forms={[
                        {
                          key: 'secondary',
                          title: 'Supplementary Terms & Conditions',
                          documentType: 'Supplementary Form',
                          copies: paperCopiesOf(value.paperSecondary),
                          onCopies: (copies) => onChange({ ...valueRef.current, paperSecondary: copies.length > 0 ? copies : undefined }),
                        },
                      ]}
                    />
                  </div>
                ) : (
                  <>
                    <label className="row gap-2 cursor-pointer">
                      <Checkbox checked={Boolean(value.secondaryAgreed)} onCheckedChange={(checked) => onChange({ ...value, secondaryAgreed: (checked === true) })} />
                      <span dir="auto" className="body-text">{t('readAgreedSupplementaryForm')}{' '}
                        <Button variant="link" type="button" className="underline" onClick={() => document.getElementById('supplementary-form-secondary')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                          {t('supplementaryForm')}
                        </Button>
                        .</span>
                    </label>
                    <SignatureCapture disabled={!value.secondaryAgreed} onSave={(dataUrl) => onChange({ ...value, secondarySignatureDataUrl: dataUrl })} />
                  </>
                )}
              </>
            )}
          </section>
        )}

        {/* Post-signature, agent view: the signed CAF preview above stays on
            screen (2026-09-28 "preview of the signed CAF"), and whatever
            else this order needs attached - no signature required for any
            of it - goes here instead of the legacy "Signed documents"
            uploader, which had nothing left to collect once signing always
            happens in-app. */}
        {/* agent-only: hidden in the customer's pop-up - attaching documents is the agent's job. */}
        {/* Only once every required signature is captured: the primary CAF and, with an actual user, the secondary contact's. */}
        {allSigned && (
          <div className="agent-only">
            <AdditionalDocumentsUpload
              documents={value.additionalDocuments ?? []}
              onChange={(documents) => onChange({ ...valueRef.current, additionalDocuments: documents })}
              labelOptions={documentLabelOptions}
              // The same pattern as the Customer Representative page's Authorization / Supporting Documents: each type is its own container, uploaded one at a time.
              separateUploads
              // The mandatory ones (configured in document-types.json) carry * and hold Continue; the others are marked (Optional).
              mandatoryLabels={documentMandatoryLabels ?? mandatoryDocumentLabels()}
              maxDocuments={maxAdditionalDocuments}
              onPendingChange={setDocumentPending}
              requirements={documentRequirements}
              onMissingRequiredChange={setMissingRequired}
              journeyDocuments={journeyDocuments}
            />
          </div>
        )}

        {/* The wizard's own Continue is gone along with the rest of its
            chrome once signed (customerFacing flips true) - this is the
            replacement, same reasoning as the "Please Sign" button above:
            the step's own content owns whatever action it needs. Additional
            documents are optional (isValid never required them), so nothing
            gates this beyond having signed at all. */}
        {/* Page-level navigation (Continue) is the wizard's floating footer, never a button in the page: the form reports a blocking document through `documentsBlocked`. */}
        {onSave && (
          <div className="agent-only split-nowrap">
            <div />
            <Button variant="secondary" onClick={onSave}>
              Save
            </Button>
          </div>
        )}

      </div>
    );
  }

  // Unchanged for the five other journeys sharing this component (MNP,
  // Passport-to-QID, etc.), none of which asked for any of the above.
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[length:var(--fs-label)] text-fg-2 mb-2">CAF Type</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))] gap-3">
          {CAF_TYPES.map((t) => {
            const selected = t.type === value.cafType;
            return (
              <button
                key={t.type}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...value, cafType: t.type })}
                className={`choice-tile ${
                  selected ? 'option-chosen text-fg' : 'card-idle text-fg'
                }`}
              >
                {selected && <SelectedTick />}
                <Icon path={t.icon} className="size-6 " />
                <span className="text-[length:var(--fs-caption)] font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {value.cafType === 'Digital' && (
        <div className="card p-4 card-surface">
          <div className="caption-muted mb-2">
            <span>Vodafone Customer Application Form</span>
          </div>
          <p className="body-text">
            Applicant: <span className="font-medium">{customerName ?? '-'}</span>
          </p>
          {idLabel && (
            <p className="body-text">
              {idLabel}: <span className="font-medium">{idValue ?? '-'}</span>
            </p>
          )}
          <p className="caption-secondary mt-1">
            By signing below, the applicant accepts the General Terms and Conditions of Vodafone Qatar.
          </p>

          {value.signatureDataUrl ? (
            <div className="mt-3 row">
              <Badge variant="success">Signed</Badge>
              <img src={value.signatureDataUrl} alt="Signature" className="signature-thumb" />
            </div>
          ) : (
            <SignatureCapture onSave={(dataUrl) => onChange({ ...value, signatureDataUrl: dataUrl })} />
          )}
        </div>
      )}

      {/* Upload of the signed paperwork. Gated on the CAF actually being
          signed: for CAF-Digital that is the in-app signature; for Manual and
          Touch Screen the signing happens off-screen, so choosing either type
          IS the point at which there is paper to scan back in - which is why
          those two do not wait for signatureDataUrl, which they never set. */}
      {value.cafType && (value.cafType !== 'Digital' || value.signatureDataUrl) && (
        <CafDocumentUpload
          documents={value.documents ?? []}
          onChange={(documents) => onChange({ ...value, documents })}
        />
      )}

      {/* Read to the customer before signature. Deliberately BELOW the CAF
          preview and above the pad: it is the plain-language version of what
          the form commits them to, and it is the last thing on screen before
          they sign. */}
      {orderSummary && orderSummary.length > 0 && (
        <div className="card card-surface p-4 space-y-2">
          <h4 className="value-text">What the Customer Is Agreeing To</h4>
          <dl className="text-[length:var(--fs-caption)]">
            {orderSummary.map((row, i) => (
              <div key={`${i}-${row.label}`} className="spread py-1.5 row-rule">
                <dt className="text-fg">{row.label}</dt>
                <dd className="text-fg text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
          {termsUrl && (
            <a
              href={termsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-[length:var(--fs-caption)] link underline"
            >
              Read the full terms and conditions
            </a>
          )}
        </div>
      )}

    </div>
  );
}
