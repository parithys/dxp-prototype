// The records that make a newly identified customer exist now live with the Customer Identification capability, which creates the customer as soon as the
// identity is validated. Re-exported here for the journeys that already import them from this path.
export { buildNewCustomerRecords, createValidatedCustomer, existingCustomerIdFor, isNewlyIdentifiedCustomer, newCustomerId } from '../../capabilities';
