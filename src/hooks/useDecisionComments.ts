import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      // Get comment counts for all decisions
      const { data, error } = await supabase
        .from('task_decision_comments')
        .select('decision_id')
        .in('decision_id', decisionIds);

      if (error) throw error;

      // Count comments per decision
      const counts = new Map<string, number>();
      data?.forEach(c => {
        counts.set(c.decision_id, (counts.get(c.decision_id) || 0) + 1);
      });

      setCommentCounts(counts);
    } catch (error) {
      console.error('Error loading comment counts:', error);
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
