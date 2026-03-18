import { useState, useEffect, useRef, useCallback } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { debugConsole } from '@/utils/debugConsole';

interface NavigationNotificationRow {
  navigation_context: string | null;
}

interface AnnualTaskCompletionRow {
  year: number | null;
  completed_at: string | null;
}

interface AnnualTaskRow {
  due_month: number | null;
  annual_task_completions: AnnualTaskCompletionRow[] | null;
}

interface NavigationVisitRow {
  navigation_context: string;
  last_visited_at: string | null;
}

type NavigationSyncPayload = {
  context?: string;
  timestamp?: string;
  userId?: string;
};

type NotificationsChangedDetail = {
  source: 'notifications' | 'navigation';
  notificationId?: string;
  context?: string;
};

export interface NavigationCounts {
  [key: string]: number;
}

export interface NavigationNotifications {
  navigationCounts: NavigationCounts;
  hasNewSinceLastVisit: (context: string) => boolean;
  markNavigationAsVisited: (context: string) => Promise<void>;
  isLoading: boolean;
}

const parseNavigationSyncPayload = (value: string): NavigationSyncPayload | null => {
  try {
    return JSON.parse(value) as NavigationSyncPayload;
  } catch (error: unknown) {
    debugConsole.error('Error parsing navigation sync payload:', error);
    return null;
  }
};

