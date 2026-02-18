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
      // Use individual count queries per decision for efficiency
      const countPromises = decisionIds.map(async (decisionId) => {
        const { count, error } = await supabase
          .from('task_decision_comments')
          .select('id', { count: 'exact', head: true })
          .eq('decision_id', decisionId);
        return { decisionId, count: count || 0, error };
      });
      const results = await Promise.all(countPromises);
      const error = results.find(r => r.error)?.error;

      if (error) throw error;

      // Build counts map from results
      const counts = new Map<string, number>();
      results.forEach(r => {
        counts.set(r.decisionId, r.count);
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
