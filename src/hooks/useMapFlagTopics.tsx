import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useMapFlagTopics = (flagId?: string) => {
  const queryClient = useQueryClient();

  const { data: topicIds, isLoading } = useQuery({
    queryKey: ['map-flag-topics', flagId],
    queryFn: async () => {
      if (!flagId) return [];
      
      const { data, error } = await supabase
        .from('map_flag_topics')
        .select('topic_id')
        .eq('flag_id', flagId);

      if (error) throw error;
      return data?.map(t => t.topic_id) || [];
    },
    enabled: !!flagId,
  });

  const saveTopics = useMutation({
    mutationFn: async ({ flagId, topicIds }: { flagId: string; topicIds: string[] }) => {
      // Delete existing
      await supabase
        .from('map_flag_topics')
        .delete()
        .eq('flag_id', flagId);

      // Insert new ones
      if (topicIds.length > 0) {
        const { error } = await supabase
          .from('map_flag_topics')
          .insert(topicIds.map(topic_id => ({ flag_id: flagId, topic_id })));

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['map-flag-topics', variables.flagId] });
      queryClient.invalidateQueries({ queryKey: ['map-flags'] });
    },
  });

  return {
    topicIds: topicIds || [],
    isLoading,
    saveTopics,
  };
};

// Hook to get topics for multiple flags at once
export const useMapFlagsTopics = (flagIds: string[]) => {
  const { data, isLoading } = useQuery({
    queryKey: ['map-flags-topics', flagIds],
    queryFn: async () => {
      if (flagIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('map_flag_topics')
        .select('flag_id, topic_id')
        .in('flag_id', flagIds);

      if (error) throw error;

      // Group by flag_id
      const grouped: Record<string, string[]> = {};
      data?.forEach(item => {
        if (!grouped[item.flag_id]) grouped[item.flag_id] = [];
        grouped[item.flag_id].push(item.topic_id);
      });
      return grouped;
    },
    enabled: flagIds.length > 0,
  });

  return { topicsByFlag: data || {}, isLoading };
};
