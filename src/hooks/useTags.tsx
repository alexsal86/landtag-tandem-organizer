import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Tag {
  id: string;
  name: string;
  label: string;
  color: string;
  is_active: boolean;
  order_index: number;
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

      if (error) {
        console.error('Error fetching tags:', error);
        return;
      }

      setTags(data || []);
    } catch (error) {
      console.error('Error in fetchTags:', error);
    } finally {
      setLoading(false);
    }
  };

  // Listen for changes to tags
  useEffect(() => {
    const channel = supabase
      .channel('tags-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tags',
        },
        () => {
          fetchTags();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { 
    tags, 
    loading, 
    tagSuggestions: tags.map(tag => tag.label),
    refreshTags: fetchTags 
  };
}