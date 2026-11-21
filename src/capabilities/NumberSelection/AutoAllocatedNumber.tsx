import { useEffect, useState } from 'react';
import { listEntities } from '../../services/entityOps';
import type { MsisdnRecord } from '../../components/domain/msisdnPickerModel';
import { autoAllocatedFreeNumber } from './prepaidNumberAllocation';
import type { MsisdnSource } from './prepaidNumberAllocation';

/**
 * New Prepaid: the order's number when the agent has not chosen one. The step opens with the first available Free number allocated and selected in the picker below; the agent
 * keeps it or chooses another. A number already on the order (chosen earlier, or the agent coming Back) is never replaced, and a Pre-Paired SIM skips this step altogether.
 */
export function AutoAllocatedNumber({ msisdn, source, onAllocate }: { msisdn: string | undefined; source: MsisdnSource | undefined; onAllocate: (msisdn: string) => void }) {
  const [poolEmpty, setPoolEmpty] = useState(false);
  useEffect(() => {
    if (msisdn) return;
    let live = true;
    void listEntities<MsisdnRecord>('numbers').then((all) => {
      const n = live ? autoAllocatedFreeNumber(all) : undefined;
      if (n) onAllocate(n.msisdn);
      else if (live) setPoolEmpty(true);
    });
    return () => {
      live = false;
    };
    // Allocates once, when the step opens with no number.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!msisdn && poolEmpty) return <p className="caption-secondary mb-4" role="status">No Free number is available to allocate. Choose a number below.</p>;
  if (!msisdn) return <p className="caption-secondary mb-4" role="status">Allocating a number from the Free pool…</p>;
  if (source !== 'auto') return null;
  return <p className="caption-secondary mb-4" role="status">Allocated from the Free pool. Continue with this number or choose another below.</p>;
}
