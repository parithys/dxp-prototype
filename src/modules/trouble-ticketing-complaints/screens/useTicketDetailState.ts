import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from '../../../lib/router';
import { notificationActions } from '../../../stores/notificationSlice';
import { useTicketSlaEscalationSweep } from '../slaEscalationSweep';
import type { Ticket, AuditRecord, OsbNotification } from './ticketDetailModel';
import { useAction, useAppSelector } from '../../../stores/hooks';
import { useEntityOps, useEntityRecords } from '../../../services/entityHooks';
import { listEntities } from '../../../services/entityOps';

// Store bindings, local state and data-loading effects for TicketDetail.
// Hook order here is the original component's order - do not reorder.
export function useTicketDetailState() {
  const [params] = useSearchParams();
  const ticketId = params.get('id');
  const rawTickets = useEntityRecords('trouble-tickets');
  const tickets = useMemo(() => (rawTickets ?? []) as unknown as Ticket[], [rawTickets]);
  const updateRecord = useEntityOps().updateRecord;
  const createRecord = useEntityOps().createRecord;
  const pushToast = useAction(notificationActions.pushToast);
  const activePersonaId = useAppSelector((s) => s.persona.activePersonaId);
  const [noteText, setNoteText] = useState('');
  const [activityText, setActivityText] = useState('');
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionCode, setResolutionCode] = useState('');
  const [resolutionHashtags, setResolutionHashtags] = useState<string[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [retentionCloseOpen, setRetentionCloseOpen] = useState(false);
  const [retentionResolutionCode, setRetentionResolutionCode] = useState('');
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reassignQueue, setReassignQueue] = useState('');
  const [surveyNotifications, setSurveyNotifications] = useState<OsbNotification[]>([]);
  useTicketSlaEscalationSweep();

  useEffect(() => {
    if (!ticketId) return;
    listEntities<AuditRecord>('audit-trail').then((all) => {
      setAuditRecords(all.filter((a) => a.recordType === 'Ticket' && a.recordId === ticketId).sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    });
  }, [ticketId, tickets]);

  // Screen 14 (System Event: Customer Feedback Status) - surfaces the
  // survey-triggered notify() call closeTicket() already makes (see its own
  // comment below) directly on the ticket, instead of it only showing up
  // generically under Customer 360 -> Notifications.
  useEffect(() => {
    if (!ticketId) return;
    listEntities<OsbNotification>('osb-notifications').then((all) => {
      setSurveyNotifications(all.filter((n) => n.orderId === ticketId && n.smsText.includes('satisfaction survey')));
    });
  }, [ticketId, tickets]);

  const ticket = tickets.find((t) => t.ticketId === ticketId);
  return {
    ticket,
    updateRecord,
    createRecord,
    pushToast,
    activePersonaId,
    noteText,
    setNoteText,
    activityText,
    setActivityText,
    auditRecords,
    escalateOpen,
    setEscalateOpen,
    escalateReason,
    setEscalateReason,
    resolveOpen,
    setResolveOpen,
    resolutionCode,
    setResolutionCode,
    resolutionHashtags,
    setResolutionHashtags,
    cancelOpen,
    setCancelOpen,
    cancelReason,
    setCancelReason,
    retentionCloseOpen,
    setRetentionCloseOpen,
    retentionResolutionCode,
    setRetentionResolutionCode,
    reopenOpen,
    setReopenOpen,
    reopenReason,
    setReopenReason,
    reassignQueue,
    setReassignQueue,
    surveyNotifications,
  };
}

export type TicketDetailState = ReturnType<typeof useTicketDetailState>;
