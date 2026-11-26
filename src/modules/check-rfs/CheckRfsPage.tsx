import { StepSummaryPanel, type CompletedSummaryStep } from '../../components/patterns/wizard/StepSummaryPanel';
import { contactSummary } from '../../capabilities';
import { CUSTOMER_IDENTIFICATION_LABEL } from '../../data/stepLabels';
import { useLocation } from '../../lib/router';
import { homeStartOf } from '../new-connection/rfsStart';
import { SERVICE_FEASIBILITY_LABEL } from '../../data/stepLabels';
import { ServiceAvailability } from './ServiceAvailability';
import { PageHeader, type WizardStep } from 'dxp-ui';

// Check RFS (ready for service): the Fibre & Home entry point that checks fibre or FWA availability at an address. It is reached
// straight from the journey card, with no customer verification first - an availability check needs an address, not a customer.
// The floating bar at the bottom (the way forward for the result, and Back when another page sent the agent here) belongs to the card, see ServiceAvailability.
//
// Reached from New Connection's Recommended Offers (New Home), it is a step of that journey: the Journey Summary stands beside it with the steps already done (Contact) and this page as the current one. Reached on its own (Fibre & Home Services > Plans & Installation), it has no summary.
/** Contact, Recommended Offers, this page, and the home steps that follow it (see connectionSteps.tsx: 10 once the product is known). */
const JOURNEY_STEPS = 11;

const step = (key: string, label: string, summary?: WizardStep['summary']): WizardStep => ({ key, label, summary, render: () => null });

export function CheckRfsPage() {
  const homeStart = homeStartOf(useLocation().state);
  const header = <PageHeader title="Check RFS" description="Check fibre or FWA availability at an address." />;
  if (!homeStart) {
    return (
      <div className="p-8">
        {header}
        <ServiceAvailability />
      </div>
    );
  }
  const completed: CompletedSummaryStep[] = [
    { index: 0, step: step('contact', CUSTOMER_IDENTIFICATION_LABEL, contactSummary) },
  ];
  // The title band runs the full width of the page; the page's card and the summary share the row under it.
  return (
    <div>
      <div className="px-8 pt-8">{header}</div>
      <div className="flex items-start">
        <div className="page-beside-rail">
          <ServiceAvailability />
        </div>
        <StepSummaryPanel completed={completed} totalSteps={JOURNEY_STEPS} values={homeStart.values} current={{ index: 1, step: step('feasibility', SERVICE_FEASIBILITY_LABEL) }} />
      </div>
    </div>
  );
}
