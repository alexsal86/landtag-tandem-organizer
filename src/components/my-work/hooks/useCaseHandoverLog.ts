import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HandoverLogEntry = {
  id: string;
  case_item_id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  handed_over_by: string;
  handed_over_at: string;
};

export const caseHandoverLogKey = (tenantId?: string, itemId?: string) => ["case-handover-log", tenantId, itemId ?? "all"];

/** Übergabe-Protokoll: für einen Vorgang oder (ohne itemId) die letzten Übergaben des Büros. */
export function useCaseHandoverLog(tenantId: string | undefined, itemId?: string, enabled = true) {
  return useQuery({
    queryKey: caseHandoverLogKey(tenantId, itemId),
    enabled: !!tenantId && enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<HandoverLogEntry[]> => {
      let q = supabase
        .from("case_item_handover_log")
        .select("id, case_item_id, from_user_id, to_user_id, handed_over_by, handed_over_at")
        .eq("tenant_id", tenantId!)
        .order("handed_over_at", { ascending: false })
        .limit(itemId ? 10 : 30);
      if (itemId) q = q.eq("case_item_id", itemId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}
