import type { Notification } from '@/hooks/useNotifications';

/**
 * Build a granular deep-link path based on notification type and data.
 * Shared between NotificationCenter (popover) and NotificationsPage.
 */
export const buildDeepLinkPath = (notification: Notification): string => {
  const typeName = notification.notification_types?.name || notification.data?.type;
  const data = notification.data || {};

  switch (typeName) {
    // Tasks
    case 'task_created':
    case 'task_assigned':
    case 'task_updated':
    case 'task_due':
      return data.task_id ? `/tasks?highlight=${data.task_id}` : '/tasks';

    // Decisions
    case 'task_decision_request':
    case 'task_decision_completed':
    case 'task_decision_complete':
    case 'task_decision_comment_received':
    case 'task_decision_creator_response':
    case 'decision_request':
    case 'decision_response':
    case 'decision_completed':
      return data.decision_id ? `/decisions?highlight=${data.decision_id}` : '/decisions';

    // Calendar
    case 'appointment_reminder':
      if (data.start_time) {
        const dateStr = new Date(data.start_time).toISOString().split('T')[0];
        return `/calendar?date=${dateStr}`;
      }
      return '/calendar';

    // Messages
    case 'message_received':
      return data.message_id ? `/messages?highlight=${data.message_id}` : '/messages';

    // Documents & Letters
    case 'document_created':
      return data.document_id ? `/documents?tab=letters&highlight=${data.document_id}` : '/documents';
    case 'document_mention':
      if (data.document_type === 'press') {
        return data.documentId ? `/documents?tab=press&highlight=${data.documentId}` : '/documents?tab=press';
      }
      return data.documentId ? `/documents?tab=letters&highlight=${data.documentId}` : '/documents';
    case 'letter_review_requested':
    case 'letter_review_completed':
    case 'letter_sent':
      return data.letter_id ? `/documents?tab=letters&highlight=${data.letter_id}` : '/documents?tab=letters';

    // Knowledge
    case 'knowledge_document_created':
      return data.document_id ? `/knowledge?highlight=${data.document_id}` : '/knowledge';

    // Meetings (Jour fixe)
    case 'meeting_created':
      return data.meeting_id ? `/meetings?highlight=${data.meeting_id}` : '/meetings';

    // Employee meetings
    case 'employee_meeting_overdue':
    case 'employee_meeting_due_soon':
    case 'employee_meeting_due':
    case 'employee_meeting_reminder':
    case 'employee_meeting_request_overdue':
    case 'employee_meeting_requested':
    case 'employee_meeting_request_declined':
    case 'employee_meeting_action_item_overdue':
    case 'employee_meeting_scheduled':
      if (data.meeting_id) {
        return `/employee-meeting/${data.meeting_id}`;
      }
      return '/employee';

    // Notes
    case 'note_follow_up':
      return data.noteId ? `/mywork?tab=notes&highlight=${data.noteId}` : '/mywork?tab=notes';

    // Polls
    case 'poll_auto_cancelled':
    case 'poll_auto_completed':
    case 'poll_restored':
      return data.poll_id ? `/calendar?highlight=${data.poll_id}` : '/calendar';

    // Time tracking
    case 'vacation_request_pending':
    case 'sick_leave_request_pending':
    case 'leave_request_approved':
    case 'leave_request_rejected':
      return data.request_id ? `/time?tab=leave-requests&highlight=${data.request_id}` : '/time';

    // Planning
    case 'planning_collaborator_added':
      return data.planning_id ? `/eventplanning?highlight=${data.planning_id}` : '/eventplanning';

    // System
    case 'team_announcement_created':
      return '/mywork?tab=team';
    case 'budget_exceeded':
    case 'system_update':
      return '/';

    default:
      // Fallback: use navigation_context if available
      if (notification.navigation_context) {
        return '/' + notification.navigation_context;
      }
      return '/';
  }
};
