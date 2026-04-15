// @refresh reset
import { useState, useEffect, useCallback } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { debugConsole } from '@/utils/debugConsole';
import type { UnknownRecord } from '@/utils/typeSafety';

export interface NotificationFeedbackContext {
  target?: {
    type?: string | null;
    id?: string | null;
  } | null;
  source?: {
    id?: string | null;
  } | null;
}

export interface NotificationTypeInfo {
  name: string;
  label: string;
}

export interface NotificationData extends UnknownRecord {
  type?: string | null;
  task_id?: string | null;
  taskId?: string | null;
  decision_id?: string | null;
  start_time?: string | null;
  message_id?: string | null;
  document_id?: string | null;
  document_type?: string | null;
  documentId?: string | null;
  letter_id?: string | null;
  meeting_id?: string | null;
  noteId?: string | null;
  feedback_context?: NotificationFeedbackContext | null;
  feedback_id?: string | null;
  poll_id?: string | null;
  request_id?: string | null;
  planning_id?: string | null;
  article_link?: string | null;
  link?: string | null;
  run_id?: string | null;
  rule_id?: string | null;
  source?: string | null;
  navigation_context?: string | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  data?: NotificationData | null;
  is_read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  navigation_context?: string | null;
  notification_types: NotificationTypeInfo | null;
}

export interface NotificationSettings {
  id: string;
  notification_type_id: string;
  is_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

export interface NotificationType {
  id: string;
  name: string;
  label: string;
  description?: string | null;
}

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  data: NotificationData | null;
  is_read: boolean;
  priority: Notification['priority'];
  created_at: string;
  navigation_context: string | null;
  notification_types: Notification['notification_types'];
};

type NotificationUpdateRow = Pick<NotificationRow, 'id' | 'is_read'>;
type NotificationInsertPayload = RealtimePostgresChangesPayload<NotificationRow> & { eventType: 'INSERT' };
type NotificationUpdatePayload = RealtimePostgresChangesPayload<NotificationRow> & { eventType: 'UPDATE' };

type NotificationRealtimeEvent =
  | { type: 'notification-insert'; payload: NotificationInsertPayload }
  | { type: 'notification-update'; payload: NotificationUpdatePayload };

type NotificationSyncEventDetail = {
  source: 'notifications' | 'navigation';
  notificationId?: string;
  context?: string;
};

const emitNotificationsChanged = (detail: NotificationSyncEventDetail): void => {
  window.dispatchEvent(new CustomEvent<NotificationSyncEventDetail>('notifications-changed', { detail }));
};

type PushManagerRegistration = ServiceWorkerRegistration & {
  pushManager?: globalThis.PushManager;
};

type VapidResponse = {
  success?: boolean;
  publicKey?: string;
  error?: string;
};

const mapNotificationRow = (row: NotificationRow): Notification => ({
  id: row.id,
  title: row.title,
  message: row.message,
  data: row.data,
  is_read: row.is_read,
  priority: row.priority,
  created_at: row.created_at,
  navigation_context: row.navigation_context,
  notification_types: row.notification_types,
});

const handleNotificationRealtimeEvent = (
  event: NotificationRealtimeEvent,
  onInsert: (payload: NotificationInsertPayload) => Promise<void>,
  onUpdate: (payload: NotificationUpdatePayload) => void,
): void => {
  switch (event.type) {
    case 'notification-insert':
      void onInsert(event.payload);
      return;
    case 'notification-update':
      onUpdate(event.payload);
      return;
  }
};

