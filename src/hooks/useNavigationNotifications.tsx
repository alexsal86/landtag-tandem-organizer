import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { debugConsole } from '@/utils/debugConsole';

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

type NavigationVisitRealtimePayload = RealtimePostgresChangesPayload<NavigationVisitRow>;
type NavigationVisitRealtimeEvent =
  | { type: 'navigation-visit-insert'; payload: NavigationVisitRealtimePayload & { eventType: 'INSERT' } }
  | { type: 'navigation-visit-update'; payload: NavigationVisitRealtimePayload & { eventType: 'UPDATE' } }
  | { type: 'navigation-visit-delete'; payload: NavigationVisitRealtimePayload & { eventType: 'DELETE' } };

type NavigationSyncPayload = {
  context?: string;
  timestamp?: string;
  userId?: string;
};

type NavigationStorageEvent =
  | { type: 'navigation-visit-sync'; payload: NavigationSyncPayload }
  | { type: 'notifications-marked-read' };

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

const parseNavigationStorageEvent = (event: StorageEvent): NavigationStorageEvent | null => {
  if (!event.newValue) {
    return null;
  }

  if (event.key === 'navigation_visit_sync') {
    const payload = parseNavigationSyncPayload(event.newValue);
    return payload ? { type: 'navigation-visit-sync', payload } : null;
  }

  if (event.key === 'notifications_marked_read') {
    return { type: 'notifications-marked-read' };
  }

  return null;
};

const mapNavigationVisitRealtimeEvent = (
  payload: NavigationVisitRealtimePayload,
): NavigationVisitRealtimeEvent | null => {
  if (payload.eventType === 'INSERT') {
    return { type: 'navigation-visit-insert', payload: payload as NavigationVisitRealtimePayload & { eventType: 'INSERT' } };
  }
  if (payload.eventType === 'UPDATE') {
    return { type: 'navigation-visit-update', payload: payload as NavigationVisitRealtimePayload & { eventType: 'UPDATE' } };
  }
  if (payload.eventType === 'DELETE') {
    return { type: 'navigation-visit-delete', payload: payload as NavigationVisitRealtimePayload & { eventType: 'DELETE' } };
  }
  return null;
};

const QUERY_KEY = 'navigation-notification-counts';

const fetchNavigationCounts = async (userId: string, tenantId: string): Promise<NavigationCounts> => {
  // Use RPC to get aggregated counts instead of fetching all notification rows
  const { data: rpcCounts, error: rpcError } = await supabase
    .rpc('get_unread_notification_counts', { p_user_id: userId });

  if (rpcError) {
    debugConsole.error('Error loading navigation counts via RPC:', rpcError);
    throw rpcError;
  }

  const counts: NavigationCounts = (rpcCounts as NavigationCounts) ?? {};

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const { data: annualTasks, error: annualTasksError } = await supabase
    .from('annual_tasks')
    .select(`
      id,
      due_month,
      annual_task_completions!left(id, year, completed_at)
    `)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

  if (annualTasksError) {
    debugConsole.error('Error loading annual task counts:', annualTasksError);
  }

  const annualTaskRows = (annualTasks as AnnualTaskRow[] | null) ?? [];
  const overdueOrDueCount = annualTaskRows.filter((task: AnnualTaskRow): boolean => {
    if (task.due_month == null) return false;
    const completions = task.annual_task_completions ?? [];
    const currentYearCompletion = completions.find(
      (completion: AnnualTaskCompletionRow): boolean =>
        completion.year === currentYear && completion.completed_at != null,
    );
    if (currentYearCompletion) return false;
    return task.due_month <= currentMonth;
  }).length;

  counts.annual_tasks = overdueOrDueCount;
  counts.administration = (counts.administration ?? 0) + overdueOrDueCount;

  return counts;
};

export const useNavigationNotifications = (): NavigationNotifications => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const suppressReloadUntil = useRef<number>(0);

  const userId = user?.id;
  const tenantId = currentTenant?.id;

  const { data: navigationCounts = {}, isLoading } = useQuery({
    queryKey: [QUERY_KEY, userId, tenantId],
    queryFn: () => fetchNavigationCounts(userId!, tenantId!),
    enabled: !!userId && !!tenantId,
    staleTime: 60_000, // 1 minute — prevents refetch on every mount
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const invalidateCounts = useCallback(() => {
    if (Date.now() < suppressReloadUntil.current) return;
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, userId, tenantId] });
  }, [queryClient, userId, tenantId]);

  const markNavigationAsVisited = useCallback(async (context: string): Promise<void> => {
    if (!user || context.trim() === '') return;

    try {
      const now = new Date();
      suppressReloadUntil.current = Date.now() + 5000;

      // Optimistic update
      queryClient.setQueryData<NavigationCounts>(
        [QUERY_KEY, userId, tenantId],
        (prev) => prev ? { ...prev, [context]: 0 } : { [context]: 0 },
      );

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
  }, [user, userId, tenantId, queryClient]);

  const hasNewSinceLastVisit = useCallback((context: string): boolean => {
    return (navigationCounts[context] ?? 0) > 0;
  }, [navigationCounts]);

  // Realtime + event listeners for invalidation
  useEffect(() => {
    if (!user) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channelName = `navigation_visits_only_${user.id}_${crypto.randomUUID()}`;
    const debouncedInvalidate = (): void => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(invalidateCounts, 1000);
    };

    const handleNotificationUpdate = (_event: Event): void => {
      debouncedInvalidate();
    };

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_navigation_visits',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: NavigationVisitRealtimePayload): void => {
          const visitEvent = mapNavigationVisitRealtimeEvent(payload);
          if (!visitEvent) {
            return;
          }
          debouncedInvalidate();
        },
      )
      .subscribe();

    window.addEventListener('notifications-changed', handleNotificationUpdate);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
      window.removeEventListener('notifications-changed', handleNotificationUpdate);
    };
  }, [invalidateCounts, user]);

  // Cross-tab sync
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent): void => {
      if (!user) return;
      const storageEvent = parseNavigationStorageEvent(event);
      if (!storageEvent) return;

      if (storageEvent.type === 'navigation-visit-sync') {
        const payload = storageEvent.payload;
        if (payload.userId !== user.id || !payload.context || !payload.timestamp) return;

        queryClient.setQueryData<NavigationCounts>(
          [QUERY_KEY, userId, tenantId],
          (prev) => prev ? { ...prev, [payload.context as string]: 0 } : { [payload.context as string]: 0 },
        );
        return;
      }

      if (storageEvent.type === 'notifications-marked-read') {
        invalidateCounts();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [invalidateCounts, user, userId, tenantId, queryClient]);

  return {
    navigationCounts,
    hasNewSinceLastVisit,
    markNavigationAsVisited,
    isLoading,
  };
};
