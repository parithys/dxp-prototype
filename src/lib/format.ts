// The app's money, date and size formatting. The implementation is the library's (`dxp-ui`); this file only binds the app's one currency (QAR) so call sites read the same as ever.
export { formatAmount, formatAmountAny, formatDate, formatTime, formatDateTime, formatMonthYear, pagesLabel, fileSizeLabel, formatBytes } from 'dxp-ui';
import { formatMoney, formatMoneyAny, formatMoneyLoose } from 'dxp-ui';

const CURRENCY = 'QAR';

/** "QAR 1,500" - whole amounts have no decimals, fractional amounts always have two ("QAR 112.50"). */
export const formatQar = (amount: number, opts: { nbsp?: boolean } = {}): string => formatMoney(CURRENCY, amount, opts);
/** formatQar for any value: a number, or text that holds one ("12.5"), is formatted; other text passes through after "QAR ". */
export const formatQarAny = (v: unknown): string => formatMoneyAny(CURRENCY, v);
/** formatQar for a value that may be missing or not a number: numbers format, other text passes through, empty is undefined. */
export const formatQarLoose = (v: unknown): string | undefined => formatMoneyLoose(CURRENCY, v);
