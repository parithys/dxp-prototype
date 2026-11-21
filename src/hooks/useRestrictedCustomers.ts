import { useEffect, useMemo, useState } from 'react';
import { canViewCustomerSegment } from '../engines/agentPrivilegeEngine';
import { buildRestrictedIndex, type SegmentRow } from '../engines/restrictedCustomers';
import { useAppSelector } from '../stores/hooks';
import { listEntities } from '../services/entityOps';

/**
 * Which customers the signed-in role may NOT see (Safwa, Safwa+, Royal without the matching grant), for every screen that lists or opens records
 * that belong to a customer: orders, tickets, tasks, queue facts. Until the customers have loaded nothing is known, so nothing is shown (see
 * engines/restrictedCustomers).
 */

/**
 * Which customers the signed-in role may NOT see (Safwa, Safwa+, Royal without the matching grant), for every screen that lists or opens records
 * that belong to a customer: orders, tickets, tasks, queue facts. Until the customers have loaded nothing is known, so nothing is shown (see
 * engines/restrictedCustomers).
 */
export function useRestrictedCustomers() {
  const personaId = useAppSelector((s) => s.persona.activePersonaId);
  const [customers, setCustomers] = useState<SegmentRow[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void listEntities<SegmentRow>('customers').then((all) => {
      if (!cancelled) setCustomers(all);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return useMemo(() => buildRestrictedIndex(customers, (segment) => canViewCustomerSegment(personaId, segment)), [customers, personaId]);
}
