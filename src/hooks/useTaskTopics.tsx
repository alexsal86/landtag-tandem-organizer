import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useTaskTopics = (taskId: string | undefined) => {
  const [assignedTopics, setAssignedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssignedTopics = async () => {
    if (!taskId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('task_topics')
        .select('topic_id')
        .eq('task_id', taskId);

      if (error) throw error;
      setAssignedTopics(data?.map(t => t.topic_id) || []);
    } catch (error) {
      console.error('Error fetching task topics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedTopics();
  }, [taskId]);

  const assignTopic = async (topicId: string) => {
    if (!taskId) return false;

    try {
      const { error } = await supabase
        .from('task_topics')
        .insert({ task_id: taskId, topic_id: topicId });

      if (error) throw error;
      setAssignedTopics(prev => [...prev, topicId]);
      return true;
    } catch (error) {
      console.error('Error assigning topic:', error);
      return false;
    }
  };

  const removeTopic = async (topicId: string) => {
    if (!taskId) return false;

    try {
      const { error } = await supabase
        .from('task_topics')
        .delete()
        .eq('task_id', taskId)
        .eq('topic_id', topicId);

      if (error) throw error;
      setAssignedTopics(prev => prev.filter(id => id !== topicId));
      return true;
    } catch (error) {
      console.error('Error removing topic:', error);
      return false;
    }
  };

  const setTopics = async (topicIds: string[]) => {
    if (!taskId) return false;

    try {
      // Remove all existing
      await supabase
        .from('task_topics')
        .delete()
        .eq('task_id', taskId);

      // Add new ones
      if (topicIds.length > 0) {
        const { error } = await supabase
          .from('task_topics')
          .insert(topicIds.map(topic_id => ({ task_id: taskId, topic_id })));

        if (error) throw error;
      }

      setAssignedTopics(topicIds);
      return true;
    } catch (error) {
      console.error('Error setting topics:', error);
      return false;
    }
  };

  return {
    assignedTopics,
    loading,
    assignTopic,
    removeTopic,
    setTopics,
    refreshTopics: fetchAssignedTopics,
  };
};

// Hook for creating tasks with topics
export const useCreateTaskWithTopics = () => {
  const saveTaskTopics = async (taskId: string, topicIds: string[]) => {
    if (topicIds.length === 0) return true;

    try {
      const { error } = await supabase
        .from('task_topics')
        .insert(topicIds.map(topic_id => ({ task_id: taskId, topic_id })));

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving task topics:', error);
      return false;
    }
  };

  return { saveTaskTopics };
};
