import React, { createContext, useContext } from 'react';
import { useNotifications as useNotificationsHook } from '@/hooks/useNotifications';
import type { Notification } from '@/hooks/useNotifications';

// Re-export Notification type for components
export type { Notification };

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  pushSupported: boolean;
  pushPermission: NotificationPermission;
  loadNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  requestPushPermission: () => Promise<boolean>;
  subscribeToPush: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notificationState = useNotificationsHook();
  
  return (
    <NotificationContext.Provider value={notificationState}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};
