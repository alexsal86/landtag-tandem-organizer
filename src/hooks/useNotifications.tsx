import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Notification {
  id: string;
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  notification_types: {
    name: string;
    label: string;
  };
}

export interface NotificationSettings {
  id: string;
  notification_type_id: string;
  is_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}

export interface NotificationType {
  id: string;
  name: string;
  label: string;
  description?: string;
}

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  // Check push notification support
  useEffect(() => {
    const checkPushSupport = () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setPushSupported(supported);
      
      if (supported && 'Notification' in window) {
        setPushPermission(Notification.permission);
      }
    };

    checkPushSupport();
  }, []);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          notification_types(name, label)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications((data || []) as Notification[]);
      const unread = data?.filter(n => !n.is_read).length || 0;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({
        title: 'Fehler',
        description: 'Benachrichtigungen konnten nicht geladen werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true }
            : n
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast({
        title: 'Fehler',
        description: 'Benachrichtigungen konnten nicht als gelesen markiert werden.',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  // Request push permission
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
      } else {
        toast({
          title: 'Berechtigung verweigert',
          description: 'Push-Benachrichtigungen wurden nicht erlaubt.',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      console.error('Error requesting push permission:', error);
      toast({
        title: 'Fehler',
        description: 'Berechtigung für Push-Benachrichtigungen konnte nicht angefordert werden.',
        variant: 'destructive',
      });
      return false;
    }
  }, [pushSupported, toast]);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async () => {
    if (!user || !pushSupported || pushPermission !== 'granted') return;

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Get existing subscription or create new one
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription with VAPID public key
        const vapidPublicKey = 'BEelqtP2nJZSUYbfhTdv4SaQqTGCJXXn-2GXEcZdI9J_fdhg8Sb_FT7JqqQyoVQHO7hMJdm9MqA9YhwMc7a6V3E'; // VAPID public key
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      if (subscription) {
        // Save subscription to database
        const p256dh = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!)));
        const auth = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)));

        const { error } = await supabase
          .from('push_subscriptions')
          .upsert({
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh_key: p256dh,
            auth_key: auth,
            user_agent: navigator.userAgent,
            is_active: true,
          }, {
            onConflict: 'user_id,endpoint'
          });

        if (error) throw error;

        toast({
          title: 'Erfolgreich',
          description: 'Push-Benachrichtigungen wurden aktiviert.',
        });
      }
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast({
        title: 'Fehler',
        description: 'Push-Benachrichtigungen konnten nicht aktiviert werden.',
        variant: 'destructive',
      });
    }
  }, [user, pushSupported, pushPermission, toast]);

  // Helper function to convert VAPID key
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('New notification received:', payload);
          
          // Add to notifications list
          const newNotification = payload.new as any as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show toast for new notification
          toast({
            title: newNotification.title,
            description: newNotification.message,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Notification updated:', payload);
          const updatedNotification = payload.new as any as Notification;
          
          // Update notification in state
          setNotifications(prev => 
            prev.map(notif => 
              notif.id === updatedNotification.id ? updatedNotification : notif
            )
          );
          
          // Update unread count based on read status change
          if (updatedNotification.is_read && payload.old && !(payload.old as any).is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    pushSupported,
    pushPermission,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    requestPushPermission,
    subscribeToPush,
  };
};