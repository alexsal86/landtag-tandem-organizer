import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';
import { useToast } from '@/hooks/use-toast';
import { Contact } from '@/hooks/useInfiniteContacts';

export function useStakeholderTopics(stakeholders: Contact[], onRefresh?: () => void) {
  const { toast } = useToast();
  const [stakeholderTopics, setStakeholderTopics] = useState<Record<string, string[]>>({});
  const [editingTopics, setEditingTopics] = useState<string | null>(null);
  const [localTopicUpdates, setLocalTopicUpdates] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const loadStakeholderTopics = async () => {
      const ids = stakeholders.map(s => s.id);
      if (ids.length === 0) return;
      
      const { data, error } = await supabase
        .from('contact_topics')
        .select('contact_id, topic_id')
        .in('contact_id', ids);
      
      if (error) { debugConsole.error('Error loading stakeholder topics:', error); return; }
      
      const topicsMap: Record<string, string[]> = {};
      data?.forEach(i(tem: Record<string, any>) => {
        if (!topicsMap[item.contact_id]) topicsMap[item.contact_id] = [];
        topicsMap[item.contact_id].push(item.topic_id);
      });
      setStakeholderTopics(topicsMap);
    };
    loadStakeholderTopics();
  }, [stakeholders]);

  const handleTopicsLocalChange = (stakeholderId: string, newTopicIds: string[]) => {
    setLocalTopicUpdates(prev => ({ ...prev, [stakeholderId]: newTopicIds }));
  };

  const handleSaveTopics = async (stakeholderId: string) => {
    const pendingTopics = localTopicUpdates[stakeholderId];
    if (!pendingTopics) { setEditingTopics(null); return; }

    try {
      await supabase.from('contact_topics').delete().eq('contact_id', stakeholderId);
      if (pendingTopics.length > 0) {
        const { error } = await supabase
          .from('contact_topics')
          .insert(pendingTopics.map(topic_id => ({ contact_id: stakeholderId, topic_id })));
        if (error) throw error;
      }
      setStakeholderTopics(prev => ({ ...prev, [stakeholderId]: pendingTopics }));
      setLocalTopicUpdates(prev => { const s = { ...prev }; delete s[stakeholderId]; return s; });
      onRefresh?.();
      toast({ title: "Erfolg", description: "Themen wurden erfolgreich gespeichert." });
      setEditingTopics(null);
    } catch (error) {
      debugConsole.error('Error saving topics:', error);
      setLocalTopicUpdates(prev => { const s = { ...prev }; delete s[stakeholderId]; return s; });
      toast({ title: "Fehler", description: "Themen konnten nicht gespeichert werden.", variant: "destructive" });
    }
  };

  const handleCancelTopics = (stakeholderId: string) => {
    setLocalTopicUpdates(prev => { const s = { ...prev }; delete s[stakeholderId]; return s; });
    setEditingTopics(null);
  };

  const getTopicIds = (stakeholderId: string) =>
    localTopicUpdates[stakeholderId] || stakeholderTopics[stakeholderId] || [];

  return {
    stakeholderTopics,
    localTopicUpdates,
    editingTopics,
    setEditingTopics,
    handleTopicsLocalChange,
    handleSaveTopics,
    handleCancelTopics,
    getTopicIds,
  };
}
