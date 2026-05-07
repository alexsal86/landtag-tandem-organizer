import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";

export type LinkedDecision = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  response_deadline: string | null;
  created_by: string | null;
  task_decision_participants: Array<{
    id: string;
    user_id: string;
    task_decision_responses: Array<{ id: string; response_type: string }>;
  }>;
};

interface UseLinkedDecisionsParams {
  detailItemId: string | null;
  runAsync: (action: () => Promise<unknown>) => void;
}

export function useLinkedDecisions({ detailItemId, runAsync }: UseLinkedDecisionsParams) {
  const [linkedDecisions, setLinkedDecisions] = useState<Record<string, LinkedDecision[]>>({});
  const [loadingDecisions, setLoadingDecisions] = useState(false);

  const loadLinkedDecisions = useCallback(async (itemId: string) => {
    setLoadingDecisions(true);
    try {
      const { data, error } = await supabase
        .from("task_decisions")
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          response_deadline,
          created_by,
          task_decision_participants (
            id,
            user_id,
            task_decision_responses (id, response_type)
          )
        `)
        .eq("case_item_id", itemId)
        .order("created_at", { ascending: false });

      if (!error) {
        setLinkedDecisions((prev) => ({
          ...prev,
          [itemId]: ((data ?? []) as unknown as LinkedDecision[]),
        }));
      }
    } catch (e) {
      debugConsole.error("Error loading linked decisions:", e);
    } finally {
      setLoadingDecisions(false);
    }
  }, []);

  useEffect(() => {
    if (detailItemId) {
      runAsync(() => loadLinkedDecisions(detailItemId));
    }
  }, [detailItemId, loadLinkedDecisions, runAsync]);

  return { linkedDecisions, loadingDecisions, loadLinkedDecisions, setLinkedDecisions };
}
