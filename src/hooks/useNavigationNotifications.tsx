import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface NavigationCounts {
  [key: string]: number;
}

export interface NavigationNotifications {
  navigationCounts: NavigationCounts;
  hasNewSinceLastVisit: (context: string) => boolean;
  markNavigationAsVisited: (context: string) => Promise<void>;
  isLoading: boolean;
}

export const useNavigationNotifications = (): NavigationNotifications => {
  const { user } = useAuth();
  const [navigationCounts, setNavigationCounts] = useState<NavigationCounts>({});
  const [lastVisited, setLastVisited] = useState<Record<string, Date>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadNavigationCounts = async () => {
    if (!user) return;

    try {
      // Get unread notification counts per navigation context
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('navigation_context, created_at')
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error loading navigation counts:', error);
        return;
      }

      // Count notifications by context
      const counts: NavigationCounts = {};
      notifications?.forEach((notification) => {
        const context = notification.navigation_context;
        if (context) {
          counts[context] = (counts[context] || 0) + 1;
        }
      });

      setNavigationCounts(counts);

      // Load last visited timestamps
      const { data: visits, error: visitsError } = await supabase
        .from('user_navigation_visits')
        .select('navigation_context, last_visited_at')
        .eq('user_id', user.id);

      if (visitsError) {
        console.error('Error loading visits:', visitsError);
        return;
      }

      const visitMap: Record<string, Date> = {};
      visits?.forEach((visit) => {
        visitMap[visit.navigation_context] = new Date(visit.last_visited_at);
      });

      setLastVisited(visitMap);
    } catch (error) {
      console.error('Error in loadNavigationCounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markNavigationAsVisited = async (context: string) => {
    if (!user) return;

    try {
      const now = new Date();

      // Update or insert visit record
      const { error } = await supabase
        .from('user_navigation_visits')
        .upsert(
          {
            user_id: user.id,
            navigation_context: context,
            last_visited_at: now.toISOString(),
          },
          {
            onConflict: 'user_id,navigation_context',
          }
        );

      if (error) {
        console.error('Error marking navigation as visited:', error);
        return;
      }

      // Mark all notifications in this context as read
      const { error: notificationError } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: now.toISOString() })
        .eq('user_id', user.id)
        .eq('navigation_context', context)
        .eq('is_read', false);

      if (notificationError) {
        console.error('Error marking context notifications as read:', notificationError);
      }

      // Update local state
      setLastVisited(prev => ({
        ...prev,
        [context]: now,
      }));

      // Reset navigation count for this context
      setNavigationCounts(prev => ({
        ...prev,
        [context]: 0,
      }));

      // Trigger storage events for cross-tab sync
      localStorage.setItem('navigation_visit_sync', JSON.stringify({
        context,
        timestamp: now.toISOString(),
        userId: user.id,
      }));
      localStorage.removeItem('navigation_visit_sync');

      // Also trigger notification sync
      localStorage.setItem('notifications_marked_read', JSON.stringify({
        context,
        timestamp: now.toISOString(),
        userId: user.id,
      }));
      localStorage.removeItem('notifications_marked_read');
    } catch (error) {
      console.error('Error in markNavigationAsVisited:', error);
    }
  };

  const hasNewSinceLastVisit = (context: string): boolean => {
    const count = navigationCounts[context] || 0;
    const lastVisitDate = lastVisited[context];
    
    if (count === 0) return false;
    if (!lastVisitDate) return count > 0;

    // This is a simplified check - in a real implementation, 
    // you'd want to check if there are notifications newer than the last visit
    return count > 0;
  };

  // Load initial data
  useEffect(() => {
    if (user) {
      loadNavigationCounts();
    } else {
      setNavigationCounts({});
      setLastVisited({});
      setIsLoading(false);
    }
  }, [user]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('navigation_notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadNavigationCounts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_navigation_visits',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadNavigationCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Cross-tab synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'navigation_visit_sync' && e.newValue && user) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.userId === user.id) {
            setLastVisited(prev => ({
              ...prev,
              [data.context]: new Date(data.timestamp),
            }));
            // Reset count for this context
            setNavigationCounts(prev => ({
              ...prev,
              [data.context]: 0,
            }));
          }
        } catch (error) {
          console.error('Error parsing navigation visit sync data:', error);
        }
      }

      if (e.key === 'notifications_marked_read' && e.newValue && user) {
        // Reload counts when notifications are marked as read
        loadNavigationCounts();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user]);

  return {
    navigationCounts,
    hasNewSinceLastVisit,
    markNavigationAsVisited,
    isLoading,
  };
};