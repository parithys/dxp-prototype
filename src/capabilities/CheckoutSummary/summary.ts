import { at, qar } from '../summaryKit';
import { type SummaryField } from 'dxp-ui';

export const checkoutSummary: SummaryField[] = [
  { key: 'due', label: 'Total Payable Today', type: 'text', value: (v) => qar(at(v, 'checkoutTotals', 'dueTodayQar')) },
  { key: 'monthly', label: 'Monthly Recurring', type: 'text', value: (v) => qar(at(v, 'checkoutTotals', 'monthlyRecurringQar')) },
];
