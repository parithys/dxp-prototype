import { useEffect, useState, type ReactNode } from 'react';
import { Switch, Card } from 'dxp-ui';
import type { TncSection } from './cafTermsModel';
import { listEntities } from '../../services/entityOps';
import { useCafLanguage } from './cafLanguageContext';

/**
 * The complete Terms & Conditions, in their own bordered panel directly above the signature block, so the
 * customer can read all of it before signing. The terms sit in a dedicated container of one FIXED height (the height the panel's terms had, without the contact line under them):
 * more content scrolls inside it and never grows it or moves the page; the contact line stays under it, outside the scrolling.
 */

/**
 * The complete Terms & Conditions, in their own bordered panel directly above the signature block, so the
 * customer can read all of it before signing. The terms sit in a dedicated container of one FIXED height (the height the panel's terms had, without the contact line under them):
 * more content scrolls inside it and never grows it or moves the page; the contact line stays under it, outside the scrolling.
 */
export function FullTerms({
  enabled,
  signed,
  journey = 'postpaid',
  sections: sectionsOverride,
  closingHeader,
  supplementaryTerms,
  keyInformation,
  ipay,
  children,
}: {
  /**
   * New Prepaid's iPAY Activation: a Yes / No toggle (editable until the CAF is signed) placed after the prepaid terms and BEFORE the iPAY Terms & Conditions, which are shown only while it is
   * Yes - the customer reads and agrees to them only when they take iPAY. Once signed it reads Yes / No and the iPAY terms stay as signed.
   */
  /**
   * New Prepaid's iPAY Activation: a Yes / No toggle (editable until the CAF is signed) placed after the prepaid terms and BEFORE the iPAY Terms & Conditions, which are shown only while it is
   * Yes - the customer reads and agrees to them only when they take iPAY. Once signed it reads Yes / No and the iPAY terms stay as signed.
   */
  ipay?: { value: boolean; onChange: (value: boolean) => void; sections: readonly TncSection[] };
  /** The key statements the customer must see before signing (no lock-in period ...): the first lines of Key Terms & Conditions, ahead of its sections. */
  /** The key statements the customer must see before signing (no lock-in period ...): the first lines of Key Terms & Conditions, ahead of its sections. */
  keyInformation?: ReactNode[];
  /** Accepted for callers that still pass it; the panel no longer links out. */
  /** Accepted for callers that still pass it; the panel no longer links out. */
  termsUrl?: string;
  enabled: boolean;
  signed?: boolean;
  /** Which journey's terms to show: a section scoped to the other journey is left out. Postpaid by default. */
  /** Which journey's terms to show: a section scoped to the other journey is left out. Postpaid by default. */
  journey?: 'postpaid' | 'prepaid';
  /** The journey's own sections, instead of the shared catalogue's (New Prepaid: its configurable terms, with the iPAY supplement only when iPAY is on). */
  /** The journey's own sections, instead of the shared catalogue's (New Prepaid: its configurable terms, with the iPAY supplement only when iPAY is on). */
  sections?: readonly TncSection[];
  /** A heading over the closing part of the panel (the customer's details, agreements and signature), above its dividing line. */
  /** A heading over the closing part of the panel (the customer's details, agreements and signature), above its dividing line. */
  closingHeader?: ReactNode;
  /** With a Secondary Contact on the line: the supplementary terms, in a second card beside the general ones (each card closes with its
   * contact's name). The agreements and signature (children) then sit below both cards at full width. Absent: the single panel, unchanged. */
  /** With a Secondary Contact on the line: the supplementary terms, in a second card beside the general ones (each card closes with its
   * contact's name). The agreements and signature (children) then sit below both cards at full width. Absent: the single panel, unchanged. */
  supplementaryTerms?: { terms: readonly { title: string; body: string }[]; primaryContactName?: string; secondaryContactName?: string };
  children: ReactNode;
}) {
  const { t, content } = useCafLanguage();
  const [catalogue, setCatalogue] = useState<TncSection[] | undefined>();
  useEffect(() => {
    if (sectionsOverride) return;
    listEntities<TncSection>('tnc-full-text').then((all) => setCatalogue(all.filter((s) => !s.journey || s.journey === journey)));
  }, [journey, sectionsOverride]);
  // The business's own document for the language replaces the built-in wording wherever it is provided.
  const sections: readonly TncSection[] | undefined = content.primary?.sections?.map((x, i) => ({ sectionId: `DOC-${i}`, ...x })) ?? sectionsOverride ?? catalogue;
  // Without the terms (not the customer-facing page, or none loaded) the form stands alone.
  if (!enabled || !sections || sections.length === 0) return <>{children}</>;
  // Signed: the answer as one line, "iPAY Activation: Enabled" or "Disabled". Unsigned: a small switch on the left with its label just to the right.
  const ipayToggle = ipay ? (
    signed ? (
      <p className="text-[length:var(--fs-caption)]">
        <span className="text-fg font-semibold">{t('ipayActivation')}: </span>
        <span className="text-fg-2">{ipay.value ? t('enabled') : t('disabled')}</span>
      </p>
    ) : (
      <label className="row gap-3 w-fit cursor-pointer">
        <Switch checked={ipay.value} onCheckedChange={(checked) => ipay.onChange(checked === true)} />
        <span className="value-text">{t('ipayActivation')}</span>
      </label>
    )
  ) : null;
  const ipayToggleRow = ipayToggle ? <div className="stack gap-3 divider-top pt-4">{ipayToggle}</div> : null;
  const ipayTerms = ipay?.value
    ? ipay.sections.map((s) => (
        <div key={s.sectionId}>
          <h4 dir="auto" className="value-text">{s.title}</h4>
          <p dir="auto" className="caption-secondary leading-relaxed mt-1">{s.body}</p>
        </div>
      ))
    : null;
  // The toggle with its terms under it: where the terms share the one column (signed form, and the Secondary Contact layout's general card).
  const ipayBlock = ipay ? (
    <div className="stack gap-3">
      {ipayToggleRow}
      {ipayTerms}
    </div>
  ) : null;
  // The unsigned form: the iPAY Activation toggle sits above the Key Terms & Conditions card, which takes the full width; once iPAY Activation is Yes the iPAY terms take a second column beside them (as the Secondary Contact
  // layout's Supplementary terms do), and drop back to full width when it is No.
  // Prepaid has no "Key" terms heading: the card is the Prepaid Terms & Conditions, so a section carrying that same title is not repeated inside it.
  const termsHeading = content.primary?.heading ?? (journey === 'prepaid' ? t('prepaidTerms') : t('keyTerms'));
  const ipayBeside = Boolean(ipay?.value && ipay.sections.length > 0);
  const keyInfo = keyInformation?.length ? (
    <ul className="list-disc list-inside space-y-1 text-secondary">
      {keyInformation.map((item, i) => (
        <li key={i} dir="auto">{item}</li>
      ))}
    </ul>
  ) : null;
  // With a Secondary Contact the terms are the same two cards signed or not; signed, the children are just the Signed badge and signature.
  if (supplementaryTerms && (content.secondary?.sections ?? supplementaryTerms.terms).length > 0) {
    return (
      <div className="space-y-4">
        {/* iPAY Activation above the frame, as in the single-card layout; its terms are the second row below (first column). */}
        {ipayToggle}
        {/* One shared frame holds both columns, which carry no borders of their own (a hairline divides them). items-stretch: both columns take
            the height of the taller one, and each pins its contact block to its bottom edge, so the two line up. */}
        <Card>
          <div className="two-col-top items-stretch gap-0">
            <section aria-label="General Key Terms and Conditions" className="stack gap-0">
              <div className="split-nowrap divider-bottom pad-row">
                <h3 className="title title-sm font-semibold">{content.primary?.heading ?? t('keyTerms')}</h3>
              </div>
              <div role="region" aria-label={content.primary?.heading ?? t('keyTerms')} tabIndex={0} className="caf-terms-scroll pad-row stack gap-4 focus-ring">
                {keyInfo}
                {sections.map((s) => (
                  <div key={s.sectionId}>
                    <h4 dir="auto" className="value-text">{s.title}</h4>
                    <p dir="auto" className="caption-secondary leading-relaxed mt-1">{s.body}</p>
                  </div>
                ))}
              </div>
              <div className="pad-row">
                <div className="divider-top pt-4 caption-muted">
                  <h3 className="title title-sm font-semibold">{t('primaryContact')}</h3>
                  {supplementaryTerms.primaryContactName && <p className="text-fg font-medium">{supplementaryTerms.primaryContactName}</p>}
                </div>
              </div>
            </section>
            <section aria-label="Supplementary Key Terms and Conditions" className="stack gap-0 lg:border-l border-border-soft">
              <div className="split-nowrap divider-bottom pad-row">
                <h3 className="title title-sm font-semibold">{content.secondary?.heading ?? t('supplementaryKeyTerms')}</h3>
              </div>
              <div role="region" aria-label={content.secondary?.heading ?? t('supplementaryKeyTerms')} tabIndex={0} className="caf-terms-scroll pad-row stack gap-4 focus-ring">
                {(content.secondary?.sections ?? supplementaryTerms.terms).map((term) => (
                  <div key={term.title}>
                    <h4 dir="auto" className="value-text">{term.title}</h4>
                    <p dir="auto" className="caption-secondary leading-relaxed mt-1">{term.body}</p>
                  </div>
                ))}
              </div>
              <div className="pad-row">
                <div className="divider-top pt-4 caption-muted">
                  <h3 className="title title-sm font-semibold">{t('secondaryContact')}</h3>
                  {supplementaryTerms.secondaryContactName && <p className="text-fg font-medium">{supplementaryTerms.secondaryContactName}</p>}
                </div>
              </div>
            </section>
          </div>
        </Card>
        {/* Second row, across both columns: the iPAY Terms & Conditions (while iPAY Activation is Yes) are their own terms, a card of their own - never appended to the Key Terms & Conditions. */}
        {ipayBeside && ipay && (
          <Card aria-label="iPAY Terms and Conditions" role="group" className="stack gap-0">
            <div className="split-nowrap divider-bottom pad-row">
              <h3 className="title title-sm font-semibold">{t('ipayTerms')}</h3>
            </div>
            {/* As tall as its text (the iPAY terms are short): no fixed height, no scrolling. */}
            <div role="region" aria-label={t('ipayTerms')} className="pad-row stack gap-4 py-6">
              {ipay.sections.map((x) => (
                <div key={x.sectionId}>
                  {x.title !== t('ipayTerms') && <h4 dir="auto" className="value-text">{x.title}</h4>}
                  <p dir="auto" className="caption-secondary leading-relaxed mt-1">{x.body}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
        {/* Full width, below both columns, no frame of its own: the "I understand" and "I agree" statements, the agreements and the signature
            (once signed: the Signed badge and the signature). */}
        <div>{children}</div>
      </div>
    );
  }
  // Once signed there is nothing left to read: show just the signed form (applicant, signed
  // badge and signature) not the whole scrolling document or its link.
  if (signed) {
    return (
      // The signed primary contact, laid out like the secondary contact's form: heading, the key terms as one line each, then who signed and the signature.
      <section aria-label="Signed application form" className="card p-4 space-y-3">
        {closingHeader}
        {keyInfo}
        <ul className="space-y-2 text-[length:var(--fs-caption)]">
          {sections.map((s) => (
            <li key={s.sectionId}>
              <span dir="auto" className="text-fg font-semibold">{s.title}: </span>
              <span dir="auto" className="text-fg-2">{s.body}</span>
            </li>
          ))}
        </ul>
        {ipayBlock}
        {children}
      </section>
    );
  }
  // The Secondary Contact layout's design: one framed card of two columns (each a header over its terms, a hairline between them, header included), the contact in a row
  // across both at the foot; the statements, agreements and signature follow below, outside the frame, at full width.
  const IPAY_HEADING = t('ipayTerms');
  return (
    <div className="space-y-4">
      {ipayToggle}
      <Card>
        <section aria-label="Full Terms and Conditions">
          <div className={ipayBeside ? 'two-col-top items-stretch gap-0' : undefined}>
            <div className="stack gap-0">
              <div className="split-nowrap divider-bottom pad-row">
                <h3 className="title title-sm font-semibold">{termsHeading}</h3>
              </div>
              {/* tabIndex so the terms can be scrolled with the keyboard. */}
              <div role="region" aria-label={termsHeading} tabIndex={0} className="caf-terms-scroll pad-row stack gap-4 focus-ring">
                {keyInfo}
                {sections.map((s) => (
                  <div key={s.sectionId}>
                    {s.title !== termsHeading && <h4 dir="auto" className="value-text">{s.title}</h4>}
                    <p dir="auto" className="caption-secondary leading-relaxed mt-1">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
            {ipayBeside && ipay && (
              <div aria-label="iPAY Terms and Conditions" role="group" className="stack gap-0 lg:border-l border-border-soft">
                <div className="split-nowrap divider-bottom pad-row">
                  <h3 className="title title-sm font-semibold">{IPAY_HEADING}</h3>
                </div>
                <div role="region" aria-label={IPAY_HEADING} tabIndex={0} className="caf-terms-scroll pad-row stack gap-4 focus-ring">
                  {ipay.sections.map((x) => (
                    <div key={x.sectionId}>
                      {x.title !== IPAY_HEADING && <h4 dir="auto" className="value-text">{x.title}</h4>}
                      <p dir="auto" className="caption-secondary leading-relaxed mt-1">{x.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* The contact is common to both columns: one row across the full width of the frame, under both. */}
          {closingHeader && <div className="pad-row">{closingHeader}</div>}
        </section>
      </Card>
      {/* Full width, below the frame: the "I understand" and "I agree" statements, the agreements and the signature. */}
      <div>{children}</div>
    </div>
  );
}
