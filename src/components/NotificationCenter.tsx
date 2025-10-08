import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  Bell, 
  CheckCheck, 
  Calendar, 
  MessageSquare, 
  DollarSign, 
  Settings,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications, type Notification } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';

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
      return Settings;
    case 'employee_meeting_overdue':
    case 'employee_meeting_due_soon':
    case 'employee_meeting_request_overdue':
    case 'employee_meeting_action_item_overdue':
    case 'employee_meeting_scheduled':
      return Calendar;
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

const NotificationItem: React.FC<{
  notification: Notification;
  onMarkRead: (id: string) => void;
  onClose?: () => void;
}> = ({ notification, onMarkRead, onClose }) => {
  const Icon = getNotificationIcon(notification.notification_types?.name || 'default');
  
  const handleClick = () => {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }
    
    // Navigate based on notification type or notification_types.name
    const notificationType = notification.notification_types?.name || notification.data?.type;
    let path = '/';
    
    switch (notificationType) {
      case 'task_created':
      case 'task_due':
      case 'task_assigned':
      case 'task_updated':
        path = '/tasks';
        break;
      case 'appointment_reminder':
        path = '/calendar';
        break;
      case 'message_received':
        path = '/messages';
        break;
      case 'document_created':
        path = '/documents';
        break;
      case 'knowledge_document_created':
        path = '/knowledge';
        break;
      case 'meeting_created':
        path = '/meetings';
        break;
      case 'employee_meeting_overdue':
      case 'employee_meeting_due_soon':
      case 'employee_meeting_request_overdue':
      case 'employee_meeting_action_item_overdue':
      case 'employee_meeting_scheduled':
        // Navigate to employees view
        path = '/employees';
        // If there's a specific meeting_id in data, navigate to that meeting
        if (notification.data?.meeting_id) {
          path = `/employee-meeting/${notification.data.meeting_id}`;
        }
        break;
      default:
        path = '/';
    }
    
    // Use proper navigation
    window.location.href = '/#' + path;
    onClose?.();
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 hover:bg-accent cursor-pointer transition-colors border-l-4",
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
          {!notification.is_read && (
            <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0 mt-1" />
          )}
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
    markAllAsRead 
  } = useNotifications();

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
                onClose={onClose}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {notifications.length > 0 && (
        <>
          <Separator />
          <div className="p-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs"
              onClick={() => {
                window.location.href = '/#/settings';
                onClose?.();
              }}
            >
              <Settings className="h-4 w-4 mr-1" />
              Benachrichtigungseinstellungen
            </Button>
          </div>
        </>
      )}
    </div>
  );
};