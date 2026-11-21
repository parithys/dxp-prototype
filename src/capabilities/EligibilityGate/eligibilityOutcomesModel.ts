import { buildEligibilityRows } from '../../components/domain/eligibilityRowsModel';
import type { EligibilityRow } from '../../components/domain/eligibilityRowsModel';
import { evaluateEligibilityChecks } from '../../engines/eligibilityEngine';
import type { EligibilityContext } from '../../engines/eligibilityEngine';
import { evaluateRule } from '../../engines/ruleEngine';

const SAMPLE_ASOF = new Date('2026-09-30');

const baseCtx = (): EligibilityContext => ({
  customer: { customerId: 'SAMPLE', idType: 'QID', dob: '1985-03-12', blacklisted: false },
  doc: { documentType: 'QID', documentNumber: 'SAMPLE', expiryDate: '2029-11-30' },
  deals: [],
  outstandingQar: 0,
  lineCapReached: false,
  activeLinesDetail: '',
});

function rowFor(checkId: string, ctx: EligibilityContext): EligibilityRow {
  const c = evaluateEligibilityChecks(ctx, SAMPLE_ASOF).find((x) => x.id === checkId)!;
  return { id: c.id, title: c.label, detail: c.message, tone: c.outcome };
}

export type { OutcomeKey } from '../../stores/outcomePreviewSlice';
import type { OutcomeKey } from '../../stores/outcomePreviewSlice';

export function outcomeRows(key: OutcomeKey): EligibilityRow[] {
  const b = baseCtx();
  switch (key) {
    case 'Hard Stop':
      return [
        rowFor('id-validity', { ...b, doc: { ...b.doc, expiryDate: '2025-08-31' } }),
        rowFor('blacklist-security', { ...b, customer: { ...b.customer, blacklisted: true, blacklistReasons: [{ category: 'security', reason: 'Security restriction on new connections' }] } }),
        rowFor('deals', { ...b, deals: [{ customerId: 'SAMPLE', blocksNewConnection: true }] }),
      ];
    case 'Soft Stop':
      return [
        rowFor('blacklist-collections', {
          ...b,
          customer: { ...b.customer, blacklisted: true, blacklistReasons: [{ category: 'collections', reason: 'Outstanding dues > threshold' }] },
          outstandingQar: 350,
        }),
      ];
    case 'Approval Routing':
      return [
        rowFor('age', { ...b, customer: { ...b.customer, dob: '2012-05-01' } }),
        rowFor('id-type-routing', { ...b, doc: { ...b.doc, documentType: 'Passport' } }),
        rowFor('active-lines', {
          ...b,
          lineCapReached: true,
          activeLinesDetail: evaluateRule('BR-288', { nationality: 'Indian', activePostpaidLines: 2 }).message ?? '',
        }),
      ];
    case 'Advisory Only':
      return buildEligibilityRows([], true, undefined).filter((r) => r.id === 'hrn');
  }
}

