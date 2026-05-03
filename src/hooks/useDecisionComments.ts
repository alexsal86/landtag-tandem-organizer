import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from '@/utils/debugConsole';

interface CommentCount {
  decisionId: string;
  count: number;
}

export function useDecisionComments(decisionIds: string[]) {
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const loadCommentCounts = useCallback(async () => {
    if (decisionIds.length === 0) return;

    setIsLoading(true);
    try {
      // Single batched query instead of N+1 individual queries
      const { data, error } = await supabase
        .from('task_decision_comments')
        .select('decision_id', { count: 'exact', head: false })
        .in('decision_id', decisionIds);

      if (error) throw error;

      // Build counts map by grouping results client-side
      const counts = new Map<string, number>();
      (data as Array<{ decision_id: string | null }> | null ?? []).forEach((row) => {
        const id = row.decision_id;
        if (id) counts.set(id, (counts.get(id) || 0) + 1);
      });

      setCommentCounts(counts);
    } catch (error) {
      debugConsole.error('Error loading comment counts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [decisionIds.join(',')]);

  useEffect(() => {
    loadCommentCounts();
  }, [loadCommentCounts]);

  const getCommentCount = (decisionId: string): number => {
    return commentCounts.get(decisionId) || 0;
  };

  return {
    commentCounts,
    getCommentCount,
    isLoading,
    refresh: loadCommentCounts,
  };
}
