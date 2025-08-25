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

  // Mark notification as read with cross-tab sync
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    // Optimistic update
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId 
          ? { ...n, is_read: true }
          : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

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

      // Trigger cross-tab update
      localStorage.setItem(`notifications-update-${user.id}`, Date.now().toString());
      localStorage.removeItem(`notifications-update-${user.id}`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Revert optimistic update on error
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: false }
            : n
        )
      );
      setUnreadCount(prev => prev + 1);
    }
  }, [user]);

  // Mark all notifications as read with cross-tab sync
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    // Optimistic update
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    
    setNotifications(prev => 
      prev.map(n => ({ ...n, is_read: true }))
    );
    setUnreadCount(0);

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

      // Trigger cross-tab update
      localStorage.setItem(`notifications-update-${user.id}`, Date.now().toString());
      localStorage.removeItem(`notifications-update-${user.id}`);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      // Revert optimistic update on error
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      
      toast({
        title: 'Fehler',
        description: 'Benachrichtigungen konnten nicht als gelesen markiert werden.',
        variant: 'destructive',
      });
    }
  }, [user, toast, notifications, unreadCount]);

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
    if (!user || !pushSupported || pushPermission !== 'granted') {
      console.log('❌ Cannot subscribe - requirements not met:', {
        user: !!user,
        pushSupported,
        pushPermission
      });
      return;
    }

    try {
      console.log('🔄 Starting push subscription process...');
      
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      console.log('✅ Service worker registered');

      // Get existing subscription or create new one
      let subscription = await registration.pushManager.getSubscription();
      console.log('📋 Existing subscription:', !!subscription);
      
      // Always check if we need to create a new subscription
      // Either no subscription exists OR the database subscription is inactive
      let needNewSubscription = !subscription;
      
      if (subscription) {
        // Check if current subscription is active in database
        const { data: dbSubscription } = await supabase
          .from('push_subscriptions')
          .select('is_active')
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint)
          .single();
          
        if (!dbSubscription || !dbSubscription.is_active) {
          console.log('🔄 Database subscription is inactive, creating new one...');
          await subscription.unsubscribe();
          needNewSubscription = true;
        }
      }
      
      if (needNewSubscription) {
        console.log('🔧 Creating new push subscription...');
        // Use the VAPID public key that matches the server
        const vapidPublicKey = 'BN4HS-d_H4M5nHH5hF5b5d3nOJwKzFgVzn6DQvYVrD5YF5TdFjyOh2FjF5D3hMF9s5fHJsYF5fHsYF5hYMfF5F8';
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        console.log('✅ New subscription created');
      } else {
        console.log('ℹ️ Using existing active subscription');
      }

      if (subscription) {
        console.log('💾 Saving subscription to database...');
        console.log('📋 Subscription endpoint:', subscription.endpoint);
        
        // Extract keys from subscription
        const p256dh = subscription.getKey('p256dh');
        const auth = subscription.getKey('auth');

        if (!p256dh || !auth) {
          console.error('❌ Invalid subscription keys');
          throw new Error('Invalid subscription keys');
        }

        console.log('🔑 Subscription keys extracted successfully');

        // Convert keys to base64
        const p256dhBase64 = btoa(String.fromCharCode(...new Uint8Array(p256dh)));
        const authBase64 = btoa(String.fromCharCode(...new Uint8Array(auth)));

        console.log('🔑 Keys converted to base64:', {
          p256dh_length: p256dhBase64.length,
          auth_length: authBase64.length
        });

        // Save to database
        const { error } = await supabase
          .from('push_subscriptions')
          .upsert({
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh_key: p256dhBase64,
            auth_key: authBase64,
            user_agent: navigator.userAgent,
            is_active: true,
          }, {
            onConflict: 'user_id,endpoint'
          });

        if (error) {
          console.error('❌ Database error:', error);
          throw error;
        }

        console.log('✅ Subscription saved to database successfully');

        toast({
          title: 'Erfolgreich',
          description: 'Push-Benachrichtigungen wurden aktiviert.',
        });
      }
    } catch (error) {
      console.error('❌ Error subscribing to push:', error);
      toast({
        title: 'Fehler',
        description: 'Push-Benachrichtigungen konnten nicht aktiviert werden.',
        variant: 'destructive',
      });
      throw error; // Re-throw so calling code can handle it
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

  // Set up real-time subscription with cross-tab synchronization
  useEffect(() => {
    if (!user) return;

    console.log('Setting up notifications realtime subscription for user:', user.id);

    // Create unique channel per user to avoid conflicts
    const channel = supabase
      .channel(`user-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('📥 New notification received via realtime:', payload);
          const newNotification = payload.new as Notification;
          
          // Check for duplicates and add with additional metadata check
          setNotifications(prev => {
            const exists = prev.some(n => n.id === newNotification.id);
            if (exists) {
              console.log('🔄 Duplicate notification prevented:', newNotification.id);
              return prev;
            }
            
            console.log('✅ Adding new notification:', newNotification.id);
            return [newNotification, ...prev];
          });
          
          // Only increment if not read
          if (!newNotification.is_read) {
            setUnreadCount(prev => prev + 1);
          }
          
          // Show toast for new notification with better fallback
          toast({
            title: newNotification.title || 'Neue Benachrichtigung',
            description: newNotification.message || 'Sie haben eine neue Benachrichtigung erhalten.',
            duration: 4000,
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
          console.log('📝 Notification updated via realtime:', payload);
          const updatedNotification = payload.new as Notification;
          const oldNotification = payload.old as Notification;
          
          setNotifications(prev => 
            prev.map(notif => 
              notif.id === updatedNotification.id ? { ...updatedNotification } : notif
            )
          );
          
          // Update unread count based on read status change
          if (oldNotification && updatedNotification.is_read !== oldNotification.is_read) {
            if (updatedNotification.is_read && !oldNotification.is_read) {
              // Marked as read
              setUnreadCount(prev => Math.max(0, prev - 1));
              console.log('📖 Notification marked as read, decreasing count');
            } else if (!updatedNotification.is_read && oldNotification.is_read) {
              // Marked as unread
              setUnreadCount(prev => prev + 1);
              console.log('📬 Notification marked as unread, increasing count');
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Notifications realtime subscription status:', status);
      });

    // Listen for storage events for cross-tab synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `notifications-update-${user.id}` && e.newValue) {
        console.log('🔄 Cross-tab notification update detected');
        loadNotifications();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      console.log('🧹 Cleaning up notifications realtime subscription');
      supabase.removeChannel(channel);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, toast, loadNotifications]);

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