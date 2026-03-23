import type { Notification, NotificationData } from '@/hooks/useNotifications';
import { isLetterNotificationType } from '@/utils/letterNotificationTypes';

const getNotificationDataId = (
  data: NotificationData,
  ...keys: Array<keyof NotificationData>
): string | null => {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }

  return null;
};

const buildHighlightPath = (basePath: string, id: string | null): string => {
  return id ? `${basePath}${basePath.includes('?') ? '&' : '?'}highlight=${id}` : basePath;
};

/**
 * Build a granular deep-link path based on notification type and data.
 * Shared between NotificationCenter (popover) and NotificationsPage.
 */
export const buildDeepLinkPath = (notification: Notification): string => {
  const data: NotificationData = notification.data ?? {};
  const typeName = notification.notification_types?.name ?? data.type ?? '';

  if (isLetterNotificationType(typeName)) {
    return data.letter_id ? `/letters/${data.letter_id}` : '/documents?tab=letters';
  }

  switch (typeName) {
    case 'task_created':
    case 'task_assigned':
    case 'task_updated':
    case 'task_due':
      return buildHighlightPath('/tasks', getNotificationDataId(data, 'task_id', 'taskId'));

    case 'task_decision_request':
    case 'task_decision_completed':
    case 'task_decision_complete':
    case 'task_decision_comment_received':
    case 'task_decision_creator_response':
    case 'task_decision_comment_reaction_received':
    case 'decision_request':
    case 'decision_response':
    case 'decision_completed':
      return buildHighlightPath('/decisions', getNotificationDataId(data, 'decision_id'));

    case 'appointment_reminder': {
      const startTime = data.start_time;
      if (startTime) {
        const dateStr = new Date(startTime).toISOString().split('T')[0];
        return `/calendar?date=${dateStr}`;
      }
      return '/calendar';
    }

    case 'message_received':
      return buildHighlightPath('/messages', getNotificationDataId(data, 'message_id'));

    case 'document_created':
      return buildHighlightPath('/documents?tab=letters', getNotificationDataId(data, 'document_id'));
    case 'document_mention': {
      const documentId = getNotificationDataId(data, 'documentId', 'document_id');
      return data.document_type === 'press'
        ? buildHighlightPath('/documents?tab=press', documentId)
        : buildHighlightPath('/documents?tab=letters', documentId);
    }
    case 'knowledge_document_created':
      return buildHighlightPath('/knowledge', getNotificationDataId(data, 'document_id'));

    case 'meeting_created':
      return buildHighlightPath('/meetings', getNotificationDataId(data, 'meeting_id'));

    case 'employee_meeting_overdue':
    case 'employee_meeting_due_soon':
    case 'employee_meeting_due':
    case 'employee_meeting_reminder':
    case 'employee_meeting_request_overdue':
    case 'employee_meeting_requested':
    case 'employee_meeting_request_declined':
    case 'employee_meeting_action_item_overdue':
    case 'employee_meeting_scheduled':
      return data.meeting_id ? `/employee-meeting/${data.meeting_id}` : '/employee';

    case 'note_follow_up':
    case 'quick_note_shared':
      return buildHighlightPath('/mywork?tab=notes', getNotificationDataId(data, 'noteId'));

    case 'appointment_feedback': {
      const targetType = data.feedback_context?.target?.type ?? null;
      const targetId = data.feedback_context?.target?.id ?? null;
      const feedbackId = data.feedback_id ?? data.feedback_context?.source?.id ?? null;

      if (targetType === 'task' && targetId) {
        return `/tasks?highlight=${targetId}&feedback_id=${feedbackId ?? ''}`;
      }
      if (targetType === 'calendar' && targetId) {
        return `/calendar?highlight=${targetId}&source=notification-feedback`;
      }
      return buildHighlightPath('/mywork?tab=feedbackfeed', feedbackId);
    }

    case 'poll_auto_cancelled':
    case 'poll_auto_completed':
    case 'poll_restored':
      return buildHighlightPath('/calendar', getNotificationDataId(data, 'poll_id'));

    case 'vacation_request_pending':
    case 'sick_leave_request_pending':
    case 'leave_request_approved':
    case 'leave_request_rejected':
      return buildHighlightPath('/time?tab=leave-requests', getNotificationDataId(data, 'request_id'));

    case 'planning_collaborator_added':
      return buildHighlightPath('/eventplanning', getNotificationDataId(data, 'planning_id'));

    case 'news_shared_internal':
      return data.article_link ?? data.link ?? '/';

    case 'team_announcement_created':
      return '/mywork?tab=team';
    case 'automation_run_failed':
      return buildHighlightPath('/admin?tab=automation&filter=failed', getNotificationDataId(data, 'run_id'));
    case 'task_shared':
      return buildHighlightPath('/tasks', getNotificationDataId(data, 'taskId', 'task_id'));
    case 'budget_exceeded':
    case 'system_update':
      return '/';

    default: {
      const navigationContext = notification.navigation_context ?? notification.data?.navigation_context;
      return navigationContext ? `/${navigationContext}` : '/';
    }
  }
};
