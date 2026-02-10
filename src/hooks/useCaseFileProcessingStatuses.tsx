import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CaseFileProcessingStatus {
  id: string;
  name: string;
  label: string;
  icon: string | null;
  color: string | null;
  order_index: number;
  is_active: boolean;
}

export const useCaseFileProcessingStatuses = () => {
  const [statuses, setStatuses] = useState<CaseFileProcessingStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('case_file_processing_statuses' as any)
          .select('*')
          .eq('is_active', true)
          .order('order_index');

        if (error) throw error;
        setStatuses((data || []) as unknown as CaseFileProcessingStatus[]);
      } catch (error) {
        console.error('Error loading processing statuses:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { statuses, loading };
};