export const useNavigationNotifications = (): NavigationNotifications => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [navigationCounts, setNavigationCounts] = useState<NavigationCounts>({});
  const [, setLastVisited] = useState<Record<string, Date>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const suppressReloadUntil = useRef<number>(0);

  const loadNavigationCounts = useCallback(async (): Promise<void> => {
    if (!user || !currentTenant) {
      setNavigationCounts({});
      setLastVisited({});
      setIsLoading(false);
      return;
    }

    if (Date.now() < suppressReloadUntil.current) {
      return;
    }

    setIsLoading(true);

    try {
      const { data: notifications, error: notificationsError } = await supabase
        .from('notifications')
        .select('navigation_context')
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (notificationsError) {
        debugConsole.error('Error loading navigation counts:', notificationsError);
        return;
      }

      const counts: NavigationCounts = {};
      ((notifications as NavigationNotificationRow[] | null) ?? []).forEach(
        (notification: NavigationNotificationRow): void => {
          const context = notification.navigation_context;
          if (!context) {
            return;
          }

          counts[context] = (counts[context] ?? 0) + 1;
        },
      );

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const { data: annualTasks, error: annualTasksError } = await supabase
        .from('annual_tasks')
        .select(`
          id,
          due_month,
          annual_task_completions!left(id, year, completed_at)
        `)
        .or(`tenant_id.eq.${currentTenant.id},tenant_id.is.null`);

      if (annualTasksError) {
        debugConsole.error('Error loading annual task counts:', annualTasksError);
      }

      const annualTaskRows = (annualTasks as AnnualTaskRow[] | null) ?? [];
      const overdueOrDueCount = annualTaskRows.filter((task: AnnualTaskRow): boolean => {
        if (task.due_month == null) {
          return false;
        }

        const completions = task.annual_task_completions ?? [];
        const currentYearCompletion = completions.find(
          (completion: AnnualTaskCompletionRow): boolean =>
            completion.year === currentYear && completion.completed_at != null,
        );

        if (currentYearCompletion) {
          return false;
        }

        return task.due_month <= currentMonth;
      }).length;

      counts.annual_tasks = overdueOrDueCount;
      counts.administration = (counts.administration ?? 0) + overdueOrDueCount;
      setNavigationCounts(counts);

      const { data: visits, error: visitsError } = await supabase
        .from('user_navigation_visits')
        .select('navigation_context, last_visited_at')
        .eq('user_id', user.id);

      if (visitsError) {
        debugConsole.error('Error loading visits:', visitsError);
        return;
      }

      const visitMap: Record<string, Date> = {};
      ((visits as NavigationVisitRow[] | null) ?? []).forEach((visit: NavigationVisitRow): void => {
        if (!visit.navigation_context || !visit.last_visited_at) {
          return;
        }

        visitMap[visit.navigation_context] = new Date(visit.last_visited_at);
      });

      setLastVisited(visitMap);
    } catch (error: unknown) {
      debugConsole.error('Error in loadNavigationCounts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, user]);

  const markNavigationAsVisited = useCallback(async (context: string): Promise<void> => {
    if (!user || context.trim() === '') {
      return;
    }

    try {
      const now = new Date();
      suppressReloadUntil.current = Date.now() + 5000;

      const { error: visitError } = await supabase
        .from('user_navigation_visits')
        .upsert(
          {
            user_id: user.id,
            navigation_context: context,
            last_visited_at: now.toISOString(),
          },
          { onConflict: 'user_id,navigation_context' },
        );

      if (visitError) {
        debugConsole.error('Error marking navigation as visited:', visitError);
        return;
      }

      const { error: notificationsError } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: now.toISOString() })
        .eq('user_id', user.id)
        .eq('navigation_context', context)
        .eq('is_read', false);

      if (notificationsError) {
        debugConsole.error('Error marking notifications as read for navigation context:', notificationsError);
      }

      setLastVisited((prev: Record<string, Date>) => ({
        ...prev,
        [context]: now,
      }));
      setNavigationCounts((prev: NavigationCounts) => ({
        ...prev,
        [context]: 0,
      }));

      const syncPayload = JSON.stringify({
        context,
        timestamp: now.toISOString(),
        userId: user.id,
      });

      localStorage.setItem('navigation_visit_sync', syncPayload);
      localStorage.removeItem('navigation_visit_sync');
      localStorage.setItem('notifications_marked_read', syncPayload);
      localStorage.removeItem('notifications_marked_read');

      window.dispatchEvent(
        new CustomEvent<NotificationsChangedDetail>('notifications-changed', {
          detail: { source: 'navigation', context },
        }),
      );
    } catch (error: unknown) {
      debugConsole.error('Error in markNavigationAsVisited:', error);
    }
  }, [user]);

  const hasNewSinceLastVisit = useCallback((context: string): boolean => {
    return (navigationCounts[context] ?? 0) > 0;
  }, [navigationCounts]);

  useEffect(() => {
    void loadNavigationCounts();
  }, [loadNavigationCounts]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoad = (): void => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout((): void => {
        void loadNavigationCounts();
      }, 1000);
    };

    const handleNotificationUpdate = (_event: Event): void => {
      debouncedLoad();
    };

    const channel = supabase
      .channel('navigation_visits_only')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_navigation_visits',
          filter: `user_id=eq.${user.id}`,
        },
        (_payload: RealtimePostgresChangesPayload<NavigationVisitRow>): void => {
          debouncedLoad();
        },
      )
      .subscribe();

    window.addEventListener('notifications-changed', handleNotificationUpdate);

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      void supabase.removeChannel(channel);
      window.removeEventListener('notifications-changed', handleNotificationUpdate);
    };
  }, [loadNavigationCounts, user]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent): void => {
      if (!user || !event.newValue) {
        return;
      }

      if (event.key === 'navigation_visit_sync') {
        const payload = parseNavigationSyncPayload(event.newValue);
        if (!payload || payload.userId !== user.id || !payload.context || !payload.timestamp) {
          return;
        }

        setLastVisited((prev: Record<string, Date>) => ({
          ...prev,
          [payload.context as string]: new Date(payload.timestamp as string),
        }));
        setNavigationCounts((prev: NavigationCounts) => ({
          ...prev,
          [payload.context as string]: 0,
        }));
        return;
      }

      if (event.key === 'notifications_marked_read') {
        void loadNavigationCounts();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadNavigationCounts, user]);

  return {
    navigationCounts,
    hasNewSinceLastVisit,
    markNavigationAsVisited,
    isLoading,
  };
};