export const useNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [pushSupported, setPushSupported] = useState<boolean>(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    const checkPushSupport = (): void => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setPushSupported(supported);

      if (supported && 'Notification' in window) {
        setPushPermission(Notification.permission);
      }
    };

    checkPushSupport();
  }, []);

  const loadNotifications = useCallback(async (): Promise<void> => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          title,
          message,
          data,
          is_read,
          priority,
          created_at,
          navigation_context,
          notification_types(name, label)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const notificationRows: NotificationRow[] = (data ?? []) as NotificationRow[];
      const mappedNotifications = notificationRows.map(mapNotificationRow);
      setNotifications(mappedNotifications);
      setUnreadCount(mappedNotifications.filter((notification: Notification) => !notification.is_read).length);
    } catch (error: unknown) {
      debugConsole.error('Error loading notifications:', error);
      // Preserve existing notifications (stale data > no data)
      // Only show toast if we have no data at all
      if (notifications.length === 0) {
        toast({
          title: 'Fehler',
          description: 'Benachrichtigungen konnten nicht geladen werden.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, toast]);

  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    if (!user) {
      return;
    }

    setNotifications((prev: Notification[]) =>
      prev.map((notification: Notification) =>
        notification.id === notificationId ? { ...notification, is_read: true } : notification,
      ),
    );
    setUnreadCount((prev: number) => Math.max(0, prev - 1));

    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      localStorage.setItem(`notifications-update-${user.id}`, Date.now().toString());
      localStorage.removeItem(`notifications-update-${user.id}`);
      emitNotificationsChanged({ source: 'notifications', notificationId: notificationId });

      localStorage.setItem(
        'notifications_marked_read',
        JSON.stringify({
          timestamp: Date.now(),
          userId: user.id,
        }),
      );
      localStorage.removeItem('notifications_marked_read');
    } catch (error: unknown) {
      debugConsole.error('Error marking notification as read:', error);
      setNotifications((prev: Notification[]) =>
        prev.map((notification: Notification) =>
          notification.id === notificationId ? { ...notification, is_read: false } : notification,
        ),
      );
      setUnreadCount((prev: number) => prev + 1);
    }
  }, [user]);

  const deleteNotification = useCallback(async (notificationId: string): Promise<void> => {
    if (!user) {
      return;
    }

    const wasUnread = notifications.some(
      (notification: Notification) => notification.id === notificationId && !notification.is_read,
    );
    setNotifications((prev: Notification[]) =>
      prev.filter((notification: Notification) => notification.id !== notificationId),
    );
    if (wasUnread) {
      setUnreadCount((prev: number) => Math.max(0, prev - 1));
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      emitNotificationsChanged({ source: 'notifications', notificationId: notificationId });
    } catch (error: unknown) {
      debugConsole.error('Error deleting notification:', error);
      await loadNotifications();
    }
  }, [user, notifications, loadNotifications]);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    if (!user) {
      return;
    }

    const hasUnread = notifications.some((notification: Notification) => !notification.is_read);
    if (!hasUnread) {
      return;
    }

    const previousNotifications = [...notifications];
    const previousUnreadCount = unreadCount;

    setNotifications((prev: Notification[]) =>
      prev.map((notification: Notification) => ({ ...notification, is_read: true })),
    );
    setUnreadCount(0);

    try {
      const { data: unreadNotifications, error: fetchError } = await supabase
        .from('notifications')
        .select('id, is_read')
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (fetchError) throw fetchError;

      const unreadRows: NotificationUpdateRow[] = (unreadNotifications ?? []) as NotificationUpdateRow[];
      if (unreadRows.length === 0) {
        return;
      }

      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .in('id', unreadRows.map((notification: NotificationUpdateRow) => notification.id));

      if (error) throw error;

      localStorage.setItem(`notifications-update-${user.id}`, Date.now().toString());
      localStorage.removeItem(`notifications-update-${user.id}`);
      emitNotificationsChanged({ source: 'notifications' });

      localStorage.setItem('notifications_marked_read', Date.now().toString());
      localStorage.removeItem('notifications_marked_read');
    } catch (error: unknown) {
      debugConsole.error('Error marking all notifications as read:', error);

      const message = error instanceof Error ? error.message : '';
      const isNetworkError =
        message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('fetch');

      if (isNetworkError) {
        setTimeout(() => {
          void loadNotifications();
        }, 1000);
      } else {
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);

        toast({
          title: 'Fehler',
          description: 'Benachrichtigungen konnten nicht als gelesen markiert werden.',
          variant: 'destructive',
        });
      }
    }
  }, [user, toast, notifications, unreadCount, loadNotifications]);

  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let index = 0; index < rawData.length; index += 1) {
      outputArray[index] = rawData.charCodeAt(index);
    }

    return outputArray;
  };

  const getPushRegistration = useCallback(async (): Promise<PushManagerRegistration> => {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/push/' });
    // Wait for the SW to become active
    if (!registration.active) {
      await new Promise<void>((resolve) => {
        const sw = registration.installing ?? registration.waiting;
        if (!sw) {
          resolve();
          return;
        }
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') resolve();
        });
      });
    }
    return registration as PushManagerRegistration;
  }, []);

  const subscribeToPush = useCallback(async (options?: { silent?: boolean }): Promise<void> => {
    const silent = options?.silent ?? false;
    if (!user || !pushSupported || pushPermission !== 'granted') {
      return;
    }

    try {
      const registration = await getPushRegistration();
      const pushManager = registration.pushManager;

      if (!pushManager) {
        throw new Error('PushManager is not available on the active service worker registration');
      }

      let subscription = await pushManager.getSubscription();
      let needNewSubscription = subscription === null;

      if (subscription) {
        const { data: dbSubscription } = await supabase
          .from('push_subscriptions')
          .select('is_active')
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint)
          .single();

        if (!dbSubscription || dbSubscription.is_active !== true) {
          await subscription.unsubscribe();
          subscription = null;
          needNewSubscription = true;
        }
      }

      if (needNewSubscription) {
        try {
          const vapidResponse = await fetch(
            'https://wawofclbehbkebjivdte.supabase.co/functions/v1/send-push-notification',
            {
              method: 'GET',
              headers: {
                Authorization:
                  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50',
                apikey:
                  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50',
                'Content-Type': 'application/json',
              },
            },
          );

          if (!vapidResponse.ok) {
            throw new Error(`HTTP error! status: ${vapidResponse.status}`);
          }

          const vapidData: VapidResponse = (await vapidResponse.json()) as VapidResponse;
          if (!vapidData.success || !vapidData.publicKey) {
            throw new Error(`Failed to fetch VAPID public key: ${vapidData.error ?? 'Unknown error'}`);
          }

          subscription = await pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey) as BufferSource,
          });
        } catch (error: unknown) {
          debugConsole.error('❌ Failed to get VAPID key or create subscription:', error);
          throw error;
        }
      }

      if (subscription) {
        const p256dh = subscription.getKey('p256dh');
        const auth = subscription.getKey('auth');

        if (!p256dh || !auth) {
          debugConsole.error('❌ Invalid subscription keys');
          throw new Error('Invalid subscription keys');
        }

        const p256dhBase64 = btoa(String.fromCharCode(...new Uint8Array(p256dh)));
        const authBase64 = btoa(String.fromCharCode(...new Uint8Array(auth)));

        const { error } = await supabase
          .from('push_subscriptions')
          .upsert(
            {
              user_id: user.id,
              endpoint: subscription.endpoint,
              p256dh_key: p256dhBase64,
              auth_key: authBase64,
              user_agent: navigator.userAgent,
              is_active: true,
            },
            {
              onConflict: 'user_id,endpoint',
            },
          );

        if (error) {
          debugConsole.error('❌ Database error:', error);
          throw error;
        }

        if (!silent) {
          toast({
            title: 'Erfolgreich',
            description: 'Push-Benachrichtigungen wurden aktiviert.',
          });
        }
      }
    } catch (error: unknown) {
      debugConsole.error('❌ Error subscribing to push:', error);
      if (!silent) {
        toast({
          title: 'Fehler',
          description: 'Push-Benachrichtigungen konnten nicht aktiviert werden.',
          variant: 'destructive',
        });
      }
      throw error;
    }
  }, [user, pushSupported, pushPermission, toast, getPushRegistration]);

  const requestPushPermission = useCallback(async (): Promise<boolean> => {
    if (!pushSupported) {
      toast({
        title: 'Nicht unterstützt',
        description: 'Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === 'granted') {
        await subscribeToPush();
        return true;
      }

      toast({
        title: 'Berechtigung verweigert',
        description: 'Push-Benachrichtigungen wurden nicht erlaubt.',
        variant: 'destructive',
      });
      return false;
    } catch (error: unknown) {
      debugConsole.error('Error requesting push permission:', error);
      toast({
        title: 'Fehler',
        description: 'Berechtigung für Push-Benachrichtigungen konnte nicht angefordert werden.',
        variant: 'destructive',
      });
      return false;
    }
  }, [pushSupported, subscribeToPush, toast]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let retryCount = 0;
    const maxRetries = 5;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let subscriptionHealthy = false;

    const startPollingFallback = (): void => {
      if (pollingInterval) {
        return;
      }

      pollingInterval = setInterval(() => {
        if (!subscriptionHealthy) {
          void loadNotifications();
        }
      }, 120000);
    };

    const stopPollingFallback = (): void => {
      if (!pollingInterval) {
        return;
      }

      clearInterval(pollingInterval);
      pollingInterval = null;
    };

    const setupChannel = (): void => {
      if (currentChannel) {
        void supabase.removeChannel(currentChannel);
      }

      debugConsole.log(`Setting up notifications realtime subscription for user: ${user.id} (attempt ${retryCount + 1})`);

      currentChannel = supabase
        .channel(`user-notifications:${user.id}:${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
            if (payload.eventType !== 'INSERT') {
              return;
            }
            const insertPayload = payload as NotificationInsertPayload;
            handleNotificationRealtimeEvent(
              { type: 'notification-insert', payload: insertPayload },
              async (insertEventPayload: NotificationInsertPayload): Promise<void> => {
                debugConsole.log('📥 New notification received via realtime:', insertEventPayload);

                const insertedId = insertEventPayload.new.id;
                if (!insertedId) {
                  return;
                }

                const { data: fullNotification } = await supabase
                  .from('notifications')
                  .select(`
                    id,
                    title,
                    message,
                    data,
                    is_read,
                    priority,
                    created_at,
                    navigation_context,
                    notification_types(name, label)
                  `)
                  .eq('id', insertedId)
                  .maybeSingle();

                const newNotification = fullNotification
                  ? mapNotificationRow(fullNotification as NotificationRow)
                  : mapNotificationRow(insertEventPayload.new);

                setNotifications((prev: Notification[]) => {
                  const exists = prev.some((notification: Notification) => notification.id === newNotification.id);
                  return exists ? prev : [newNotification, ...prev];
                });

                if (!newNotification.is_read) {
                  setUnreadCount((prev: number) => prev + 1);
                }

                emitNotificationsChanged({ source: 'notifications', notificationId: newNotification.id });
                toast({
                  title: newNotification.title || 'Neue Benachrichtigung',
                  description: newNotification.message || 'Sie haben eine neue Benachrichtigung erhalten.',
                  duration: 4000,
                });
              },
              () => undefined,
            );
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
            if (payload.eventType !== 'UPDATE') {
              return;
            }
            const updatePayload = payload as NotificationUpdatePayload;
            handleNotificationRealtimeEvent(
              { type: 'notification-update', payload: updatePayload },
              async () => undefined,
              (updateEventPayload: NotificationUpdatePayload): void => {
                const updatedId = updateEventPayload.new.id;
                const oldNotification = updateEventPayload.old.id
                  ? mapNotificationRow(updateEventPayload.old as NotificationRow)
                  : null;

                if (!updatedId) {
                  return;
                }

                const updatedNotification = mapNotificationRow(updateEventPayload.new);
                setNotifications((prev: Notification[]) =>
                  prev.map((notification: Notification) =>
                    notification.id === updatedId ? { ...updatedNotification } : notification,
                  ),
                );

                if (oldNotification && updatedNotification.is_read !== oldNotification.is_read) {
                  if (updatedNotification.is_read && !oldNotification.is_read) {
                    setUnreadCount((prev: number) => Math.max(0, prev - 1));
                  } else if (!updatedNotification.is_read && oldNotification.is_read) {
                    setUnreadCount((prev: number) => prev + 1);
                  }
                }

                emitNotificationsChanged({ source: 'notifications', notificationId: updatedId });
              },
            );
          },
        )
        .subscribe((status: string) => {
          debugConsole.log('📡 Notifications realtime subscription status:', status);
          if (status === 'SUBSCRIBED') {
            subscriptionHealthy = true;
            retryCount = 0;
            stopPollingFallback();
            void loadNotifications();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            subscriptionHealthy = false;
            startPollingFallback();
            if (retryCount < maxRetries) {
              retryCount += 1;
              const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
              debugConsole.log(`🔄 Retrying subscription in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
              retryTimeout = setTimeout(setupChannel, delay);
            }
          } else if (status === 'CLOSED') {
            subscriptionHealthy = false;
            startPollingFallback();
          }
        });
    };

    setupChannel();
    startPollingFallback();

    const handleStorageChange = (event: StorageEvent): void => {
      if (event.key === `notifications-update-${user.id}` && event.newValue) {
        debugConsole.log('🔄 Cross-tab notification update detected');
        void loadNotifications();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      debugConsole.log('🧹 Cleaning up notifications realtime subscription');
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      stopPollingFallback();
      if (currentChannel) {
        void supabase.removeChannel(currentChannel);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, toast]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user || !pushSupported || pushPermission !== 'granted') {
      return;
    }

    const checkAndRenewSubscription = async (): Promise<void> => {
      try {
        const registration = (await navigator.serviceWorker.ready) as PushManagerRegistration | undefined;
        const currentSubscription = registration?.pushManager
          ? await registration.pushManager.getSubscription()
          : null;
        const currentEndpoint = currentSubscription?.endpoint ?? null;

        // Detect legacy FCM endpoint and force re-subscribe
        const isLegacyEndpoint = currentEndpoint?.includes('fcm.googleapis.com/fcm/send/');
        if (isLegacyEndpoint && currentSubscription) {
          debugConsole.log('🔄 Legacy FCM endpoint detected, forcing re-subscription...', { endpoint: currentEndpoint });
          await currentSubscription.unsubscribe();
          // Also deactivate the old DB record
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('user_id', user.id)
            .eq('endpoint', currentEndpoint);
          await subscribeToPush();
          return;
        }

        const { data } = await supabase
          .from('push_subscriptions')
          .select('id, endpoint')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1);

        const dbEndpoint = data?.[0]?.endpoint ?? null;

        // Also check if DB endpoint is legacy
        const isDbLegacy = dbEndpoint?.includes('fcm.googleapis.com/fcm/send/');

        if (!data || data.length === 0 || isDbLegacy || (currentEndpoint && dbEndpoint && currentEndpoint !== dbEndpoint)) {
          debugConsole.log('🔄 Push subscription mismatch, missing, or legacy endpoint — auto-renewing...', {
            hasDbRecord: Boolean(data?.length),
            endpointMatch: currentEndpoint === dbEndpoint,
            isDbLegacy,
          });
          if (currentSubscription) {
            await currentSubscription.unsubscribe();
          }
          if (isDbLegacy && dbEndpoint) {
            await supabase
              .from('push_subscriptions')
              .update({ is_active: false })
              .eq('user_id', user.id)
              .eq('endpoint', dbEndpoint);
          }
          await subscribeToPush();
        }
      } catch (error: unknown) {
        debugConsole.error('Error checking/renewing push subscription:', error);
      }
    };

    void checkAndRenewSubscription();
  }, [user, pushSupported, pushPermission, subscribeToPush]);

  return {
    notifications,
    unreadCount,
    loading,
    pushSupported,
    pushPermission,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestPushPermission,
    subscribeToPush,
  };
};
