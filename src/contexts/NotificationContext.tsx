// @refresh reset
import { createContext, useContext } from 'react';
import type { PropsWithChildren, JSX } from 'react';
import { useNotifications as useNotificationsHook } from '@/hooks/useNotifications';
import type { Notification } from '@/hooks/useNotifications';

export type { Notification };

export interface NotificationContextType {
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

const defaultContextValue: NotificationContextType = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  pushSupported: false,
  pushPermission: 'default',
  loadNotifications: async (): Promise<void> => {},
  markAsRead: async (): Promise<void> => {},
  markAllAsRead: async (): Promise<void> => {},
  deleteNotification: async (): Promise<void> => {},
  requestPushPermission: async (): Promise<boolean> => false,
  subscribeToPush: async (): Promise<void> => {},
};

const NotificationContext = createContext<NotificationContextType>(defaultContextValue);

export const NotificationProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const notificationState = useNotificationsHook();

  return <NotificationContext.Provider value={notificationState}>{children}</NotificationContext.Provider>;
};

export const useNotifications = (): NotificationContextType => {
  return useContext(NotificationContext);
};
