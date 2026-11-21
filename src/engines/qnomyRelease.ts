

import { notificationActions } from '../stores/notificationSlice';
import { qnomyQueueActions } from '../stores/qnomyQueueSlice';
import { store } from '../stores/store';
import { entityOps } from '../services/entityOps';

/**
 * Closes the Qnomy ticket this session is holding as Completed, and returns the queue to "awaiting next". The agent cannot call the next customer
 * until the held ticket is closed (the header offers Next Customer only with no ticket in hand), and it is closed by any one of: Finish in the
 * header, Done & Exit, View My Orders or Additional Comments on the order confirmation. All of them come through here, so they write the same thing.
 *
 * Does nothing (and returns false) when no ticket is held - a second action on the same page never counts the customer twice.
 */

/**
 * Closes the Qnomy ticket this session is holding as Completed, and returns the queue to "awaiting next". The agent cannot call the next customer
 * until the held ticket is closed (the header offers Next Customer only with no ticket in hand), and it is closed by any one of: Finish in the
 * header, Done & Exit, View My Orders or Additional Comments on the order confirmation. All of them come through here, so they write the same thing.
 *
 * Does nothing (and returns false) when no ticket is held - a second action on the same page never counts the customer twice.
 */
export async function closeHeldQnomyTicket(): Promise<boolean> {
  const queue = store.getState().qnomyQueue;
  const ticketId = queue.assignedQTicketId;
  if (!ticketId) return false;
  // Released first, so two quick actions cannot both close it.
  store.dispatch(qnomyQueueActions.setAssignedQTicketId(null));
  store.dispatch(qnomyQueueActions.stopServiceTimer(Date.now()));
  await entityOps.updateRecord('qtickets', 'qTicketId', ticketId, {
    status: 'Completed',
    agentInDxpSessionId: null,
    handledByUserId: store.getState().auth.profile?.userId ?? null,
    releasedAt: new Date().toISOString(),
  });
  store.dispatch(qnomyQueueActions.setKioskMobileNumber(null));
  store.dispatch(qnomyQueueActions.setAwaitingNext(true));
  store.dispatch(qnomyQueueActions.recordCustomerServed());
  store.dispatch(notificationActions.pushToast('success', `Customer servicing for ticket ${ticketId} completed.`));
  return true;
}
