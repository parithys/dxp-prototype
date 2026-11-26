/**
 * Synthetic stand-in for GTM (the geographic / address master) in the prototype. Two things come from it:
 *   - the AREA NAME, derived from the Zone Number (every zone belongs to one area);
 *   - the BUILDING NAME, which GTM holds for some addresses only. A record names an address by zone / street / building, and, when it carries a `unit`, speaks for
 *     that flat alone (a flat whose record has no name has no building name, whatever the building's other records say). No record, or a record without a
 *     name: the building name is blank and only the Area Name is shown.
 */
export const GTM_ZONES: Record<string, string> = {
  '55': 'Al Waab',
  '63': 'West Bay',
  '66': 'West Bay',
  '69': 'Lusail',
  '71': 'Al Wakrah',
  '72': 'Al Wakrah',
  '91': 'Lusail',
};

export interface GtmAddress {
  zone: string;
  street: string;
  building: string;
  /** The flat this record is about; absent = the building as a whole. */
  unit?: string;
  /** Absent = GTM has no building name here. */
  name?: string;
}

export const GTM_ADDRESSES: GtmAddress[] = [
  { zone: '55', street: '830', building: '12', name: 'Al Waab Residence Tower' },
  // Flat 102 has its own GTM record, with no building name.
  { zone: '55', street: '830', building: '12', unit: '102' },
  { zone: '66', street: '840', building: '24', name: 'West Bay Pearl Heights' },
  { zone: '69', street: '350', building: '7', name: 'Lusail Marina Villas' },
  { zone: '71', street: '910', building: '3', name: 'Wakrah Garden Compound' },
  { zone: '72', street: '120', building: '5', name: 'Wakrah Palm Villas' },
  { zone: '63', street: '810', building: '40', name: 'West Bay Business Tower' },
  { zone: '91', street: '1010', building: '15', name: 'Fox Hills Block 15' },
];
