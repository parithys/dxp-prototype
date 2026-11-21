import { SERVICE_ADDRESS_LABEL } from '../../../data/stepLabels';
import { addressSummary, billingStep, cafSignatureStep, checkoutSummaryStep, fixedPlanSelectionStep, paymentStep } from '../../../capabilities';
import { InstallationAddressForm, InstallationAddressStep, NumberDevicesStep } from './FixedStepViews';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { appointmentBookingStep } from '../../../capabilities';
import type { SummaryField } from '../../../components/patterns/wizard/stepSummary';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import { appointmentSummary } from '../../../components/patterns/wizard/commonSummaries';
import {
  serviceTypeLabel,
  type FixedInstallationValue,
  type FixedDevice,
} from './fixedActivationModel';

type Values = Record<string, unknown>;
const at = (v: Values, ...path: string[]): unknown => path.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Values)[k] : undefined), v);

// ---- 2. Installation Address ---------------------------------------------------------------------------------
export const fixedInstallationSummary: SummaryField[] = [
  { key: 'serviceType', label: 'Service Type', type: 'text', optional: true, value: (v) => serviceTypeLabel(at(v, 'installation', 'serviceType')) },
  ...addressSummary,
];

export function fixedAddressStep(): WizardStep {
  return {
    key: 'address',
    label: SERVICE_ADDRESS_LABEL,
    summary: fixedInstallationSummary,
    render: ({ values, setValue }) => <InstallationAddressStep values={values} setValue={setValue} />,
    isValid: (values) => {
      const a = values.address as ZsbAddressValue | undefined;
      const i = values.installation as FixedInstallationValue | undefined;
      // Unlike the mobile journeys (Mandatory: No), zone, street and building ARE mandatory here: ZSB is required for fixed / fibre /
      // FWA 5G services (business rule BR-174; workshop Day 7), because the address is where the service is installed.
      if (!a?.zone || !a.streetNo || !a.buildingNo) return false;
      // Fixed-Line and 5G Home have no service type; Fibre sets Fiber itself and FWA asks for Indoor or Outdoor.
      if (values.homeProduct === 'fixed-line' || values.homeProduct === '5g-home') return true;
      if (!i?.serviceType) return false;
      return i.serviceType !== 'fiber' || i.rfs === 'rfs';
    },
  };
}

/**
 * New Home Connection's Address, asked first (before Product Selection): the installation address alone - zone, street and building are mandatory (BR-174). What depends on the product
 * (FWA's service type, Fibre's RFS read-out) is judged on Product Selection once the product is chosen.
 */
export function homeAddressStep(): WizardStep {
  return {
    key: 'address',
    label: SERVICE_ADDRESS_LABEL,
    summary: addressSummary,
    render: ({ values, setValue }) => <InstallationAddressForm values={values} setValue={setValue} />,
    isValid: (values) => {
      const a = values.address as ZsbAddressValue | undefined;
      return Boolean(a?.zone && a.streetNo && a.buildingNo);
    },
  };
}

// ---- 3. Plan -------------------------------------------------------------------------------------------------
export const fixedPlanStep = fixedPlanSelectionStep;

// ---- 4. Number & Devices -------------------------------------------------------------------------------------
// The fixed line number is allocated by the system; the devices follow from the service type and plan.
export function fixedNumberStep(): WizardStep {
  return {
    key: 'number',
    label: 'Number & Devices',
    summary: [
      { key: 'msisdn', label: 'Fixed Line Number', type: 'text', value: (v) => at(v, 'msisdn') },
      { key: 'devices', label: 'Devices', type: 'text', optional: true, value: (v) => ((at(v, 'devices') as FixedDevice[] | undefined) ?? []).map((d) => d.name).join(', ') || undefined },
    ],
    render: ({ values, setValue }) => <NumberDevicesStep values={values} setValue={setValue} />,
    isValid: (values) => Boolean(values.msisdn),
  };
}

// ---- 5. Appointment ------------------------------------------------------------------------------------------
export function fixedAppointmentStep(): WizardStep {
  return { ...appointmentBookingStep(), summary: appointmentSummary };
}

// ---- CAF & Signature -----------------------------------------------------------------------------------------
// New Connection's CAF step: the Terms & Conditions sit in their own fixed-height container, for the agent and in the customer-view pop-up alike.
export function fixedCafStep(): WizardStep {
  return cafSignatureStep({ variant: 'full' });
}

/**
 * The Fixed Line steps after Customer Verification and Product Selection (the first two steps of New Connection, which
 * Fixed Line shares with the other products): Installation Address, Billing Profile (resolved for the agent), Plan, Number and
 * Devices, Checkout, CAF, Payment (which moves on once paid) and the installation Appointment, which submits. Covers fibre and
 * both 5G Home (FWA) service types.
 */
export function fixedLineSteps(): WizardStep[] {
  return [fixedAddressStep(), billingStep({ profileSuffix: 'Fixed Line', journey: 'fixed-line' }), fixedPlanStep(), fixedNumberStep(), checkoutSummaryStep(), fixedCafStep(), paymentStep({ submitOnPaid: true }), fixedAppointmentStep()];
}
