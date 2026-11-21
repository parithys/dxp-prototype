import { IconButton, Button, Input, Drawer, CloseButton, Icon, INFO, TRASH } from 'dxp-ui';
import { useState } from 'react';
import { chargeAfterWaiverQar, waivedQar, waiverAmountProblem, type NumberWaiver } from '../../engines/numberWaiver';
import { formatQar } from '../../engines/postpaidPricing';
import { DocumentCaptureActions, UPLOAD_RULES, uploadFileProblem, type AdditionalDocument } from '../DocumentUpload';
import { forgetDocumentFile, readFileAsDataUrl, rememberDocumentFile } from '../../lib/documentFileStore';
import { formatBytes } from '../../lib/format';

/**
 * The "Waive Off" action beside Continue on Number Selection: the agent enters a FIXED AMOUNT (QAR) to waive off the Star number's upfront charge - not a
 * percentage. The amount is kept on the journey (`numberWaiver`) and read by Checkout, Payment and the order. Shown only when the chosen number has an
 * upfront charge to waive.
 */
export function WaiveOff({
  chargeQar,
  numberChosen = false,
  waiver,
  onChange,
  document,
  documentRequirement,
  onDocumentChange,
}: {
  chargeQar: number;
  /** A number is chosen: the button then shows even when it has no charge (disabled, saying why). */
  numberChosen?: boolean;
  waiver: NumberWaiver | undefined;
  onChange: (w: NumberWaiver | undefined) => void;
  /** The supporting document already attached to this Additional Discount, when there is one. Given together with `onDocumentChange`, the dialog offers the upload. */
  document?: AdditionalDocument;
  /** The configured document this Additional Discount requires: the upload is attached under it, which is what satisfies Additional Documents later. */
  documentRequirement?: { id: string; label: string };
  onDocumentChange?: (d: AdditionalDocument | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  // The document chosen in the dialog: attached to the journey on Apply only, so Cancel leaves what was attached as it was.
  const [draftDoc, setDraftDoc] = useState<AdditionalDocument | undefined>(document);
  const [fileError, setFileError] = useState<string | null>(null);
  // A file chosen in the dialog is held in memory at once (to be opened later); one that is not applied is forgotten again.
  const dropDraft = () => {
    if (draftDoc && draftDoc.id !== document?.id) forgetDocumentFile(draftDoc.id);
  };
  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = uploadFileProblem(file, UPLOAD_RULES.supporting);
    if (problem) {
      setFileError(problem);
      return;
    }
    setFileError(null);
    dropDraft();
    const id = `${Date.now()}-${file.name}`;
    try {
      rememberDocumentFile(id, await readFileAsDataUrl(file), file.type);
    } catch {
      /* the document is still attached; it just cannot be opened */
    }
    setDraftDoc({ id, label: documentRequirement?.label ?? 'Supporting Document', fileName: file.name, sizeBytes: file.size, requirementId: documentRequirement?.id });
  };
  const close = () => {
    dropDraft();
    setOpen(false);
  };
  if (chargeQar <= 0) {
    return numberChosen ? (
      <Button variant="secondary" disabled title="This number has no amount to pay to discount.">
        Additional Discount
      </Button>
    ) : null;
  }
  const amount = text.trim() === '' ? undefined : Number(text.replace(/,/g, ''));
  const problem = waiverAmountProblem(amount, chargeQar);
  const openDialog = () => {
    setText(waiver ? String(waiver) : '');
    setDraftDoc(document);
    setFileError(null);
    setOpen(true);
  };
  return (
    <>
      <Button variant="secondary" onClick={openDialog}>
        {waiver ? `Additional Discount: ${formatQar(waiver)}` : 'Additional Discount'}
      </Button>
      {/* A side drawer (not a centred modal): the number list stays in view beside it while the agent enters the discount and attaches its document. */}
      <Drawer
        open={open}
        onClose={close}
        title="Additional Discount"
        header={
          <div className="drawer-header">
            <div className="min-w-0">
              <h2 className="title title-xl">Additional Discount</h2>
              <p className="caption-muted">Star Number amount to pay</p>
            </div>
            <CloseButton onClick={close} />
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              // Zero is "no additional discount": it needs no supporting document. Anything above zero does (when the journey offers the upload).
              disabled={Boolean(problem) || (onDocumentChange !== undefined && amount !== 0 && !draftDoc)}
              onClick={() => {
                if (amount === 0) {
                  // Setting the discount to zero removes it, with the document that supported it.
                  onChange(undefined);
                  dropDraft();
                  if (document) forgetDocumentFile(document.id);
                  onDocumentChange?.(undefined);
                  setOpen(false);
                  return;
                }
                if (amount !== undefined) onChange(waivedQar(chargeQar, amount));
                if (onDocumentChange) {
                  if (document && document.id !== draftDoc?.id) forgetDocumentFile(document.id);
                  onDocumentChange(draftDoc);
                }
                setOpen(false);
              }}
            >
              Apply Discount
            </Button>
          </>
        }
      >
        <div className="space-y-5">
        <div className="notice-info row-start gap-3 p-4">
          <Icon path={INFO} className="size-6 shrink-0 text-[var(--tint-blue-fg)]" />
          <div className="min-w-0 space-y-1">
            <p className="title title-sm text-[var(--tint-blue-fg)]">Approval Required</p>
            <p className="text-secondary">
              {onDocumentChange ? 'Orders with additional discounts require approval and supporting documentation.' : 'Orders with additional discounts require approval.'}
            </p>
          </div>
        </div>
          <Input
            label="Discount Amount"
            leadingAddon="QAR"
            helperText={`Maximum: ${formatQar(chargeQar)}. Enter 0 for no additional discount.`}
            required
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, ''))}
            error={text.trim() !== '' ? problem : undefined}
          />
          {onDocumentChange && amount !== 0 && (
            <div className="space-y-1">
              <p className="text-[length:var(--fs-label)] text-fg font-semibold">
                Supporting Document<span className="text-[var(--field-border-error)]" aria-hidden="true"> *</span>
              </p>
              <div className="document-slot">
                <DocumentCaptureActions what="supporting document" documentType={documentRequirement?.label ?? 'Supporting Document'} hasDocument={Boolean(draftDoc)} onFile={(f) => void chooseFile(f)} />
                {draftDoc ? (
                  <>
                    <span className="line-fg-caption">
                      {draftDoc.fileName} <span className="text-muted">({formatBytes(draftDoc.sizeBytes)})</span>
                    </span>
                    <IconButton icon={TRASH} tone="danger" label="Remove the Attached Document" onClick={() => { dropDraft(); setDraftDoc(undefined); }} />
                  </>
                ) : (
                  <span className="caption-muted">{UPLOAD_RULES.supporting.formatsLabel}, up to {UPLOAD_RULES.supporting.maxLabel}</span>
                )}
              </div>
              {fileError && (
                <p role="alert" className="text-danger text-[length:var(--fs-caption)]">
                  {fileError}
                </p>
              )}
            </div>
          )}
          <dl className="summary-panel">
            <div className="split">
              <dt>Amount to Pay</dt>
              <dd>{formatQar(chargeQar)}</dd>
            </div>
            <div className="split">
              <dt>Additional Discount</dt>
              <dd>{formatQar(problem ? 0 : waivedQar(chargeQar, amount))}</dd>
            </div>
            <div className="split summary-total">
              <dt>Payable</dt>
              <dd>{formatQar(problem ? chargeQar : chargeAfterWaiverQar(chargeQar, amount))}</dd>
            </div>
          </dl>
        </div>
      </Drawer>
    </>
  );
}
