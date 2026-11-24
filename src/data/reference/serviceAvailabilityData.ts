// Reference inventory behind the Check RFS "Service Availability" card (Fibre & Home > Plans & Installation): the buildings the
// availability search can find, what each one can be sold there, and the Mobile Broadband offers shown where fibre / 5G Home cannot be.
// Kept as inline reference data, the convention of ticketReferenceData.ts: it is the design's own sample inventory, not a customer
// record, and has no mock-data collection or API endpoint yet. When the live RFS / inventory service exists, the lookup in
// modules/check-rfs/serviceAvailabilityModel.ts is the one place that changes.

import type { ExistingService } from '../../engines/kidInUse';

export type AvailabilityStatusKey = 'RFS_UNLIMITED' | 'RFS_LIMITED' | 'FWA_INDOOR' | 'FWA_OUTDOOR' | 'FWA_BOTH' | 'RFA' | 'EBU' | 'NOT_FOUND';

/** How a service chip reads: on (sellable), limited (capacity-limited), off (not available), neutral (not needed here). */
export type ServiceChipState = 'on' | 'limited' | 'off' | 'neutral';
export type ServiceKey = 'fibre' | 'fwa' | 'mbb';

export interface AvailabilityStatus {
  label: string;
  title: string;
  text: string;
  /** The location can be sold fibre or 5G Home (false: not found or not yet open for sale). */
  sellable: boolean;
  /** The agent must choose FWA Indoor or Outdoor. */
  fwaChoice?: boolean;
  /** Mobile Broadband is offered instead. */
  mbb?: boolean;
  /** Which hub symbol the result shows: the fibre layers, the 5G antenna or the wifi mark. */
  hub: 'layers' | 'antenna' | 'wifi';
  /** What the agent can do next: start the fibre or 5G Home connection, or - where neither is sold (RFA, not found, an EBU building) - continue to Mobile Postpaid Activation with the Mobile Broadband offers. */
  proceed: 'fibre' | 'fwa' | 'mbb';
  services: Record<ServiceKey, [ServiceChipState, string]>;
}

export const AVAILABILITY_STATUS: Record<AvailabilityStatusKey, AvailabilityStatus> = {
  RFS_UNLIMITED: { label: 'RFS Unlimited', title: 'Service Available', text: 'Fibre is ready for sale at this building with no capacity limit.', sellable: true, hub: 'layers', proceed: 'fibre',
    services: { fibre: ['on', 'Unlimited'], fwa: ['neutral', 'Not required'], mbb: ['on', 'Available'] } },
  RFS_LIMITED: { label: 'RFS Limited', title: 'Service Available', text: 'Fibre is ready for sale at this building with limited capacity.', sellable: true, hub: 'layers', proceed: 'fibre',
    services: { fibre: ['limited', 'Limited'], fwa: ['neutral', 'Not required'], mbb: ['on', 'Available'] } },
  FWA_INDOOR: { label: 'FWA Indoor', title: 'Service Available', text: 'Fibre is not available; this location can be served with FWA Indoor.', sellable: true, hub: 'antenna', proceed: 'fwa',
    services: { fibre: ['off', 'Not available'], fwa: ['on', 'Available · Indoor'], mbb: ['on', 'Available'] } },
  FWA_OUTDOOR: { label: 'FWA Outdoor', title: 'Service Available', text: 'Fibre is not available; this location can be served with FWA Outdoor.', sellable: true, hub: 'antenna', proceed: 'fwa',
    services: { fibre: ['off', 'Not available'], fwa: ['on', 'Available · Outdoor'], mbb: ['on', 'Available'] } },
  FWA_BOTH: { label: 'FWA Indoor & Outdoor', title: 'Service Available', text: 'Fibre is not available; this location can be served with FWA Indoor or FWA Outdoor.', sellable: true, fwaChoice: true, hub: 'antenna', proceed: 'fwa',
    services: { fibre: ['off', 'Not available'], fwa: ['on', 'Available · Indoor & Outdoor'], mbb: ['on', 'Available'] } },
  RFA: { label: 'Building Is RFA', title: 'Service Not Available', text: 'This building is Ready For Activation (RFA) and not yet open for sale.', sellable: false, mbb: true, hub: 'wifi', proceed: 'mbb',
    services: { fibre: ['off', 'RFA · Not open for sale'], fwa: ['off', 'Not available'], mbb: ['on', 'Available'] } },
  EBU: { label: 'EBU', title: 'Enterprise Building', text: 'This is an Enterprise Business Unit (EBU) building and is not sold through this journey. Mobile Broadband is offered instead.', sellable: false, mbb: true, hub: 'layers', proceed: 'mbb',
    services: { fibre: ['off', 'EBU · Not sold here'], fwa: ['off', 'Not available'], mbb: ['on', 'Available'] } },
  NOT_FOUND: { label: 'Building/KID/VFID Not Found', title: 'Service Not Available', text: 'No building, KID or VFID matches this search.', sellable: false, mbb: true, hub: 'wifi', proceed: 'mbb',
    services: { fibre: ['off', 'Not available'], fwa: ['off', 'Not available'], mbb: ['on', 'Available'] } },
};

export const SERVICE_DEFS: { key: ServiceKey; name: string }[] = [
  { key: 'fibre', name: 'Fibre' },
  { key: 'fwa', name: '5G Home' },
  { key: 'mbb', name: 'Mobile Broadband' },
];

