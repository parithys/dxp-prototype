import type { ReactNode } from 'react';
import { Icon, StatusPortal, Spinner, Button } from 'dxp-ui';
import { describeFailure, failureReference, MAX_RETRIES, type FailureKind, type ServiceName } from '../../engines/serviceCall';
import { ROW_ICON } from '../domain/eligibilityRowsModel';

// The one panel every Customer Verification validation reports through, so the
// five situations an agent can be in look different at a glance and never get
// confused with each other:
//
//   success           green, tick            the check completed and passed
//   business-failure  red, cross             the system ANSWERED and the answer is no
//                                            (ID not found, retiree not confirmed ...)
//   technical         amber, warning         the system did NOT give a usable answer -
//                                            nothing is decided; retry or recover
//   pending           neutral, spinner       the check is in progress
//   retry             amber, spinner         a retry is in progress (attempt n of N)
//
// Colours come from the design tokens already used for those meanings
// (--success, --danger, --warn-*), not new ones.

export type ValidationVariant = 'success' | 'business-failure' | 'technical' | 'pending' | 'retry';


// The same card as the eligibility results (ui-components.css .eligibility-alert): a border all round and a wash in the state's tone, a solid icon tile with a white icon,
// a bold title and full-strength body text. Each state takes the matching result outcome - success = pass (green tick), business failure = hard stop (red cross),
// technical and retry = soft stop (amber warning), pending = a neutral card - so a validation reads exactly like an eligibility result.
const STYLE: Record<ValidationVariant, { card: string; icon: string; tag: string }> = {
  success: { card: 'eligibility-alert-pass', icon: ROW_ICON.pass, tag: 'Validated' },
  'business-failure': { card: 'eligibility-alert-hard-stop', icon: ROW_ICON['hard-stop'], tag: 'Not validated' },
  technical: { card: 'eligibility-alert-soft-stop', icon: ROW_ICON['soft-stop'], tag: 'System issue - unresolved' },
  pending: { card: 'eligibility-alert-pending', icon: ROW_ICON.advisory, tag: 'Validation pending' },
  retry: { card: 'eligibility-alert-soft-stop', icon: ROW_ICON['soft-stop'], tag: 'Retrying' },
};

export function ValidationStatus({
  variant,
  title,
  children,
  actions,
  reference,
  tag,
}: {
  variant: ValidationVariant;
  title: string;
  children?: ReactNode;
  /** Buttons / links offered for this state (Retry, a fallback ...). */
  actions?: ReactNode;
  /** A reference to quote when escalating. */
  reference?: string;
  /** Overrides the default small label above the title. */
  tag?: string;
}) {
  const s = STYLE[variant];
  const busy = variant === 'pending' || variant === 'retry';
  return (
    <StatusPortal>
    <div role={variant === 'technical' || variant === 'business-failure' ? 'alert' : 'status'} className={`eligibility-alert ${s.card}`}>
      <span className="eligibility-alert-icon" aria-hidden={busy ? undefined : true}>
        {busy ? <Spinner size={40} label={title} /> : <Icon path={s.icon} className="" />}
      </span>
      <div className="min-w-0 flex-1 stack gap-1">
        {/* The state, for assistive technology (the icon's shape and colour carry it for the eye): no label above the title, as on every result card. */}
        <p className="sr-only">{tag ?? s.tag}</p>
        <p className="title title-md leading-snug">{title}</p>
        {children && <div className="text-fg text-[length:var(--fs-body)]">{children}</div>}
        {reference && <p className="caption-muted">Reference: {reference}</p>}
        {actions && <div className="cluster gap-2 pt-2">{actions}</div>}
      </div>
    </div>
    </StatusPortal>
  );
}

/**
 * A technical failure, with Retry while attempts remain and a controlled
 * recovery state once they are spent - never an endless retry loop.
 */
export function TechnicalFailure({
  service,
  kind,
  attempts,
  onRetry,
  retrying,
  exhaustedHint,
  extraActions,
}: {
  service: ServiceName;
  kind: FailureKind;
  /** Attempts made so far (the failed one included). */
  attempts: number;
  onRetry?: () => void;
  retrying?: boolean;
  /** What the agent can do once retries are spent (a defined fallback, or save & exit). */
  exhaustedHint?: ReactNode;
  extraActions?: ReactNode;
}) {
  const { title, message } = describeFailure(service, kind);
  const exhausted = attempts >= MAX_RETRIES;
  if (retrying) {
    return (
      <ValidationStatus variant="retry" title="Trying again…" tag={`Retrying - attempt ${Math.min(attempts + 1, MAX_RETRIES)} of ${MAX_RETRIES}`}>
        Attempt {Math.min(attempts + 1, MAX_RETRIES)} of {MAX_RETRIES}. Nothing is decided until the check completes.
      </ValidationStatus>
    );
  }
  return (
    <ValidationStatus
      variant="technical"
      title={title}
      tag={exhausted ? 'System issue - needs follow-up' : kind === 'expired' ? 'Validation expired' : undefined}
      reference={exhausted ? failureReference(service, kind) : undefined}
      actions={
        <>
          {!exhausted && onRetry && (
            <Button size="sm" onClick={onRetry}>
              {kind === 'expired' ? 'Validate again' : `Retry (${attempts} of ${MAX_RETRIES} used)`}
            </Button>
          )}
          {extraActions}
        </>
      }
    >
      <p>{message}</p>
      {exhausted && (
        <p className="mt-1">
          This did not succeed after {MAX_RETRIES} attempts, so retrying is paused to avoid repeated failures.{' '}
          {exhaustedHint ?? 'Use Save as Draft to resume later, or contact support and quote the reference below.'}
        </p>
      )}
    </ValidationStatus>
  );
}
