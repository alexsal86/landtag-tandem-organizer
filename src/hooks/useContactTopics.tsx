import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useContactTopics = (contactId: string | undefined) => {
  const [assignedTopics, setAssignedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssignedTopics = async () => {
    if (!contactId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contact_topics')
        .select('topic_id')
        .eq('contact_id', contactId);

      if (error) throw error;
      setAssignedTopics(data?.map(t => t.topic_id) || []);
    } catch (error) {
      console.error('Error fetching contact topics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedTopics();
  }, [contactId]);

  const assignTopic = async (topicId: string) => {
    if (!contactId) return false;

    try {
      const { error } = await supabase
        .from('contact_topics')
        .insert({ contact_id: contactId, topic_id: topicId });

      if (error) throw error;
      setAssignedTopics(prev => [...prev, topicId]);
      return true;
    } catch (error) {
      console.error('Error assigning topic:', error);
      return false;
    }
  };

  const removeTopic = async (topicId: string) => {
    if (!contactId) return false;

    try {
      const { error } = await supabase
        .from('contact_topics')
        .delete()
        .eq('contact_id', contactId)
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
    if (!contactId) return false;

    try {
      // Remove all existing
      await supabase
        .from('contact_topics')
        .delete()
        .eq('contact_id', contactId);

      // Add new ones
      if (topicIds.length > 0) {
        const { error } = await supabase
          .from('contact_topics')
          .insert(topicIds.map(topic_id => ({ contact_id: contactId, topic_id })));

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
