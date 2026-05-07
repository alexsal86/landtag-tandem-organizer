/**
 * Generic WorkItem list hook (Phase 2 closing piece).
 *
 * One entry point to fetch any work-item domain (`task`, `decision`,
 * `case_item`, `vorgang`) as a normalized `WorkItem[]`. Wraps the existing
 * domain queries through the shared adapters so callers no longer need to
 * pick the right per-domain hook for cross-domain UI.
 *
 * Currently routes to dedicated implementations per kind to avoid
 * duplicating the column-selection / filter knowledge that already lives in
 * each domain hook. The return shape is uniform.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { STALE_TIME } from '@/lib/query-cache';
import {
  caseItemToWorkItem,
  decisionToWorkItem,
  taskToWorkItem,
} from '@/hooks/work-items/adapters';
import type { WorkItem, WorkItemKind, WorkItemStatus } from '@/types/workItem';

export interface WorkItemListFilter {
  /** Restrict to items assigned to / owned by this user. */
  userId?: string;
  /** Filter by canonical status (any of). */
  status?: WorkItemStatus[];
  /** Hard cap (server-side). Default 100. */
  limit?: number;
}

interface Result {
  items: WorkItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const TASK_SELECT =
  'id, title, description, status, priority, due_date, created_at, updated_at, user_id, assigned_to, tenant_id, task_assignees:task_assignees(user_id)';
const DECISION_SELECT =
  'id, title, description, status, response_deadline, created_at, updated_at, created_by, tenant_id';
const CASE_SELECT =
  'id, subject, summary, status, priority, due_at, follow_up_at, user_id, owner_user_id, created_at, updated_at, tenant_id';

export function useWorkItemList(kind: WorkItemKind, filter: WorkItemListFilter = {}): Result {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const limit = filter.limit ?? 100;

  const query = useQuery<WorkItem[]>({
    queryKey: ['work-item-list', kind, tenantId, filter.userId ?? null, filter.status ?? null, limit],
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME.LIST,
    queryFn: async () => {
      switch (kind) {
        case 'task': {
          let q = supabase
            .from('tasks')
            .select(TASK_SELECT)
            .eq('tenant_id', tenantId!)
            .order('updated_at', { ascending: false, nullsFirst: false })
            .limit(limit);
          if (filter.userId) {
            q = q.or(`user_id.eq.${filter.userId},assigned_to.ilike.%${filter.userId}%`);
          }
          const { data, error } = await q;
          if (error) throw error;
          return (data ?? []).map((r) => taskToWorkItem(r as Parameters<typeof taskToWorkItem>[0]));
        }
        case 'decision': {
          let q = supabase
            .from('decisions')
            .select(DECISION_SELECT)
            .eq('tenant_id', tenantId!)
            .order('updated_at', { ascending: false, nullsFirst: false })
            .limit(limit);
          if (filter.userId) q = q.eq('created_by', filter.userId);
          const { data, error } = await q;
          if (error) throw error;
          return (data ?? []).map((r) => decisionToWorkItem(r as Parameters<typeof decisionToWorkItem>[0]));
        }
        case 'case_item':
        case 'vorgang': {
          let q = supabase
            .from('case_items')
            .select(CASE_SELECT)
            .eq('tenant_id', tenantId!)
            .order('updated_at', { ascending: false, nullsFirst: false })
            .limit(limit);
          if (filter.userId) q = q.or(`owner_user_id.eq.${filter.userId},user_id.eq.${filter.userId}`);
          const { data, error } = await q;
          if (error) throw error;
          return (data ?? []).map((r) => {
            const item = caseItemToWorkItem(r as Parameters<typeof caseItemToWorkItem>[0]);
            return kind === 'vorgang' ? { ...item, kind: 'vorgang' as const, uid: `vorgang:${item.id}` } : item;
          });
        }
      }
    },
  });

  const items = useMemo(() => {
    const raw = query.data ?? [];
    if (!filter.status || filter.status.length === 0) return raw;
    const allowed = new Set(filter.status);
    return raw.filter((it) => allowed.has(it.status));
  }, [query.data, filter.status]);

  return {
    items,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: () => void query.refetch(),
  };
}
