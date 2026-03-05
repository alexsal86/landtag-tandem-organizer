import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface NewCounts {
  tasks: number;
  decisions: number;
  jourFixe: number;
  caseFiles: number;
  plannings: number;
  team: number;
  feedbackFeed: number;
}

const CONTEXTS = [
  'mywork_tasks',
  'mywork_decisions',
  'mywork_jourFixe',
  'mywork_casefiles',
  'mywork_plannings',
  'mywork_team',
  'mywork_feedbackfeed',
] as const;

export type ContextType = typeof CONTEXTS[number];

const CONTEXT_TO_COUNT_KEY: Record<ContextType, keyof NewCounts> = {
  mywork_tasks: 'tasks',
  mywork_decisions: 'decisions',
  mywork_jourFixe: 'jourFixe',
  mywork_casefiles: 'caseFiles',
  mywork_plannings: 'plannings',
  mywork_team: 'team',
  mywork_feedbackfeed: 'feedbackFeed',
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
  caseFiles: 0,
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
    || maybeError.message?.includes('get_my_work_new_counts')
  );
};

export function useMyWorkNewCounts(): MyWorkNewCountsResult {
  const { user } = useAuth();
  const [newCounts, setNewCounts] = useState<NewCounts>(DEFAULT_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const queuedContextsRef = useRef<Set<ContextType>>(new Set());
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);

  const runRefresh = useCallback(async (contexts?: ContextType[]) => {
    if (!user) {
      if (isMountedRef.current) {
        setNewCounts(DEFAULT_COUNTS);
        setIsLoading(false);
      }
      return;
    }

    if (isMountedRef.current) {
      setIsLoading(true);
    }

    try {
      const { data, error } = await supabase.rpc('get_my_work_new_counts', {
        p_user_id: user.id,
        p_contexts: contexts && contexts.length > 0 ? contexts : null,
      });

      if (error) {
        if (isMissingRpcError(error)) {
          const { data: fallbackData, error: fallbackError } = await supabase.rpc('get_my_work_counts' as any, {
            p_user_id: user.id,
            p_include_team: true,
          });

          if (fallbackError) throw fallbackError;

          const fallbackCounts = (fallbackData || {}) as Partial<NewCounts>;
          setNewCounts((prev) => ({
            ...prev,
            tasks: Number(fallbackCounts.tasks || 0),
            decisions: Number(fallbackCounts.decisions || 0),
            jourFixe: Number(fallbackCounts.jourFixe || 0),
            caseFiles: Number(fallbackCounts.caseFiles || 0),
            plannings: Number(fallbackCounts.plannings || 0),
            team: Number(fallbackCounts.team || 0),
            feedbackFeed: Number(fallbackCounts.feedbackFeed || 0),
          }));
          return;
        }

        throw error;
      }

      const incoming = (data || {}) as Partial<NewCounts>;
      setNewCounts((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(incoming).map(([key, value]) => [key, Number(value || 0)]),
        ),
      }));
    } catch (error) {
      console.error('Error loading new counts via RPC:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user]);

  const flushRefreshQueue = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;

    const queuedContexts = Array.from(queuedContextsRef.current);
    queuedContextsRef.current.clear();
    const promise = runRefresh(queuedContexts.length > 0 ? queuedContexts : undefined);
    inFlightRef.current = promise;

    await promise;
    inFlightRef.current = null;
    lastRefreshAtRef.current = Date.now();

    if (queuedContextsRef.current.size > 0) {
      await flushRefreshQueue();
    }
  }, [runRefresh]);

  const refreshCounts = useCallback(async (contexts?: ContextType[]) => {
    if (contexts && contexts.length > 0) {
      contexts.forEach((context) => queuedContextsRef.current.add(context));
    } else {
      CONTEXTS.forEach((context) => queuedContextsRef.current.add(context));
    }

    const sinceLastRefresh = Date.now() - lastRefreshAtRef.current;
    if (sinceLastRefresh < REFRESH_THROTTLE_MS) {
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      await new Promise<void>((resolve) => {
        throttleTimerRef.current = setTimeout(() => {
          flushRefreshQueue().finally(resolve);
        }, REFRESH_THROTTLE_MS - sinceLastRefresh);
      });
      return;
    }

    await flushRefreshQueue();
  }, [flushRefreshQueue]);

  const markTabAsVisited = useCallback(async (context: ContextType) => {
    if (!user) return;

    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('user_navigation_visits')
        .upsert({
          user_id: user.id,
          navigation_context: context,
          last_visited_at: now,
        }, { onConflict: 'user_id,navigation_context' });

      if (error) throw error;

      const countKey = CONTEXT_TO_COUNT_KEY[context];
      setNewCounts((prev) => ({
        ...prev,
        [countKey]: 0,
      }));

      localStorage.setItem('navigation_visit_sync', JSON.stringify({
        userId: user.id,
        context,
        timestamp: now,
      }));
    } catch (error) {
      console.error('Error marking tab as visited:', error);
    }
  }, [user]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  return {
    newCounts,
    isLoading,
    markTabAsVisited,
    refreshCounts,
  };
}
