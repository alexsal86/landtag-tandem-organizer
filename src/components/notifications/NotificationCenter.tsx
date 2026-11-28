import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { buildAdminHref } from '@/lib/appTargets';
import type { MouseEvent, JSX } from 'react';
import {
  Bell,
  CheckCheck,
  Calendar,
  MessageSquare,
  DollarSign,
  Settings,
  FileText,
  Users,
  BookOpen,
  Clock,
  BarChart3,
  MapPin,
  StickyNote,
  Tag,
  X,
  History,
  ChevronDown,
  ChevronRight,
  SmilePlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DecisionQuickResponse } from './DecisionQuickResponse';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications, type Notification } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';
import { buildDeepLinkPath } from '@/utils/notificationDeepLinks';
import { isLetterNotificationType } from '@/utils/letterNotificationTypes';

interface NotificationCenterProps {
  onClose?: () => void;
  greenUnreadBadge?: boolean;
}

type NotificationPriorityBadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

const getNotificationIcon = (type: string): LucideIcon => {
  if (isLetterNotificationType(type)) {
    return FileText;
  }

  switch (type) {
    case 'task_created':
    case 'task_due':
    case 'task_assigned':
    case 'task_updated':
      return CheckCheck;
    case 'appointment_reminder':
      return Calendar;
    case 'message_received':
      return MessageSquare;
    case 'budget_exceeded':
      return DollarSign;
    case 'system_update':
    case 'team_announcement_created':
      return Settings;
    case 'employee_meeting_overdue':
    case 'employee_meeting_due_soon':
    case 'employee_meeting_due':
    case 'employee_meeting_reminder':
    case 'employee_meeting_request_overdue':
    case 'employee_meeting_requested':
    case 'employee_meeting_request_declined':
    case 'employee_meeting_action_item_overdue':
    case 'employee_meeting_scheduled':
      return Users;
    case 'decision_request':
    case 'decision_response':
    case 'decision_completed':
    case 'task_decision_request':
    case 'task_decision_completed':
    case 'task_decision_complete':
    case 'task_decision_comment_received':
    case 'task_decision_creator_response':
    case 'task_decision_comment_reaction_received':
    case 'task_decision_comment_reply':
    case 'task_decision_digest':
    case 'task_decision_deadline_changed':
    case 'task_decision_withdrawn':
      return MessageSquare;
    case 'document_created':
    case 'document_mention':
    case 'news_shared_internal':
      return FileText;
    case 'knowledge_qa_comment':
    case 'knowledge_qa_assigned':
    case 'knowledge_qa_answered':
    case 'knowledge_qa_due':
    case 'knowledge_qa_review_requested':
    case 'knowledge_document_created':
      return BookOpen;
    case 'meeting_created':
      return Calendar;
    case 'note_follow_up':
      return StickyNote;
    case 'topic_mention':
      return Tag;
    case 'poll_auto_cancelled':
    case 'poll_auto_completed':
    case 'poll_restored':
      return BarChart3;
    case 'vacation_request_pending':
    case 'sick_leave_request_pending':
    case 'leave_request_approved':
    case 'leave_request_rejected':
      return Clock;
    case 'planning_collaborator_added':
      return MapPin;
    default:
      return Bell;
  }
};

const DIGEST_ITEM_LABELS: Record<string, string> = {
  task_decision_request: 'Anfrage',
  task_decision_comment_received: 'Kommentar',
  task_decision_comment_reply: 'Antwort',
  task_decision_comment_reaction_received: 'Reaktion',
  task_decision_completed: 'Ergebnis',
};

