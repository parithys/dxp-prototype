import { PageHeader } from '../../components/patterns/PageHeader';
import { ServiceAvailability } from './ServiceAvailability';

// Check RFS (ready for service): the Fibre & Home entry point that checks fibre or FWA availability at an address. It is reached
// straight from the journey card, with no customer verification first - an availability check needs an address, not a customer.
// The floating bar at the bottom (the way forward for the result, and Back when another page sent the agent here) belongs to the card, see ServiceAvailability.
export function CheckRfsPage() {
  return (
    <div className="p-8">
      <PageHeader title="Check RFS" description="Check fibre or FWA availability at an address." />
      <ServiceAvailability />
    </div>
  );
}
