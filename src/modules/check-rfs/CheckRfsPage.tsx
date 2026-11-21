import { PageHeader } from '../../components/patterns/PageHeader';
import { ServiceAvailability } from './ServiceAvailability';

// Check RFS (ready for service): the Fibre & Home entry point that checks fibre or FWA availability at an address. It is reached
// straight from the journey card, with no customer verification first - an availability check needs an address, not a customer.
export function CheckRfsPage() {
  return (
    <div className="p-8">
      <PageHeader title="Fibre or FWA Availability" description="Check fibre or FWA availability at an address." />
      <ServiceAvailability />
    </div>
  );
}
