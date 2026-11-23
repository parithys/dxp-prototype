import type { CustomerTypeValue } from '../CustomerType/customerTypeModel';
import { isCustomerTypeValid } from '../CustomerType/customerTypeModel';

/**
 * The Special Discount a plan page offers: one (Consumer B2B2C, Retiree or MADA) once it is validated - its details given and, for Retiree and MADA, the supporting document scanned and
 * accepted; 'none' for a Standard customer (nothing chosen, or the benefit rejected); undefined while the journey has no such choice. The Special Offers tab appears only for a type.
 */
export const specialTypeOf = (values: Record<string, unknown>) =>
  ((v) => (v ? (v.type && v.type !== 'none' && !v.rejected && isCustomerTypeValid(v) ? v.type : 'none') : undefined))(values.customerType as CustomerTypeValue | undefined);
