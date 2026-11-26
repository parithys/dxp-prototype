import { at } from '../summaryKit';
import { paperCopiesOf } from '../../engines/journeyDocuments';
import { type SummaryField } from 'dxp-ui';

export const cafSummary: SummaryField[] = [
  { key: 'type', label: 'CAF Type', type: 'text', value: (v) => at(v, 'caf', 'cafType') },
  { key: 'signed', label: 'Signed', type: 'toggle', value: (v) => Boolean(at(v, 'caf', 'signatureDataUrl')) || paperCopiesOf(at(v, 'caf', 'paperPrimary') as never).length > 0 },
  { key: 'supplementary', label: 'Supplementary Form', type: 'text', optional: true, value: (v) => (at(v, 'actualUser', 'choice') === 'other' && ((at(v, 'caf', 'signatureDataUrl') && at(v, 'caf', 'secondarySignatureDataUrl')) || (paperCopiesOf(at(v, 'caf', 'paperPrimary') as never).length > 0 && paperCopiesOf(at(v, 'caf', 'paperSecondary') as never).length > 0)) ? 'Signed by both' : undefined) },
];
