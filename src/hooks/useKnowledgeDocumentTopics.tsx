import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useKnowledgeDocumentTopics = (documentId: string | undefined) => {
  const [assignedTopics, setAssignedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssignedTopics = useCallback(async () => {
    if (!documentId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('knowledge_document_topics')
        .select('topic_id')
        .eq('document_id', documentId);

      if (error) throw error;
      setAssignedTopics(data?.map(t => t.topic_id) || []);
    } catch (error) {
      console.error('Error fetching knowledge document topics:', error);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchAssignedTopics();
  }, [fetchAssignedTopics]);

  const assignTopic = async (topicId: string) => {
    if (!documentId) return false;

    try {
      const { error } = await supabase
        .from('knowledge_document_topics')
        .insert({ document_id: documentId, topic_id: topicId });

      if (error) throw error;
      setAssignedTopics(prev => [...prev, topicId]);
      return true;
    } catch (error) {
      console.error('Error assigning topic:', error);
      return false;
    }
  };

  const removeTopic = async (topicId: string) => {
    if (!documentId) return false;

    try {
      const { error } = await supabase
        .from('knowledge_document_topics')
        .delete()
        .eq('document_id', documentId)
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
    if (!documentId) return false;

    try {
      // Remove all existing
      await supabase
        .from('knowledge_document_topics')
        .delete()
        .eq('document_id', documentId);

      // Add new ones
      if (topicIds.length > 0) {
        const { error } = await supabase
          .from('knowledge_document_topics')
          .insert(topicIds.map(topic_id => ({ document_id: documentId, topic_id })));

        if (error) throw error;
      }

      setAssignedTopics(topicIds);
      return true;
    } catch (error) {
      console.error('Error setting topics:', error);
      return false;
    }
  };

  // Function to save topics during document creation
  const saveDocumentTopics = async (newDocumentId: string, topicIds: string[]) => {
    if (!newDocumentId || topicIds.length === 0) return true;

    try {
      const { error } = await supabase
        .from('knowledge_document_topics')
        .insert(topicIds.map(topic_id => ({ document_id: newDocumentId, topic_id })));

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving document topics:', error);
      return false;
    }
  };

  return {
    assignedTopics,
    loading,
    assignTopic,
    removeTopic,
    setTopics,
    saveDocumentTopics,
    refreshTopics: fetchAssignedTopics,
  };
};
