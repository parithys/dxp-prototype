// Shared scaffolding for the Application Examples (not a story). It is NOT a second wizard: the examples compose the production capabilities and their
// real `WizardStep` definitions (render / isValid / summary / primaryAction), and this small frame only supplies what the journey shell would -
// one values object, a Back / Continue footer gated by the step's own `isValid`, and the production Journey Summary panel fed by the steps' own `summary`.
// Nothing here styles anything: layout uses the app's semantic classes only.
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Card } from 'dxp-ui';
import { docsParameters } from '../_shared/docs';
import type { ComponentDocs } from '../_shared/docs';
import { StepSummaryPanel } from '../../src/components/patterns/wizard/StepSummaryPanel';
import type { CompletedSummaryStep } from '../../src/components/patterns/wizard/StepSummaryPanel';
import type { WizardStep } from '../../src/components/patterns/wizard/guidedWizardTypes';

export type Values = Record<string, unknown>;
export type SetValue = (field: string, value: unknown) => void;

/** The values object a journey keeps (one record, written by field), with the same `setValue` the steps receive. */
export function useDraft(initial: Values = {}) {
  const [values, setValues] = useState<Values>(initial);
  const setValue = useCallback<SetValue>((field, value) => setValues((v) => ({ ...v, [field]: value })), []);
  return { values, setValue, setValues };
}

const noop = () => undefined;
const noopAsync = async () => undefined;

/** The context a step's `render` / `primaryAction` receive from the journey, for a step shown on its own. */
export function stepContext(values: Values, setValue: SetValue, goNext: () => void = noop, goToStepKey: (key: string) => void = noop) {
  return { values, setValue, goNext, goToStepKey, saveDraft: noopAsync, saveAndExit: noopAsync, requestAbandon: noop };
}

/**
 * A few real steps in a row with the journey's shared state: the step on screen, its Back / Continue footer (Continue is disabled until the step's own
 * `isValid` says so, and the step's `primaryAction` replaces it where it has one), and the production Journey Summary beside it, listing the
 * completed steps from their own `summary` declarations. `extra` renders under the card with the live values (a panel that reads the same state).
 */
export function StepFlow({
  steps,
  initial,
  startAt,
  summary = true,
  finishLabel = 'Save & Finish',
  onFinish,
  extra,
}: {
  steps: WizardStep[];
  initial?: Values;
  /** The key of the step to open on (earlier steps count as completed). */
  startAt?: string;
  summary?: boolean;
  finishLabel?: string;
  onFinish?: (values: Values) => void;
  extra?: (values: Values, setValue: SetValue) => ReactNode;
}) {
  const { values, setValue } = useDraft(initial);
  const active = useMemo(() => steps.filter((s) => !s.skip?.(values)), [steps, values]);
  const startIndex = startAt ? Math.max(0, active.findIndex((s) => s.key === startAt)) : 0;
  const [index, setIndex] = useState(startIndex);
  const [reached, setReached] = useState(startIndex);
  const [finished, setFinished] = useState(false);
  const step = active[Math.min(index, active.length - 1)];
  const last = index >= active.length - 1;
  const valid = step.isValid?.(values) ?? true;
  const go = (to: number) => {
    setIndex(to);
    setReached((r) => Math.max(r, to));
  };
  const goNext = () => {
    if (last) {
      setFinished(true);
      onFinish?.(values);
    } else go(index + 1);
  };
  const goToStepKey = (key: string) => {
    const to = active.findIndex((s) => s.key === key);
    if (to >= 0 && to <= reached) setIndex(to);
  };
  const defaultButton = (
    <Button disabled={!valid} onClick={goNext}>
      {last ? finishLabel : 'Continue'}
    </Button>
  );
  const completed: CompletedSummaryStep[] = active.map((s, i) => ({ index: i, step: s })).filter(({ index: i, step: s }) => i < index && (s.summary || s.extraSummary));
  const current: CompletedSummaryStep = { index, step };
  const panelProps = { completed, current, totalSteps: active.length, values, onEdit: (i: number) => setIndex(i) };
  return (
    <>
    {steps.map((s) => (
      <span key={s.key}>{s.headless?.({ values, setValue })}</span>
    ))}
    <div className="row-start gap-6">
      <div className="min-w-0 flex-1 stack gap-6">
        <Card className="p-6 stack gap-6" aria-label={`${step.label} step`}>
          <div className="row-between">
            <div>
              {step.eyebrow && <p className="eyebrow">{step.eyebrow}</p>}
              <h2 className="title title-xl">{step.headingFor?.(values) ?? step.heading ?? step.label}</h2>
              {step.subheading && <p className="text-secondary">{step.subheading}</p>}
            </div>
            {step.headerAction?.({ values, setValue })}
          </div>
          {step.render(stepContext(values, setValue, goNext, goToStepKey))}
          <div className="row-between divider-top pt-4">
            <div>{index > 0 && <Button variant="secondary" onClick={() => go(index - 1)}>Back</Button>}</div>
            <div className="row">
              {step.primaryAction ? step.primaryAction({ values, setValue, goNext, abandon: noop, defaultButton }) : defaultButton}
            </div>
          </div>
        </Card>
        {finished && (
          <p role="status" className="notice-success pad-row">
            The journey would submit here. Nothing was written: this example holds its state locally.
          </p>
        )}
        {extra?.(values, setValue)}
        {summary && <StepSummaryPanel {...panelProps} variant="accordion" />}
      </div>
      {summary && <StepSummaryPanel {...panelProps} />}
    </div>
    </>
  );
}

/** Renders one step on its own, with its real footer logic, for a scenario that is a single page (no Back / summary). */
export function SinglePage({ step, initial, extra, finishLabel = 'Continue' }: { step: WizardStep; initial?: Values; extra?: (values: Values, setValue: SetValue) => ReactNode; finishLabel?: string }) {
  return <StepFlow steps={[step]} initial={initial} summary={false} extra={extra} finishLabel={finishLabel} />;
}

/**
 * The `parameters` every example's meta carries: the documentation block, a full-width canvas, and the docs page showing each story in its own frame
 * (the Journey Summary panel only appears from the `lg` breakpoint, so a narrow inline docs canvas would hide it).
 */
export const exampleParameters = (docs: ComponentDocs, iframeHeight = 900, layout: 'fullscreen' | 'padded' = 'fullscreen') => ({
  layout,
  docs: { ...docsParameters(docs).docs, story: { inline: false, iframeHeight } },
});
