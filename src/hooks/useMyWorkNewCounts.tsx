import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { STALE_TIME } from '@/lib/query-cache';
import { debugConsole } from '@/utils/debugConsole';

export interface NewCounts {
  tasks: number;
  decisions: number;
  jourFixe: number;
  cases: number;
  caseFiles: number;
  caseItems: number;
  plannings: number;
  team: number;
  feedbackFeed: number;
}

const TEAM_NAV_CONTEXT = 'mywork_team' as const;
const FEEDBACK_NAV_CONTEXT = 'mywork_feedbackfeed' as const;

const CONTEXTS = [
  'mywork_tasks',
  'mywork_decisions',
  'mywork_jourFixe',
  'mywork_casefiles',
  'mywork_caseitems',
  'mywork_plannings',
  TEAM_NAV_CONTEXT,
  FEEDBACK_NAV_CONTEXT,
] as const;

export type ContextType = typeof CONTEXTS[number];

const CONTEXT_TO_COUNT_KEY: Record<ContextType, keyof NewCounts> = {
  mywork_tasks: 'tasks',
  mywork_decisions: 'decisions',
  mywork_jourFixe: 'jourFixe',
  mywork_casefiles: 'caseFiles',
  mywork_caseitems: 'caseItems',
  mywork_plannings: 'plannings',
  [TEAM_NAV_CONTEXT]: 'team',
  [FEEDBACK_NAV_CONTEXT]: 'feedbackFeed',
};

interface MyWorkNewCountsResult {
  newCounts: NewCounts;
  isLoading: boolean;
  markTabAsVisited: (context: ContextType) => Promise<void>;
  refreshCounts: (contexts?: ContextType[]) => Promise<void>;
}

const DEFAULT_COUNTS: NewCounts = {
  tasks: 0,
  decisions: 0,
  jourFixe: 0,
  cases: 0,
  caseFiles: 0,
  caseItems: 0,
  plannings: 0,
  team: 0,
  feedbackFeed: 0,
};

const REFRESH_THROTTLE_MS = 1200;

const isMissingRpcError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === 'PGRST202'
    || (maybeError.message?.includes('get_my_work_new_counts') ?? false)
  );
};

async function fetchNewCounts(userId: string, contexts?: ContextType[]): Promise<NewCounts | 'missing-rpc'> {
  const { data, error } = await supabase.rpc('get_my_work_new_counts', {
    p_user_id: userId,
    p_contexts: contexts && contexts.length > 0 ? (contexts as string[]) : undefined,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      debugConsole.warn('get_my_work_new_counts RPC is unavailable; new badges are reset to 0.');
      return 'missing-rpc';
    }
    throw error;
  }

  const incoming = (data || {}) as Partial<NewCounts>;
  const normalized: NewCounts = {
    ...DEFAULT_COUNTS,
    ...Object.fromEntries(
      Object.entries(incoming).map(([key, value]) => [key, Number(value || 0)]),
    ),
  } as NewCounts;
  normalized.cases = normalized.caseItems + normalized.caseFiles;
  return normalized;
}

export function useMyWorkNewCounts(): MyWorkNewCountsResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const queryKey = ['my-work-new-counts', userId] as const;

  const lastRefreshAtRef = useRef(0);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!userId,
    staleTime: STALE_TIME.REALTIME,
    gcTime: STALE_TIME.LIST_WITH_REALTIME,
    queryFn: async () => {
      const result = await fetchNewCounts(userId as string);
      return result === 'missing-rpc' ? DEFAULT_COUNTS : result;
    },
  });

  const refreshCounts = useCallback(async (contexts?: ContextType[]) => {
    if (!userId) return;

    const run = async () => {
      try {
        const result = await fetchNewCounts(userId, contexts);
        lastRefreshAtRef.current = Date.now();
        if (result === 'missing-rpc') {
          if (contexts && contexts.length > 0) {
            queryClient.setQueryData<NewCounts>(queryKey, (prev) => {
              const base = prev ?? DEFAULT_COUNTS;
              const updated: NewCounts = { ...base };
              contexts.forEach((context) => {
                updated[CONTEXT_TO_COUNT_KEY[context]] = 0;
              });
              updated.cases = updated.caseItems + updated.caseFiles;
              return updated;
            });
          } else {
            queryClient.setQueryData<NewCounts>(queryKey, DEFAULT_COUNTS);
          }
          return;
        }

        if (contexts && contexts.length > 0) {
          // Partial update — merge with existing cache
          queryClient.setQueryData<NewCounts>(queryKey, (prev) => {
            const base = prev ?? DEFAULT_COUNTS;
            const merged: NewCounts = { ...base };
            contexts.forEach((context) => {
              const key = CONTEXT_TO_COUNT_KEY[context];
              merged[key] = result[key];
            });
            merged.cases = merged.caseItems + merged.caseFiles;
            return merged;
          });
        } else {
          queryClient.setQueryData<NewCounts>(queryKey, result);
        }
      } catch (error) {
        debugConsole.error('Error loading new counts via RPC:', error);
      }
    };

    const sinceLastRefresh = Date.now() - lastRefreshAtRef.current;
    if (sinceLastRefresh < REFRESH_THROTTLE_MS) {
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      await new Promise<void>((resolve) => {
        throttleTimerRef.current = setTimeout(() => {
          run().finally(resolve);
        }, REFRESH_THROTTLE_MS - sinceLastRefresh);
      });
      return;
    }

    await run();
  }, [userId, queryClient, queryKey]);

  const markTabAsVisited = useCallback(async (context: ContextType) => {
    if (!userId) return;

    const now = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('user_navigation_visits')
        .upsert({
          user_id: userId,
          navigation_context: context,
          last_visited_at: now,
        }, { onConflict: 'user_id,navigation_context' });

      if (error) throw error;

      const countKey = CONTEXT_TO_COUNT_KEY[context];
      queryClient.setQueryData<NewCounts>(queryKey, (prev) => {
        const base = prev ?? DEFAULT_COUNTS;
        const next: NewCounts = { ...base, [countKey]: 0 };
        next.cases = next.caseItems + next.caseFiles;
        return next;
      });

      localStorage.setItem('navigation_visit_sync', JSON.stringify({
        userId,
        context,
        timestamp: now,
      }));
    } catch (error) {
      debugConsole.error('Error marking tab as visited:', error);
    }
  }, [userId, queryClient, queryKey]);

  return {
    newCounts: data ?? DEFAULT_COUNTS,
    isLoading,
    markTabAsVisited,
    refreshCounts,
  };
}
