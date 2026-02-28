import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface Topic {
  id: string;
  name: string;
  label: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useTopics = () => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTopics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .order('order_index');

      if (error) {
        console.error('Error fetching topics:', error);
        return;
      }

      setTopics(data || []);
    } catch (error) {
      console.error('Error in fetchTopics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const createTopic = async (topicData: Partial<Topic>) => {
    if (!topicData.name || !topicData.label) {
      toast({
        title: "Fehler",
        description: "Name und Label sind Pflichtfelder.",
        variant: "destructive"
      });
      return null;
    }

    try {
      const maxOrderIndex = topics.length > 0 
        ? Math.max(...topics.map(t => t.order_index)) + 1 
        : 0;

      const { data, error } = await supabase
        .from('topics')
        .insert({
          name: topicData.name,
          label: topicData.label,
          icon: topicData.icon || 'Tag',
          color: topicData.color || '#3b82f6',
          description: topicData.description,
          order_index: maxOrderIndex,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setTopics(prev => [...prev, data]);
      toast({ title: "Thema erstellt", description: `"${topicData.label}" wurde hinzugefügt.` });
      return data;
    } catch (error: any) {
      console.error('Error creating topic:', error);
      toast({ 
        title: "Fehler", 
        description: error.message || "Thema konnte nicht erstellt werden.", 
        variant: "destructive" 
      });
      return null;
    }
  };

  const updateTopic = async (id: string, updates: Partial<Topic>) => {
    try {
      const { data, error } = await supabase
        .from('topics')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTopics(prev => prev.map(t => t.id === id ? data : t));
      toast({ title: "Thema aktualisiert" });
      return data;
    } catch (error: any) {
      console.error('Error updating topic:', error);
      toast({ 
        title: "Fehler", 
        description: error.message || "Thema konnte nicht aktualisiert werden.", 
        variant: "destructive" 
      });
      return null;
    }
  };

  const deleteTopic = async (id: string) => {
    try {
      const { error } = await supabase
        .from('topics')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTopics(prev => prev.filter(t => t.id !== id));
      toast({ title: "Thema gelöscht" });
      return true;
    } catch (error: any) {
      console.error('Error deleting topic:', error);
      toast({ 
        title: "Fehler", 
        description: error.message || "Thema konnte nicht gelöscht werden.", 
        variant: "destructive" 
      });
      return false;
    }
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    return updateTopic(id, { is_active });
  };

  const updateOrder = async (orderedTopics: { id: string; order_index: number }[]) => {
    try {
      for (const topic of orderedTopics) {
        await supabase
          .from('topics')
          .update({ order_index: topic.order_index })
          .eq('id', topic.id);
      }
      await fetchTopics();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const getActiveTopics = () => topics.filter(t => t.is_active);

  return {
    topics,
    loading,
    fetchTopics,
    createTopic,
    updateTopic,
    deleteTopic,
    toggleActive,
    updateOrder,
    getActiveTopics,
  };
};

// Hook for managing topics on a specific entity
export const useCaseFileTopics = (caseFileId: string | undefined) => {
  const [assignedTopics, setAssignedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssignedTopics = useCallback(async () => {
    if (!caseFileId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('case_file_topics')
        .select('topic_id')
        .eq('case_file_id', caseFileId);

      if (error) throw error;
      setAssignedTopics(data?.map(t => t.topic_id) || []);
    } catch (error) {
      console.error('Error fetching case file topics:', error);
    } finally {
      setLoading(false);
    }
  }, [caseFileId]);

  useEffect(() => {
    fetchAssignedTopics();
  }, [fetchAssignedTopics]);

  const assignTopic = async (topicId: string) => {
    if (!caseFileId) return false;

    try {
      const { error } = await supabase
        .from('case_file_topics')
        .insert({ case_file_id: caseFileId, topic_id: topicId });

      if (error) throw error;
      setAssignedTopics(prev => [...prev, topicId]);
      return true;
    } catch (error) {
      console.error('Error assigning topic:', error);
      return false;
    }
  };

  const removeTopic = async (topicId: string) => {
    if (!caseFileId) return false;

    try {
      const { error } = await supabase
        .from('case_file_topics')
        .delete()
        .eq('case_file_id', caseFileId)
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
    if (!caseFileId) return false;

    try {
      // Remove all existing
      await supabase
        .from('case_file_topics')
        .delete()
        .eq('case_file_id', caseFileId);

      // Add new ones
      if (topicIds.length > 0) {
        const { error } = await supabase
          .from('case_file_topics')
          .insert(topicIds.map(topic_id => ({ case_file_id: caseFileId, topic_id })));

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