export interface AvailabilityUnit {
  unit: string;
  floor: string;
  kid: string;
  vfid: string;
  state: string;
  patch: string | null;
  /** Installation SLA in hours; null when there is none (not yet open for sale). */
  sla: string | null;
  /** From the Service Feasibility response: a device already installed at the location, and whether the response says it can be reused. Absent: the response names no device. */
  device?: { model: string; reusable: boolean };
  /** From the same response: a service the KID already carries (Active or Suspended) - the KID is in use. Absent: nothing on it. */
  existingService?: ExistingService;
  /** From the same response: the splitter serving the unit is full, or not mapped to it. Absent: the response says nothing about the splitter. */
  splitter?: 'full' | 'not-mapped';
}

/**
 * What UIM holds for a device model: whether it supports Zero Touch activation. The one mapping between a device model and its Zero Touch capability - the feasibility response names the
 * model and says whether it can be reused, and this says what that model can do. A model not listed here is unknown, never assumed either way.
 * Demo entries (2026-11-22): the models are sample ONT / gateway names, not a record from the workbooks.
 */
export const DEVICE_ZERO_TOUCH: Record<string, boolean> = {
  'Huawei HG8145V5': true,
  'ZTE F670L': true,
  'Nokia G-240W-C': false,
  'Huawei HG8245H': false,
};

export interface AvailabilityBuilding {
  name: string;
  area: string;
  zone: string;
  street: string;
  building: string;
  status: Exclude<AvailabilityStatusKey, 'NOT_FOUND'>;
  units: AvailabilityUnit[];
}

export const AVAILABILITY_BUILDINGS: AvailabilityBuilding[] = [
  { name: 'Al Waab Residence Tower', area: 'Al Waab', zone: '55', street: '830', building: '12', status: 'RFS_UNLIMITED',
    units: [
      { unit: '101', floor: '1', kid: 'KID-55830120-101', vfid: 'WAB-0012-A', state: 'Available', patch: 'Prepatched', sla: '24', device: { model: 'Huawei HG8145V5', reusable: true } },
      { unit: '102', floor: '1', kid: 'KID-55830120-102', vfid: 'WAB-0012-B', state: 'Available', patch: 'Prepatched', sla: '24', device: { model: 'Nokia G-240W-C', reusable: true }, splitter: 'full' },
      { unit: '201', floor: '2', kid: 'KID-55830120-201', vfid: 'WAB-0012-C', state: 'In Service', patch: 'Prepatched', sla: '24', device: { model: 'Huawei HG8245H', reusable: false }, existingService: { fln: '44201201', status: 'Active', pon: 'PON-WAB-12-01' } },
      { unit: '202', floor: '2', kid: 'KID-55830120-202', vfid: 'WAB-0012-D', state: 'In Service', patch: 'Not Yet Patched', sla: '48', existingService: { fln: '44201202', status: 'Suspended', pon: 'PON-WAB-12-02' } },
    ] },
  { name: 'West Bay Pearl Heights', area: 'West Bay', zone: '66', street: '840', building: '24', status: 'RFS_LIMITED',
    units: [{ unit: '1402', floor: '14', kid: 'KID-66840240-1402', vfid: 'WBY-0024-A', state: 'Available', patch: 'Not Yet Patched', sla: '72', device: { model: 'ZTE F670L', reusable: true }, splitter: 'not-mapped' }] },
  { name: 'Lusail Marina Villas', area: 'Lusail', zone: '69', street: '350', building: '7', status: 'FWA_INDOOR',
    units: [{ unit: 'Villa 1', floor: 'G', kid: 'KID-69350070-1', vfid: 'LUS-0007-A', state: 'Available', patch: null, sla: '24', device: { model: 'ZTE F670L', reusable: true } }] },
  { name: 'Wakrah Garden Compound', area: 'Al Wakrah', zone: '71', street: '910', building: '3', status: 'FWA_OUTDOOR',
    units: [{ unit: 'Villa 3', floor: 'G', kid: 'KID-71910030-1', vfid: 'WAK-0003-A', state: 'Available', patch: null, sla: '48' }] },
  { name: 'Wakrah Palm Villas', area: 'Al Wakrah', zone: '72', street: '120', building: '5', status: 'FWA_BOTH',
    units: [{ unit: 'Villa 5', floor: 'G', kid: 'KID-72120050-1', vfid: 'WAK-0005-A', state: 'Available', patch: null, sla: '48' }] },
  { name: 'West Bay Business Tower', area: 'West Bay', zone: '63', street: '810', building: '40', status: 'EBU',
    units: [{ unit: 'Floor 12', floor: '12', kid: 'KID-63810040-1', vfid: 'WBT-0040-A', state: 'Enterprise', patch: null, sla: null }] },
  { name: 'Fox Hills Block 15', area: 'Lusail', zone: '91', street: '1010', building: '15', status: 'RFA',
    units: [{ unit: 'A', floor: 'G', kid: 'KID-91101015-1', vfid: 'FOX-0015-A', state: 'Not Ready', patch: null, sla: null }] },
];

export interface MbbOffer {
  id: string;
  name: string;
  data: string;
  price: number;
  terms: string;
}

export const MBB_OFFERS: MbbOffer[] = [
  { id: 'mbb50', name: 'Mobile Broadband 50', data: '50 GB', price: 100, terms: '12 months · 4G/5G MiFi included' },
  { id: 'mbb150', name: 'Mobile Broadband 150', data: '150 GB', price: 175, terms: '12 months · 5G MiFi included' },
  { id: 'mbbU', name: 'Mobile Broadband Unlimited', data: 'Unlimited', price: 275, terms: '24 months · 5G Home Router included' },
];
