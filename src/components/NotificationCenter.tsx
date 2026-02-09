import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
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
  X,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications, type Notification } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';
import { buildDeepLinkPath } from '@/utils/notificationDeepLinks';

interface NotificationCenterProps {
  onClose?: () => void;
}

const getNotificationIcon = (type: string) => {
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
      return MessageSquare;
    case 'document_created':
    case 'document_mention':
    case 'letter_review_requested':
    case 'letter_review_completed':
    case 'letter_sent':
      return FileText;
    case 'knowledge_document_created':
      return BookOpen;
    case 'meeting_created':
      return Calendar;
    case 'note_follow_up':
      return StickyNote;
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

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'destructive';
    case 'high':
      return 'orange';
    case 'medium':
      return 'blue';
    case 'low':
      return 'gray';
    default:
      return 'blue';
  }
};

// buildDeepLinkPath is now imported from @/utils/notificationDeepLinks

const NotificationItem: React.FC<{
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}> = ({ notification, onMarkRead, onDelete, onClose }) => {
  const Icon = getNotificationIcon(notification.notification_types?.name || 'default');
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }
    
    const path = buildDeepLinkPath(notification);
    navigate(path);
    onClose?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(notification.id);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 hover:bg-accent cursor-pointer transition-colors border-l-4 relative group",
        notification.is_read ? "opacity-60" : "bg-accent/5",
        `border-l-${getPriorityColor(notification.priority)}`
      )}
      onClick={handleClick}
    >
      <div className="flex-shrink-0 mt-1">
        <div className={cn(
          "p-2 rounded-full",
          notification.is_read ? "bg-muted" : "bg-primary/10"
        )}>
          <Icon className={cn(
            "h-4 w-4",
            notification.is_read ? "text-muted-foreground" : "text-primary"
          )} />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium leading-tight">
            {notification.title}
          </h4>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!notification.is_read && (
              <div className="h-2 w-2 bg-primary rounded-full mt-1" />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleDelete}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {notification.message}
        </p>
        
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
              locale: de,
            })}
          </span>
          
          {notification.priority !== 'medium' && (
            <Badge 
              variant={getPriorityColor(notification.priority) as any}
              className="text-xs"
            >
              {notification.priority === 'urgent' ? 'Dringend' :
               notification.priority === 'high' ? 'Hoch' :
               notification.priority === 'low' ? 'Niedrig' : 'Medium'}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead,
    deleteNotification
  } = useNotifications();
  const navigate = useNavigate();

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h3 className="font-semibold">Benachrichtigungen</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Alle lesen
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="h-96">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Keine Benachrichtigungen vorhanden
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
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

      {/* Footer */}
      <Separator />
      <div className="p-3 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 justify-center text-xs"
          onClick={() => {
            navigate('/notifications');
            onClose?.();
          }}
        >
          <History className="h-4 w-4 mr-1" />
          Alle anzeigen
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 justify-center text-xs"
          onClick={() => {
            navigate('/notifications');
            onClose?.();
          }}
        >
          <Settings className="h-4 w-4 mr-1" />
          Einstellungen
        </Button>
      </div>
    </div>
  );
};
