// The six GCC states. A GCC ID is recognised as valid only for a citizen of one of them; the ID of a citizen of any other country is not recognised as a
// GCC ID. (Separately, Mobile Postpaid is not permitted with a GCC ID at all: prepaid only - see the eligibility engine.) The app records nationality as the demonym ("Kuwaiti",
// "Emirati"); the country name and the common variants are accepted too, so the check does not depend on how a source spelled it.

export const GCC_CITIZENSHIPS: readonly { country: string; names: readonly string[] }[] = [
  { country: 'Bahrain', names: ['bahraini', 'bahrain'] },
  { country: 'Kuwait', names: ['kuwaiti', 'kuwait'] },
  { country: 'Oman', names: ['omani', 'oman'] },
  { country: 'Qatar', names: ['qatari', 'qatar'] },
  { country: 'Saudi Arabia', names: ['saudi', 'saudi arabian', 'saudi arabia'] },
  { country: 'United Arab Emirates', names: ['emirati', 'emirian', 'uae', 'united arab emirates'] },
];

const GCC_NAMES: ReadonlySet<string> = new Set(GCC_CITIZENSHIPS.flatMap((c) => c.names));

/** True for a citizen of one of the six GCC states; false for any other nationality and for none recorded (unknown is not a GCC citizen). */
export const isGccCitizen = (nationality: string | undefined): boolean => GCC_NAMES.has((nationality ?? '').trim().toLowerCase());

/** The message shown when an ID presented as a GCC ID belongs to a citizen of a country outside the GCC. */
export const GCC_ID_NOT_RECOGNISED_MESSAGE = 'The selected ID is not recognized as a valid GCC ID.';

/** An ID presented as a GCC ID whose recorded nationality is not a GCC state's. No nationality on record is unknown, not a mismatch, so it does not count. */
export const isUnrecognisedGccId = (idType: string | undefined, nationality: string | undefined): boolean =>
  idType === 'GCC ID' && Boolean((nationality ?? '').trim()) && !isGccCitizen(nationality);

/** The error badge's label when the ID presented as a GCC ID does not apply to the customer's nationality. */
export const GCC_ID_NOT_APPLICABLE_LABEL = 'GCC ID Not Applicable';

/** The six states a GCC ID is valid for, as a sentence list ("Bahrain, Kuwait, Oman, Qatar, Saudi Arabia and United Arab Emirates"). */
const GCC_COUNTRY_LIST = `${GCC_CITIZENSHIPS.slice(0, -1).map((c) => c.country).join(', ')} and ${GCC_CITIZENSHIPS[GCC_CITIZENSHIPS.length - 1].country}`;

/** The context shown beside the badge: which nationality was read from the record, and whose GCC ID is valid. */
export const gccIdNotApplicableMessage = (nationality: string | undefined): string =>
  `The customer's nationality (${(nationality ?? '').trim()}) is not a GCC state's, so this GCC ID does not apply. A GCC ID is valid only for citizens of ${GCC_COUNTRY_LIST}.`;
