import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import type { SummaryField } from '../../../components/patterns/wizard/stepSummary';
import { SERVICE_FEASIBILITY_LABEL } from '../../../data/stepLabels';
import { AVAILABILITY_STATUS } from '../../../data/reference/serviceAvailabilityData';
import type { RfsCheckValue } from '../rfsStart';
import { BackToCheckRfs } from './BackToCheckRfs';
import type { ProductStepContext } from './ProductSelection';

// Service Feasibility as a step of New Home Connection: the Check RFS result the journey started from, kept in the Journey Summary after the agent moves on (Contact, Recommended Offers, Service
// Feasibility, Recommended Offers, ...). The check was made on Check RFS, so there is nothing to do here: the journey opens past it, and Back (or Edit) from the page after it returns to Check RFS
// - the page the step stands for - with the customer carried over, rather than skipping it. It exists only for a journey that began there.

const rfsOf = (v: Record<string, unknown>) => v.rfsCheck as RfsCheckValue | undefined;
const address = (v: Record<string, unknown>) => v.address as { zone?: string; streetNo?: string; buildingNo?: string; aptFlatUnit?: string; area?: string } | undefined;

const feasibilitySummary: SummaryField[] = [
  { key: 'result', label: 'Result', type: 'text', value: (v) => (rfsOf(v) ? AVAILABILITY_STATUS[rfsOf(v)!.status]?.label : undefined) },
  { key: 'fwaType', label: '5G Home Type', type: 'text', optional: true, value: (v) => rfsOf(v)?.fwaType },
  { key: 'building', label: 'Building', type: 'text', optional: true, value: (v) => rfsOf(v)?.buildingName },
  { key: 'location', label: 'Zone / Street / Building', type: 'text', optional: true, value: (v) => { const a = address(v); return a?.zone ? [a.zone, a.streetNo, a.buildingNo].filter(Boolean).join(' / ') : undefined; } },
  { key: 'kid', label: 'KID', type: 'text', optional: true, value: (v) => rfsOf(v)?.kid },
  { key: 'vfid', label: 'VFID', type: 'text', optional: true, value: (v) => rfsOf(v)?.vfid },
];

export function serviceFeasibilityStep(ctx: ProductStepContext): WizardStep {
  return {
    key: 'feasibility',
    label: SERVICE_FEASIBILITY_LABEL,
    summary: feasibilitySummary,
    skip: (values) => !rfsOf(values),
    render: ({ values }) => <BackToCheckRfs ctx={ctx} values={values} />,
    isValid: () => true,
  };
}
