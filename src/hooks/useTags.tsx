import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";

interface Tag {
  id: string;
  name: string;
  label: string;
  color: string;
  icon?: string;
  is_active: boolean;
  order_index: number;
}

export const useTags = () => {
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
        .select('id, name, label, color, icon, is_active, order_index')
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

  // Tags change rarely - no realtime needed, use refreshTags() when needed

  return { 
    tags, 
    loading, 
    tagSuggestions: tags.map(tag => tag.label),
    refreshTags: fetchTags 
  };
}