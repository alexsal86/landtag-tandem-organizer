import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DocumentCategory {
  id: string;
  name: string;
  label: string;
  color: string;
  icon?: string;
  is_active: boolean;
  order_index: number;
}

export const useDocumentCategories = () => {
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('document_categories')
        .select('id, name, label, color, icon, is_active, order_index')
        .eq('is_active', true)
        .order('order_index');

      if (error) {
        console.error('Error fetching document categories:', error);
        return;
      }

      setCategories(data || []);
    } catch (error) {
      console.error('Error in fetchCategories:', error);
    } finally {
      setLoading(false);
    }
  };

  // Categories change rarely - no realtime needed, use refreshCategories() when needed

  return { 
    categories, 
    loading, 
    refreshCategories: fetchCategories 
  };
}
