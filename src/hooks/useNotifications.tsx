// @refresh reset
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
  navigation_context?: string;
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
      
      // Also trigger navigation notifications update
      localStorage.setItem('notifications_marked_read', JSON.stringify({
        timestamp: Date.now(),
        userId: user.id
      }));
      localStorage.removeItem('notifications_marked_read');
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

  // Delete a single notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;

    // Optimistic update
    const wasUnread = notifications.find(n => n.id === notificationId && !n.is_read);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting notification:', error);
      // Reload to restore state
      loadNotifications();
    }
  }, [user, notifications, loadNotifications]);

  // Mark all notifications as read with cross-tab sync
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    // Check if there are any unread notifications locally first
    const hasUnread = notifications.some(n => !n.is_read);
    if (!hasUnread) {
      // Nothing to do - no unread notifications
      return;
    }

    // Store previous state for potential rollback
    const previousNotifications = [...notifications];
    const previousUnreadCount = unreadCount;
    
    // Optimistic update
    setNotifications(prev => 
      prev.map(n => ({ ...n, is_read: true }))
    );
    setUnreadCount(0);

    try {
      // First get the IDs of unread notifications from database
      const { data: unreadNotifications, error: fetchError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (fetchError) throw fetchError;

      // If database says no unread notifications, optimistic update is already correct
      if (!unreadNotifications || unreadNotifications.length === 0) {
        return;
      }

      // Update by ID list to avoid potential RLS issues
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .in('id', unreadNotifications.map(n => n.id));

      if (error) throw error;

      // Trigger cross-tab update
      localStorage.setItem(`notifications-update-${user.id}`, Date.now().toString());
      localStorage.removeItem(`notifications-update-${user.id}`);
      
      // Also trigger navigation notifications update
      localStorage.setItem('notifications_marked_read', Date.now().toString());
      localStorage.removeItem('notifications_marked_read');
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      
      // Check if it's a network error - the operation may have succeeded
      const isNetworkError = error?.message?.includes('Failed to fetch') || 
                             error?.message?.includes('NetworkError') ||
                             error?.message?.includes('fetch');
      
      if (isNetworkError) {
        // Don't revert - operation likely succeeded, reload to confirm
        console.log('Network error during markAllAsRead - reloading to verify state');
        setTimeout(() => loadNotifications(), 1000);
      } else {
        // Revert optimistic update on real error
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
      let subscription = await (registration as any).pushManager.getSubscription();
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
        
        // Fetch VAPID public key from Edge Function using GET request
        console.log('🔑 Fetching VAPID public key from Edge Function...');
        try {
          const vapidResponse = await fetch(`https://wawofclbehbkebjivdte.supabase.co/functions/v1/send-push-notification`, {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50',
              'Content-Type': 'application/json'
            }
          });
          
          if (!vapidResponse.ok) {
            throw new Error(`HTTP error! status: ${vapidResponse.status}`);
          }
          
          const vapidData = await vapidResponse.json();
          
          if (!vapidData.success) {
            throw new Error('Failed to fetch VAPID public key: ' + (vapidData.error || 'Unknown error'));
          }
          
          const vapidPublicKey = vapidData.publicKey;
          console.log('🔑 Got VAPID public key from server');
        
          subscription = await (registration as any).pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
          console.log('✅ New subscription created');
        } catch (error) {
          console.error('❌ Failed to get VAPID key or create subscription:', error);
          throw error;
        }
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

  // Set up real-time subscription with cross-tab synchronization and retry logic
  useEffect(() => {
    if (!user) return;

    let retryCount = 0;
    const maxRetries = 5;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let subscriptionHealthy = false;

    const startPollingFallback = () => {
      if (pollingInterval) return;
      // Polling is fallback-only and should not run continuously during healthy realtime.
      pollingInterval = setInterval(() => {
        if (!subscriptionHealthy) {
          loadNotifications();
        }
      }, 120000);
    };

    const stopPollingFallback = () => {
      if (!pollingInterval) return;
      clearInterval(pollingInterval);
      pollingInterval = null;
    };

    const setupChannel = () => {
      // Clean up previous channel if exists
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
      }

      console.log(`Setting up notifications realtime subscription for user: ${user.id} (attempt ${retryCount + 1})`);

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
          async (payload) => {
            console.log('📥 New notification received via realtime:', payload);
            
            const { data: fullNotification } = await supabase
              .from('notifications')
              .select('*, notification_types(name, label)')
              .eq('id', (payload.new as any).id)
              .maybeSingle();
            
            const newNotification = (fullNotification || payload.new) as Notification;
            
            setNotifications(prev => {
              const exists = prev.some(n => n.id === newNotification.id);
              if (exists) return prev;
              return [newNotification, ...prev];
            });
            
            if (!newNotification.is_read) {
              setUnreadCount(prev => prev + 1);
            }
            
            // Notify navigation notifications hook about the change
            window.dispatchEvent(new Event('notifications-changed'));
            
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
            const updatedNotification = payload.new as Notification;
            const oldNotification = payload.old as Notification;
            
            setNotifications(prev => 
              prev.map(notif => 
                notif.id === updatedNotification.id ? { ...updatedNotification } : notif
              )
            );
            
            if (oldNotification && updatedNotification.is_read !== oldNotification.is_read) {
              if (updatedNotification.is_read && !oldNotification.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
              } else if (!updatedNotification.is_read && oldNotification.is_read) {
                setUnreadCount(prev => prev + 1);
              }
            }
            
            // Notify navigation notifications hook about the change
            window.dispatchEvent(new Event('notifications-changed'));
          }
        )
        .subscribe((status) => {
          console.log('📡 Notifications realtime subscription status:', status);
          if (status === 'SUBSCRIBED') {
            subscriptionHealthy = true;
            retryCount = 0; // Reset on successful connection
            stopPollingFallback();
            // Load notifications immediately after subscribing to catch any missed during setup
            loadNotifications();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            subscriptionHealthy = false;
            startPollingFallback();
            if (retryCount < maxRetries) {
              retryCount++;
              const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
              console.log(`🔄 Retrying subscription in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
              retryTimeout = setTimeout(setupChannel, delay);
            }
          } else if (status === 'CLOSED') {
            subscriptionHealthy = false;
            startPollingFallback();
          }
        });
    };

    setupChannel();

    // Start fallback until realtime is confirmed healthy.
    startPollingFallback();

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
      if (retryTimeout) clearTimeout(retryTimeout);
      stopPollingFallback();
      if (currentChannel) supabase.removeChannel(currentChannel);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, toast, loadNotifications]);

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Auto-renew push subscription if permission is granted but no active DB subscription
  useEffect(() => {
    if (!user || !pushSupported || pushPermission !== 'granted') return;

    const checkAndRenewSubscription = async () => {
      try {
        // Get current browser subscription endpoint
        const registration = await navigator.serviceWorker?.getRegistration('/sw.js');
        const currentSub = registration ? await (registration as any).pushManager?.getSubscription() : null;
        const currentEndpoint = currentSub?.endpoint;

        const { data } = await supabase
          .from('push_subscriptions')
          .select('id, endpoint')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1);

        const dbEndpoint = data?.[0]?.endpoint;
        
        // Re-subscribe if no active DB record OR endpoint mismatch
        if (!data || data.length === 0 || (currentEndpoint && dbEndpoint && currentEndpoint !== dbEndpoint)) {
          console.log('🔄 Push subscription mismatch or missing, auto-renewing...', {
            hasDbRecord: !!data?.length,
            endpointMatch: currentEndpoint === dbEndpoint
          });
          await subscribeToPush();
        }
      } catch (error) {
        console.error('Error checking/renewing push subscription:', error);
      }
    };

    checkAndRenewSubscription();
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
