/**
 * MyWork case_items (Vorgänge) data — minimal cached query that powers the
 * unified WorkItem projection. Mirrors the column set used by the existing
 * MyWorkCaseItemsTab but without selection/escalation overhead.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { STALE_TIME } from '@/lib/query-cache';

export interface MyWorkCaseItemRow {
  id: string;
  subject: string;
  summary: string | null;
  status: string | null;
  priority: string | null;
  due_at: string | null;
  follow_up_at: string | null;
  user_id: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string | null;
  tenant_id: string | null;
}

const CASE_ITEM_SELECT =
  'id, subject, summary, status, priority, due_at, follow_up_at, user_id, owner_user_id, created_at, updated_at, tenant_id';

export function useMyWorkCaseItems(userId?: string) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<MyWorkCaseItemRow[]>({
    queryKey: ['my-work-case-items', tenantId, userId],
    enabled: Boolean(tenantId && userId),
      staleTime: STALE_TIME.LIST,
    queryFn: async () => {
      const userFilter = `owner_user_id.eq.${userId},user_id.eq.${userId}`;
      const { data, error } = await supabase
        .from('case_items')
        .select(CASE_ITEM_SELECT)
        .eq('tenant_id', tenantId!)
        .or(userFilter)
        .neq('status', 'archiviert')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as MyWorkCaseItemRow[];
    },
  });
}
