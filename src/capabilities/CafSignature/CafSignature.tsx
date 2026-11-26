import { useEffect, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import type { TncBulletTemplate } from '../../components/patterns/cafTermsModel';
import { CafSignatureCapture } from '../../components/patterns/CafSignatureCapture';
import { listEntities } from '../../services/entityOps';
import { CafLanguageProvider, CafLanguageToggle } from '../../components/patterns/cafLanguage';
import { useCustomerPopup } from '../../hooks/useCustomerPopup';
import type { CafContentDoc, CafLanguage } from '../../data/cafLanguage';
import { loadCafContent } from '../../engines/cafContentEngine';
import { KeyInformationPanel } from 'dxp-ui';

type Capture = ComponentProps<typeof CafSignatureCapture>;

/**
 * CAF & SIGNATURE - the one application-wide capability for the Customer Agreement Form: the customer reads the
 * terms, the CAF type is set (Digital / Touch Screen / paper), the signature is captured and the order's
 * supporting documents are attached.
 *
 * Journeys mount THIS component (usually through cafSignatureStep in wizard/wizardSteps, or New Connection's
 * cafStep for the full variant) and say what their context needs; none of them wires CafSignatureCapture itself.
 *
 *   variant 'standard'  the CAF with the customer's name; the CAF type follows the device when
 *                       `autoDetectDeviceType` is set. Prepaid, port-in, Pre-to-Post, FWA, Fixed Line.
 *   variant 'full'      New Connection: the customer reads back the order summary and T&C facts, signs on an inline
 *                       pad, agrees to the terms, attaches up to five documents, then continues from the signed view.
 *
 *   keyInformation      statements the customer must see before signing (e.g. prepaid: no lock-in period).
 */

/**
 * CAF & SIGNATURE - the one application-wide capability for the Customer Agreement Form: the customer reads the
 * terms, the CAF type is set (Digital / Touch Screen / paper), the signature is captured and the order's
 * supporting documents are attached.
 *
 * Journeys mount THIS component (usually through cafSignatureStep in wizard/wizardSteps, or New Connection's
 * cafStep for the full variant) and say what their context needs; none of them wires CafSignatureCapture itself.
 *
 *   variant 'standard'  the CAF with the customer's name; the CAF type follows the device when
 *                       `autoDetectDeviceType` is set. Prepaid, port-in, Pre-to-Post, FWA, Fixed Line.
 *   variant 'full'      New Connection: the customer reads back the order summary and T&C facts, signs on an inline
 *                       pad, agrees to the terms, attaches up to five documents, then continues from the signed view.
 *
 *   keyInformation      statements the customer must see before signing (e.g. prepaid: no lock-in period).
 */
type Common = {
  value: Capture['value'];
  onChange: Capture['onChange'];
  customerName?: string;
  /** The ID the CAF reads back (label and number), where the journey shows one - e.g. prepaid port-in. */
  /** The ID the CAF reads back (label and number), where the journey shows one - e.g. prepaid port-in. */
  idLabel?: string;
  idValue?: string;
  keyInformation?: ReactNode[];
  /**
   * Key Information read from the business-maintained statements (tnc-summary-bullets.json) whose scenario key starts
   * with this prefix - e.g. 'prepaid-' for the prepaid terms (MPRA_001_CAF_02) - shown with any `keyInformation` above.
   */
  /**
   * Key Information read from the business-maintained statements (tnc-summary-bullets.json) whose scenario key starts
   * with this prefix - e.g. 'prepaid-' for the prepaid terms (MPRA_001_CAF_02) - shown with any `keyInformation` above.
   */
  keyInformationScenario?: string;
};

export type CafSignatureProps =
  | (Common & { variant?: 'standard'; autoDetectDeviceType?: boolean })
  | (Common & {
      variant: 'full';
      orderSummary?: Capture['orderSummary'];
      fullTerms?: Capture['fullTerms'];
      legalFacts?: Capture['legalFacts'];
      /** Which journey's form and Terms & Conditions: postpaid (default) or prepaid. */
      /** Which journey's form and Terms & Conditions: postpaid (default) or prepaid. */
      journey?: Capture['journey'];
      /** A Customer Representative signs for the actual customer (`customerName`): the signing context, the signed-by name and the terms wording follow. */
      authorizedRepresentative?: Capture['authorizedRepresentative'];
      /** Extra rows on the application form (label/value). */
      /** Extra rows on the application form (label/value). */
      formDetails?: Capture['formDetails'];
      /** The journey's own Terms & Conditions sections instead of the shared catalogue's (New Prepaid's configurable terms). */
      /** The journey's own Terms & Conditions sections instead of the shared catalogue's (New Prepaid's configurable terms). */
      termsSections?: Capture['termsSections'];
      /** New Prepaid: the iPAY Terms & Conditions, shown after the iPAY Activation toggle only while it is Yes. */
      /** New Prepaid: the iPAY Terms & Conditions, shown after the iPAY Activation toggle only while it is Yes. */
      ipayTermsSections?: Capture['ipayTermsSections'];
      /** An "iPAY Activation" Yes / No choice on the form (New Prepaid). */
      /** An "iPAY Activation" Yes / No choice on the form (New Prepaid). */
      ipayActivation?: Capture['ipayActivation'];
      /** The Supplementary Form of an actual user: one signature signs it together with the CAF. */
      /** The Supplementary Form of an actual user: one signature signs it together with the CAF. */
      supplementaryForm?: Capture['supplementaryForm'];
      /** Additional Documents: what this order requires, and what the journey already holds (viewable, downloadable). */
      /** Additional Documents: what this order requires, and what the journey already holds (viewable, downloadable). */
      documentRequirements?: Capture['documentRequirements'];
      documentLabelOptions?: Capture['documentLabelOptions'];
      journeyDocuments?: Capture['journeyDocuments'];
    });

/**
 * Additional documents, as Mobile Postpaid Activation has them: the one definition every journey that mounts this capability uses
 * (up to five files; the document types come from public/config/document-types.json). Change it here, not in a journey.
 */

/**
 * Additional documents, as Mobile Postpaid Activation has them: the one definition every journey that mounts this capability uses
 * (up to five files; the document types come from public/config/document-types.json). Change it here, not in a journey.
 */
const ADDITIONAL_DOCUMENTS: Pick<Capture, 'maxAdditionalDocuments'> = {
  maxAdditionalDocuments: 5,
};

export function CafSignature(props: CafSignatureProps) {
  const { value, onChange, customerName, idLabel, idValue, keyInformationScenario } = props;
  // The customer reads and signs in English or Arabic - their choice, made in their pop-up; the agent's own screen is English. Neither is written or translated here: the wording is
  // the business's own document for the language (CAF_<journey>_<party>_<language>, converted to public/config/caf-content/), and the built-in English shows where one is not provided.
  const inCustomerPopup = useCustomerPopup();
  const [chosenLanguage, setChosenLanguage] = useState<CafLanguage>('en');
  const language: CafLanguage = inCustomerPopup ? chosenLanguage : 'en';
  const [scenarioTemplates, setScenarioTemplates] = useState<TncBulletTemplate[]>([]);
  const cafJourney = props.variant === 'full' ? (props.journey ?? 'postpaid') : 'postpaid';
  const [documents, setDocuments] = useState<{ key: string; primary?: CafContentDoc; secondary?: CafContentDoc }>({ key: '' });
  const documentsKey = `${cafJourney}|${language}`;
  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadCafContent(cafJourney, 'primary', language), loadCafContent(cafJourney, 'secondary', language)]).then(([primary, secondary]) => {
      if (!cancelled) setDocuments({ key: documentsKey, primary, secondary });
    });
    return () => {
      cancelled = true;
    };
  }, [cafJourney, language, documentsKey]);
  // What was loaded for another journey or language is not shown for this one while it loads.
  const content = documents.key === documentsKey ? { primary: documents.primary, secondary: documents.secondary } : {};
  useEffect(() => {
    if (!keyInformationScenario) return;
    let cancelled = false;
    listEntities<TncBulletTemplate>('tnc-summary-bullets').then((all) => {
      if (!cancelled) setScenarioTemplates(all.filter((t) => t.scenarioKey.startsWith(keyInformationScenario)));
    });
    return () => {
      cancelled = true;
    };
  }, [keyInformationScenario]);
  const keyInformation = [...(props.keyInformation ?? []), ...scenarioTemplates.map((t) => t.template)];
  // With the full Terms & Conditions on the page the key statements are their first lines, not a panel of their own; without them (the standard capture) the panel stays.
  const mergeIntoTerms = props.variant === 'full' && Boolean(props.fullTerms);
  const capture =
    props.variant === 'full' ? (
      <CafSignatureCapture
        value={value}
        onChange={onChange}
        customerName={customerName}
        idLabel={idLabel}
        idValue={idValue}
        orderSummary={props.orderSummary}
        fullTerms={props.fullTerms}
        legalFacts={props.legalFacts}
        journey={props.journey}
        authorizedRepresentative={props.authorizedRepresentative}
        formDetails={props.formDetails}
        termsSections={props.termsSections}
        ipayTermsSections={props.ipayTermsSections}
        keyInformation={mergeIntoTerms ? keyInformation : undefined}
        ipayActivation={props.ipayActivation}
        supplementaryForm={props.supplementaryForm}
        documentLabelOptions={props.documentLabelOptions ?? []}
        documentRequirements={props.documentRequirements}
        journeyDocuments={props.journeyDocuments}
        inlineSignaturePad
        {...ADDITIONAL_DOCUMENTS}
        termsUrl="https://www.vodafone.qa/en/terms-and-conditions"
        autoDetectDeviceType
        requireTermsAgreement
      />
    ) : (
      <CafSignatureCapture
        value={value}
        onChange={onChange}
        customerName={customerName}
        idLabel={idLabel}
        idValue={idValue}
        // Always: the CAF type is the device's (Digital on the web, Touch Screen on a tablet), never picked by hand.
        autoDetectDeviceType
        {...ADDITIONAL_DOCUMENTS}
      />
    );
  const body =
    !keyInformation?.length || mergeIntoTerms ? (
      capture
    ) : (
      <div className="space-y-6">
        <KeyInformationPanel items={keyInformation} />
        {capture}
      </div>
    );
  // The content (the business's documents for the language) reaches every part of the screen; in the customer's pop-up the language choice sits above everything they read, laid out in its direction.
  return (
    <CafLanguageProvider lang={language} content={content} direction={inCustomerPopup}>
      {inCustomerPopup ? (
        <>
          {/* In the title row, at the top right of the customer's pop-up. */}
          <div className="mirror-corner">
            <CafLanguageToggle lang={language} onChange={setChosenLanguage} />
          </div>
          {body}
        </>
      ) : (
        body
      )}
    </CafLanguageProvider>
  );
}
