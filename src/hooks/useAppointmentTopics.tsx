import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from '@/utils/debugConsole';

export const useAppointmentTopics = (appointmentId: string | undefined) => {
  const [assignedTopics, setAssignedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssignedTopics = async () => {
    if (!appointmentId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointment_topics')
        .select('topic_id')
        .eq('appointment_id', appointmentId);

      if (error) throw error;
      setAssignedTopics(data?.map((t: Record<string, any>) => t.topic_id) || []);
    } catch (error) {
      debugConsole.error('Error fetching appointment topics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedTopics();
  }, [appointmentId]);

  const assignTopic = async (topicId: string) => {
    if (!appointmentId) return false;

    try {
      const { error } = await supabase
        .from('appointment_topics')
        .insert([{ appointment_id: appointmentId, topic_id: topicId }]);

      if (error) throw error;
      setAssignedTopics(prev => [...prev, topicId]);
      return true;
    } catch (error) {
      debugConsole.error('Error assigning topic:', error);
      return false;
    }
  };

  const removeTopic = async (topicId: string) => {
    if (!appointmentId) return false;

    try {
      const { error } = await supabase
        .from('appointment_topics')
        .delete()
        .eq('appointment_id', appointmentId)
        .eq('topic_id', topicId);

      if (error) throw error;
      setAssignedTopics(prev => prev.filter(id => id !== topicId));
      return true;
    } catch (error) {
      debugConsole.error('Error removing topic:', error);
      return false;
    }
  };

  const setTopics = async (topicIds: string[]) => {
    if (!appointmentId) return false;

    try {
      // Remove all existing
      await supabase
        .from('appointment_topics')
        .delete()
        .eq('appointment_id', appointmentId);

      // Add new ones
      if (topicIds.length > 0) {
        const { error } = await supabase
          .from('appointment_topics')
          .insert(topicIds.map(topic_id => ({ appointment_id: appointmentId, topic_id })));

        if (error) throw error;
      }

      setAssignedTopics(topicIds);
      return true;
    } catch (error) {
      debugConsole.error('Error setting topics:', error);
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

// Helper for saving topics on appointment creation (before ID is known)
export const saveAppointmentTopics = async (appointmentId: string, topicIds: string[]) => {
  if (!appointmentId || topicIds.length === 0) return true;

  try {
    const { error } = await supabase
      .from('appointment_topics')
      .insert(topicIds.map(topic_id => ({ appointment_id: appointmentId, topic_id })));

    if (error) throw error;
    return true;
  } catch (error) {
    debugConsole.error('Error saving appointment topics:', error);
    return false;
  }
};
