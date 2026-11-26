import { HOME_ADDRESS_LABEL, NUMBER_SELECTION_LABEL, SERVICE_ADDRESS_LABEL } from '../../../data/stepLabels';
import { simTypeStep, addressSummary, billingStep, cafSignatureStep, checkoutSummaryStep, fixedPlanSelectionStep, homeAddonsStep, paymentStep } from '../../../capabilities';
import { InstallationAddressForm, InstallationAddressStep, NumberDevicesStep } from './FixedStepViews';
import { DeviceScanPanel } from './DeviceScan';
import { isDeviceScanComplete, scansInJourney, serviceTypeOfOrder, validatedDevices } from './activationMode';
import { isFixedNumberAutoAllocated, isFwaService, type IndoorUnitDetails } from './fixedActivationModel';
import { InstallationAddressView } from './InstallationAddressView';
import { isInstallationAddressValid } from './installationAddress';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import { appointmentBookingStep } from '../../../capabilities';
import { appointmentSummary } from '../../../components/patterns/wizard/commonSummaries';
import {
  serviceTypeLabel,
  type FixedInstallationValue,
  type FixedDevice,
} from './fixedActivationModel';
import { type SummaryField, type WizardStep } from 'dxp-ui';

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
    // New Home Connection names it for what it is: where the service is installed.
    label: HOME_ADDRESS_LABEL,
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

// ---- 4. Number Selection -------------------------------------------------------------------------------------
// The fixed line number is allocated by the system; the devices follow from the service type and plan.
export function fixedNumberStep(): WizardStep {
  return {
    key: 'number',
    label: NUMBER_SELECTION_LABEL,
    summary: [
      { key: 'msisdn', label: 'Fixed Line Number', type: 'text', value: (v) => at(v, 'msisdn') },
      { key: 'devices', label: 'Devices', type: 'text', optional: true, value: (v) => ((at(v, 'devices') as FixedDevice[] | undefined) ?? []).map((d) => d.name).join(', ') || undefined },
    ],
    render: ({ values, setValue, goNext }) => <NumberDevicesStep values={values} setValue={setValue} goNext={goNext} />,
    isValid: (values) => Boolean(values.msisdn),
    // No number reserved for the customer: the system allocates one and Continue passes over this page, which stays in the rail for the agent to view or change the number.
    autoPass: isFixedNumberAutoAllocated,
  };
}

/** An Instant Activation order's SIM Type (FWA) and the devices in its cart - ONT / CPE, set-top boxes, Mesh - read back on the Order Summary and the CAF. A Field Engineer order has none: the field engineer scans. */
export const deviceOrderRows = (values: Values): { label: string; value: string }[] => {
  if (!scansInJourney(values)) return [];
  const sim = values.simType as { simType?: string } | undefined;
  const unit = values.indoorUnit as IndoorUnitDetails | undefined;
  return [
    ...(isFwaService(values) ? [{ label: 'SIM Type', value: sim?.simType ?? 'Physical' }] : []),
    ...validatedDevices(values).map(({ row, device }) => ({ label: `${row.label}`, value: device.serial + (device.model ? ` (${[device.brand, device.model].filter(Boolean).join(' ')})` : '') })),
    ...(unit?.macAddress ? [{ label: 'Indoor Unit MAC Address', value: unit.macAddress }] : []),
  ];
};

// ---- 4b. Device Scanning (Instant Activation) -----------------------------------------------------------------
// Instant Activation only (the Check RFS Activate button, for a role that scans): a Fiber order scans its ONT; an FWA Indoor order scans its CPE and a Physical SIM. Either also scans the set-top boxes and Mesh
// extenders it carries. A Field Engineer order has no scanning here - the field engineer does it (WFM) - and books the installation appointment instead.
export function deviceScanStep(): WizardStep {
  return {
    key: 'deviceScan',
    label: 'Optical Network Terminal (ONT) Device',
    summary: [{ key: 'devices', label: 'Devices', type: 'text', optional: true, value: (v) => validatedDevices(v).map(({ row, device }) => `${row.label.replace(' Serial Number', '')} ${device.serial}`).join(', ') || undefined }],
    skip: (values) => !scansInJourney(values) || serviceTypeOfOrder(values) !== 'fiber',
    render: ({ values, setValue }) => <DeviceScanPanel values={values} setValue={setValue} />,
    isValid: (values) => isDeviceScanComplete(values),
  };
}

