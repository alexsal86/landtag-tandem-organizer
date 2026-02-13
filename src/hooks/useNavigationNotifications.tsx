import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';

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
  const { currentTenant } = useTenant();
  const [navigationCounts, setNavigationCounts] = useState<NavigationCounts>({});
  const [lastVisited, setLastVisited] = useState<Record<string, Date>>({});
  const [isLoading, setIsLoading] = useState(true);
  // Suppress realtime reload briefly after manual mark-as-read
  const suppressReloadUntil = useRef<number>(0);

  const loadNavigationCounts = async () => {
    if (!user || !currentTenant) return;
    // Skip if we just manually updated
    if (Date.now() < suppressReloadUntil.current) return;

    try {
      // Only count unread notifications per navigation context
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('navigation_context')
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

      // Count overdue or due annual tasks for administration badge
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const { data: annualTasks } = await supabase
        .from('annual_tasks')
        .select(`
          id,
          due_month,
          annual_task_completions!left(id, year, completed_at)
        `)
        .or(`tenant_id.eq.${currentTenant.id},tenant_id.is.null`);

      if (annualTasks) {
        const overdueOrDueCount = annualTasks.filter((task: any) => {
          const completions = task.annual_task_completions || [];
          const currentYearCompletion = completions.find((c: any) => c.year === currentYear && c.completed_at);
          if (currentYearCompletion) return false;
          return task.due_month <= currentMonth;
        }).length;
        
        counts['annual_tasks'] = overdueOrDueCount;
        counts['administration'] = (counts['administration'] || 0) + overdueOrDueCount;
      }

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
      // Suppress realtime reloads for 2 seconds after manual update
      suppressReloadUntil.current = Date.now() + 2000;

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
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: now.toISOString() })
        .eq('user_id', user.id)
        .eq('navigation_context', context)
        .eq('is_read', false);

      // Update local state immediately
      setLastVisited(prev => ({
        ...prev,
        [context]: now,
      }));

      // Reset navigation count for this context
      setNavigationCounts(prev => {
        const updated = { ...prev, [context]: 0 };
        return updated;
      });

      // Cross-tab sync
      localStorage.setItem('navigation_visit_sync', JSON.stringify({
        context,
        timestamp: now.toISOString(),
        userId: user.id,
      }));
      localStorage.removeItem('navigation_visit_sync');

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
    return count > 0;
  };

  // Load initial data
  useEffect(() => {
    if (user && currentTenant) {
      loadNavigationCounts();
    } else {
      setNavigationCounts({});
      setLastVisited({});
      setIsLoading(false);
    }
  }, [user, currentTenant]);

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
