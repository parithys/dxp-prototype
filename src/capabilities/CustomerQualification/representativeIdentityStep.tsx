import type { EligibilityResult } from '../../components/domain/eligibilityTypes';
import { AuthorizedPerson } from './RepresentativeSections';
import { customerRepresentativeOf, isAuthorizedPersonComplete, isRepresentativeOrder } from './representative';
import type { CustomerRepresentativeValue } from './representative';
import { type WizardStep } from 'dxp-ui';

/**
 * The Authorized Person page: the page after the dedicated Contact page (representativeStep.tsx), active only in the Customer Representative scenario. It holds everything
 * about the person acting for the actual customer: the authorization / supporting documents and their own identity. None of it is entered on the Contact page, which holds the actual customer only.
 */
export function representativeIdentityStep(): WizardStep {
  return {
    key: 'representative',
    label: 'Customer Representative',
    skip: (values) => !isRepresentativeOrder(values),
    render: ({ values, setValue }) => (
      <AuthorizedPerson
        value={customerRepresentativeOf(values) as CustomerRepresentativeValue}
        onChange={(v) => setValue('customerRepresentative', v)}
        values={values}
        actualCustomerId={(values.eligibility as EligibilityResult | undefined)?.customerId}
      />
    ),
    isValid: isAuthorizedPersonComplete,
  };
}
