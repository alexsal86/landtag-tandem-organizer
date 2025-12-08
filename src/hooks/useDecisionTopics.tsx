import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useDecisionTopics = (decisionId: string | undefined) => {
  const [assignedTopics, setAssignedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchAssignedTopics = useCallback(async () => {
    if (!decisionId) {
      setAssignedTopics([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_decision_topics')
        .select('topic_id')
        .eq('decision_id', decisionId);

      if (error) throw error;

      setAssignedTopics(data?.map(item => item.topic_id) || []);
    } catch (error) {
      console.error('Error fetching decision topics:', error);
    } finally {
      setLoading(false);
    }
  }, [decisionId]);

  useEffect(() => {
    fetchAssignedTopics();
  }, [fetchAssignedTopics]);

  const assignTopic = async (topicId: string): Promise<boolean> => {
    if (!decisionId) return false;

    try {
      const { error } = await supabase
        .from('task_decision_topics')
        .insert({
          decision_id: decisionId,
          topic_id: topicId
        });

      if (error) throw error;

      setAssignedTopics(prev => [...prev, topicId]);
      return true;
    } catch (error) {
      console.error('Error assigning topic:', error);
      toast({
        title: "Fehler",
        description: "Thema konnte nicht zugewiesen werden.",
        variant: "destructive",
      });
      return false;
    }
  };

  const removeTopic = async (topicId: string): Promise<boolean> => {
    if (!decisionId) return false;

    try {
      const { error } = await supabase
        .from('task_decision_topics')
        .delete()
        .eq('decision_id', decisionId)
        .eq('topic_id', topicId);

      if (error) throw error;

      setAssignedTopics(prev => prev.filter(id => id !== topicId));
      return true;
    } catch (error) {
      console.error('Error removing topic:', error);
      toast({
        title: "Fehler",
        description: "Thema konnte nicht entfernt werden.",
        variant: "destructive",
      });
      return false;
    }
  };

  const setTopics = async (topicIds: string[]): Promise<boolean> => {
    if (!decisionId) return false;

    try {
      // Delete all existing topics
      const { error: deleteError } = await supabase
        .from('task_decision_topics')
        .delete()
        .eq('decision_id', decisionId);

      if (deleteError) throw deleteError;

      // Insert new topics
      if (topicIds.length > 0) {
        const { error: insertError } = await supabase
          .from('task_decision_topics')
          .insert(topicIds.map(topicId => ({
            decision_id: decisionId,
            topic_id: topicId
          })));

        if (insertError) throw insertError;
      }

      setAssignedTopics(topicIds);
      return true;
    } catch (error) {
      console.error('Error setting topics:', error);
      toast({
        title: "Fehler",
        description: "Themen konnten nicht aktualisiert werden.",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    assignedTopics,
    loading,
    assignTopic,
    removeTopic,
    setTopics,
    refreshTopics: fetchAssignedTopics
  };
};

// Utility function to save topics for a new decision
export const saveDecisionTopics = async (decisionId: string, topicIds: string[]): Promise<boolean> => {
  if (!decisionId || topicIds.length === 0) return true;

  try {
    const { error } = await supabase
      .from('task_decision_topics')
      .insert(topicIds.map(topicId => ({
        decision_id: decisionId,
        topic_id: topicId
      })));

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving decision topics:', error);
    return false;
  }
};