const DigestItemList = ({ notification, onClose }: { notification: Notification; onClose?: () => void }): JSX.Element | null => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = Array.isArray(notification.data?.digest_items) ? notification.data.digest_items : [];
  const decisionId = notification.data?.decision_id;
  const typeName = notification.notification_types?.name ?? notification.data?.type ?? '';

  if (typeName !== 'task_decision_digest' || items.length === 0) return null;

  const openItem = (event: MouseEvent<HTMLButtonElement>, item: (typeof items)[number]): void => {
    event.stopPropagation();
    if (!decisionId) return;
    const params = new URLSearchParams({ highlight: decisionId });
    if (item.comment_id) params.set('comment', item.comment_id);
    navigate(`/decisions?${params.toString()}`);
    onClose?.();
  };

  return (
    <div className="mt-2" onClick={(event) => event.stopPropagation()}>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-1.5 text-xs text-muted-foreground"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {open ? 'Einzelmeldungen ausblenden' : `${items.length} Einzelmeldungen anzeigen`}
      </Button>

      {open && (
        <ul className="mt-1 space-y-1 border-l pl-2">
          {items.map((item, index) => {
            const label = DIGEST_ITEM_LABELS[item.type ?? ''] ?? 'Meldung';
            const person = item.actor_name?.trim();
            return (
              <li key={item.notification_id ?? `${index}`}>
                <button
                  type="button"
                  className="flex w-full items-start gap-1.5 rounded px-1 py-0.5 text-left text-xs hover:bg-accent"
                  title="Zur Entscheidung springen"
                  onClick={(event) => openItem(event, item)}
                >
                  {item.type === 'task_decision_comment_reaction_received'
                    ? <SmilePlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    : <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0">
                    <span className="font-medium">{person ?? label}</span>
                    {person && <span className="text-muted-foreground"> · {label}</span>}
                    {item.emoji && <span> {item.emoji}</span>}
                    {item.excerpt && (
                      <span className="block truncate text-muted-foreground">{item.excerpt}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const getPriorityBorderClass = (priority: Notification['priority']): string => {
  switch (priority) {
    case 'urgent':
      return 'border-l-destructive';
    case 'high':
      return 'border-l-orange-500';
    case 'low':
      return 'border-l-slate-400';
    case 'medium':
    default:
      return 'border-l-primary';
  }
};

const getPriorityBadgeVariant = (priority: Notification['priority']): NotificationPriorityBadgeVariant => {
  switch (priority) {
    case 'urgent':
      return 'destructive';
    case 'high':
      return 'default';
    case 'low':
      return 'outline';
    case 'medium':
    default:
      return 'secondary';
  }
};

const getPriorityLabel = (priority: Notification['priority']): string => {
  switch (priority) {
    case 'urgent':
      return 'Dringend';
    case 'high':
      return 'Hoch';
    case 'low':
      return 'Niedrig';
    case 'medium':
    default:
      return 'Medium';
  }
};

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose?: () => void;
  greenUnreadBadge?: boolean;
}

const NotificationItem = ({ notification, onMarkRead, onDelete, onClose }: NotificationItemProps): JSX.Element => {
  const Icon = getNotificationIcon(notification.notification_types?.name ?? notification.data?.type ?? 'default');
  const navigate = useNavigate();

  const handleClick = (): void => {
    if (!notification.is_read) {
      void onMarkRead(notification.id);
    }

    const path = buildDeepLinkPath(notification);
    const target = new URL(path, window.location.href);
    if (target.origin !== window.location.origin) {
      window.location.assign(target.href);
      onClose?.();
      return;
    }

    navigate(target.pathname + target.search + target.hash);
    onClose?.();
  };

  const handleDelete = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    void onDelete(notification.id);
  };

  const handleAutomationRuleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    navigate(buildAdminHref("automation", "rules"));
    onClose?.();
  };

  return (
    <div
      className={cn(
        'relative flex cursor-pointer items-start gap-3 border-l-4 p-3 transition-colors hover:bg-accent group',
        notification.is_read ? 'opacity-60' : 'bg-accent/5',
        getPriorityBorderClass(notification.priority),
      )}
      onClick={handleClick}
    >
      <div className="mt-1 flex-shrink-0">
        <div className={cn('rounded-full p-2', notification.is_read ? 'bg-muted' : 'bg-primary/10')}>
          <Icon className={cn('h-4 w-4', notification.is_read ? 'text-muted-foreground' : 'text-primary')} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium leading-tight">{notification.title}</h4>
          <div className="flex flex-shrink-0 items-center gap-1">
            {!notification.is_read && <div className="mt-1 h-2 w-2 rounded-full bg-primary" />}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={handleDelete}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{notification.message}</p>

        <DigestItemList notification={notification} onClose={onClose} />

        <DecisionQuickResponse
          notification={notification}
          onDone={() => { if (!notification.is_read) void onMarkRead(notification.id); }}
        />

        <div className="mt-2 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.created_at), {
                addSuffix: true,
                locale: de,
              })}
            </span>
            {notification.data?.source === 'automation_rule' && notification.data.rule_id && (
              <button
                type="button"
                className="text-left text-xs text-muted-foreground underline hover:text-primary"
                onClick={handleAutomationRuleClick}
              >
                Warum diese Benachrichtigung?
              </button>
            )}
          </div>

          {notification.priority !== 'medium' && (
            <Badge variant={getPriorityBadgeVariant(notification.priority)} className="text-xs">
              {getPriorityLabel(notification.priority)}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

export const NotificationCenter = ({ onClose, greenUnreadBadge = false }: NotificationCenterProps): JSX.Element => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();

  const handleShowAll = (): void => {
    navigate('/notifications');
    onClose?.();
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h3 className="font-semibold">Benachrichtigungen</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className={cn("text-xs", greenUnreadBadge && "bg-[#2e6018] text-white hover:bg-[#2e6018]")}>
              {unreadCount}
            </Badge>
          )}
        </div>

        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={(): void => void markAllAsRead()} className="text-xs">
            <CheckCheck className="mr-1 h-4 w-4" />
            Alle lesen
          </Button>
        )}
      </div>

      <ScrollArea className="h-96">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Keine Benachrichtigungen vorhanden</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification: Notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={markAsRead}
                onDelete={deleteNotification}
                onClose={onClose}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <Separator />
      <div className="flex gap-2 p-3">
        <Button variant="ghost" size="sm" className="flex-1 justify-center text-xs" onClick={handleShowAll}>
          <History className="mr-1 h-4 w-4" />
          Alle anzeigen
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 justify-center text-xs" onClick={handleShowAll}>
          <Settings className="mr-1 h-4 w-4" />
          Einstellungen
        </Button>
      </div>
    </div>
  );
};
