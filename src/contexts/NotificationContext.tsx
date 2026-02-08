// @refresh reset
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
  deleteNotification: (notificationId: string) => Promise<void>;
  requestPushPermission: () => Promise<boolean>;
  subscribeToPush: () => Promise<void>;
}

// Default empty implementation for when hook fails or isn't ready
const defaultContextValue: NotificationContextType = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  pushSupported: false,
  pushPermission: 'default',
  loadNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
  requestPushPermission: async () => false,
  subscribeToPush: async () => {},
};

const NotificationContext = createContext<NotificationContextType>(defaultContextValue);

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
  // No need to check for null since we have a default value
  return context;
};