// ---- 4c. Device & SIM Scanning (FWA Indoor, Instant Activation) ------------------------------------------------
// After the allocated Fixed Line Number: a Physical SIM only (scanned or typed, checked against inventory) and the devices - CPE, set-top boxes, Mesh - each scanned or entered and validated into the cart.
export function fwaSimStep(): WizardStep {
  const base = simTypeStep({ physicalOnly: true });
  return {
    ...base,
    key: 'fwaSim',
    label: 'Device & SIM Scanning (CPE)',
    skip: (values) => !isFwaService(values) || !scansInJourney(values),
    summary: [...(base.summary ?? []), { key: 'devices', label: 'Devices', type: 'text', optional: true, value: (v) => validatedDevices(v).map(({ row, device }) => `${row.label.replace(' Serial Number', '')} ${device.serial}`).join(', ') || undefined }],
    render: (ctx) => (
      <div className="space-y-6 scan-rows">
        {base.render(ctx)}
        <DeviceScanPanel values={ctx.values} setValue={ctx.setValue} />
      </div>
    ),
    // Physical only: a leftover eSIM choice does not satisfy it. And every device the order needs is in the cart.
    isValid: (values) => (values.simType as { simType?: string } | undefined)?.simType === 'Physical' && (base.isValid?.(values) ?? false) && isDeviceScanComplete(values),
  };
}

// ---- 4d. Installation Address (after Number Selection for Fibre, after SIM Selection for FWA) ---------------------
// Populated from the RFS data (or UIM) for the selected KID and read-only; with no KID, captured manually (ZSB read-only, Area derived, Unit / Apartment / Flat mandatory). Only for an order that came
// from Check RFS: the other entries to the journey ask for the address on their own page, first.
const homeInstallationSummary: SummaryField[] = [
  { key: 'zone', label: 'Zone', type: 'text', optional: true, value: (v) => at(v, 'address', 'zone') },
  { key: 'street', label: 'Street No.', type: 'text', optional: true, value: (v) => at(v, 'address', 'streetNo') },
  { key: 'building', label: 'Building No.', type: 'text', optional: true, value: (v) => at(v, 'address', 'buildingNo') },
  { key: 'unit', label: 'Flat / Unit', type: 'text', optional: true, value: (v) => at(v, 'address', 'aptFlatUnit') },
  { key: 'area', label: 'Area', type: 'text', optional: true, value: (v) => at(v, 'address', 'area') },
  { key: 'floor', label: 'Floor', type: 'text', optional: true, value: (v) => at(v, 'address', 'floor') },
  { key: 'city', label: 'City', type: 'text', optional: true, value: (v) => at(v, 'address', 'city') },
];

export function homeInstallationAddressStep(): WizardStep {
  return {
    key: 'installationAddress',
    label: HOME_ADDRESS_LABEL,
    summary: homeInstallationSummary,
    skip: (values) => !values.rfsCheck,
    render: ({ values, setValue }) => <InstallationAddressView values={values} setValue={setValue} />,
    isValid: isInstallationAddressValid,
  };
}

// ---- 5. Appointment ------------------------------------------------------------------------------------------
export function fixedAppointmentStep(): WizardStep {
  // Instant Activation has no installation visit: the devices are scanned in the journey. Field Engineer (and Outdoor, and any entry with no mode) books the appointment.
  return { ...appointmentBookingStep(), summary: appointmentSummary, skip: (values) => scansInJourney(values) };
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
export function fixedLineSteps(opts: { planSettled?: (values: Values) => boolean } = {}): WizardStep[] {
  // `planSettled`: an accepted offer already settled the plan (and its credit check), so Offers & Plans is passed over, and the Order Summary's Edit returns to Number & Devices instead.
  const { planSettled } = opts;
  const plan = planSettled ? { ...fixedPlanStep(), skip: planSettled } : fixedPlanStep();
  const checkout = checkoutSummaryStep({ familyRows: deviceOrderRows, ...(planSettled ? { editStepKey: (v: Values) => (planSettled(v) ? 'number' : 'plan') } : {}) });
  return [fixedAddressStep(), plan, homeAddonsStep({ deviceSerials: scansInJourney }), fixedNumberStep(), deviceScanStep(), fwaSimStep(), homeInstallationAddressStep(), billingStep({ profileSuffix: 'Fixed Line', journey: 'fixed-line', homeBillingAddress: true }), checkout, fixedCafStep(), paymentStep({ submitOnPaid: true }), fixedAppointmentStep()];
}
