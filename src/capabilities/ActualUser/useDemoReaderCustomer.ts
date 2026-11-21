import { useEffect, useState } from 'react';
import { pickDemoReaderCustomer, pickDemoUnderEighteenCustomer } from './actualUserModel';
import { listEntities } from '../../services/entityOps';

/**
 * The demo has no card reader: the simulated one presents some customer's own document. For the primary customer that is the one on screen; for the
 * actual user it must be SOMEONE ELSE who qualifies, so the two never share details. Chosen by rule, not by name: the first customer aged 18 or over, other
 * than the primary, holding an unexpired QID with a real QID number (11-14 digits). Undefined until the data loads, or when nobody qualifies.
 */

/**
 * The demo has no card reader: the simulated one presents some customer's own document. For the primary customer that is the one on screen; for the
 * actual user it must be SOMEONE ELSE who qualifies, so the two never share details. Chosen by rule, not by name: the first customer aged 18 or over, other
 * than the primary, holding an unexpired QID with a real QID number (11-14 digits). Undefined until the data loads, or when nobody qualifies.
 */
export function useDemoReaderCustomer(primaryCustomerId: string | undefined, asOf?: Date): string | undefined {
  const [id, setId] = useState<string | undefined>();
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listEntities<{ customerId: string; dob?: string }>('customers'),
      listEntities<{ customerId: string; documentType: string; documentNumber: string; expiryDate?: string }>('identity-documents'),
    ]).then(([customers, docs]) => {
      if (cancelled) return;
      const hit = pickDemoReaderCustomer(customers, docs, primaryCustomerId, asOf ?? new Date());
      setId(hit);
    });
    return () => {
      cancelled = true;
    };
  }, [primaryCustomerId, asOf]);
  return id;
}

/** The customer the reader presents for "Scan Below 18": under 18 and of the primary contact's nationality (see pickDemoUnderEighteenCustomer). Undefined until the data loads, or when nobody qualifies. */

/** The customer the reader presents for "Scan Below 18": under 18 and of the primary contact's nationality (see pickDemoUnderEighteenCustomer). Undefined until the data loads, or when nobody qualifies. */
export function useDemoUnderEighteenCustomer(primaryCustomerId: string | undefined, primaryNationality: string | undefined, asOf?: Date): string | undefined {
  const [id, setId] = useState<string | undefined>();
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listEntities<{ customerId: string; dob?: string; nationality?: string }>('customers'),
      listEntities<{ customerId: string; documentType: string; documentNumber: string; expiryDate?: string }>('identity-documents'),
    ]).then(([customers, docs]) => {
      if (!cancelled) setId(pickDemoUnderEighteenCustomer(customers, docs, primaryCustomerId, primaryNationality, asOf ?? new Date()));
    });
    return () => {
      cancelled = true;
    };
  }, [primaryCustomerId, primaryNationality, asOf]);
  return id;
}
