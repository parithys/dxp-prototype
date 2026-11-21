import type { ReactNode } from 'react';
import { Checkbox } from 'dxp-ui';
import { customerRepresentativeOf } from './representative';

/**
 * The "Customer Representative" checkbox, at the right of the Contact heading, on the tinted background and in the text colour of the "Customer view" button. It is on BOTH
 * Contact pages: ticking it on the existing page takes the agent to the dedicated Customer Representative page (representativeStep.tsx), which takes that page's place in the
 * journey; unticking it there returns to the existing page.
 */
export function representativeHeaderAction({ values, setValue }: { values: Record<string, unknown>; setValue: (field: string, value: unknown) => void }): ReactNode {
  return (
    <label className="row gap-2 cursor-pointer representative-toggle">
      <Checkbox
        checked={Boolean(customerRepresentativeOf(values)?.enabled)}
        // Always available: changing the scenario starts the identification over (an identity already validated is cleared), so the previous person's details never carry across.
        onCheckedChange={(checked) => {
          setValue('customerRepresentative', checked === true ? { enabled: true } : undefined);
          // An order placed for the actual customer by an authorized person has no Secondary Contact: whatever was added before is dropped.
          if (checked === true) setValue('actualUser', undefined);
          setValue('contact', undefined);
          setValue('eligibility', undefined);
        }}
      />
      <span>Customer Representative</span>
    </label>
  );
}
