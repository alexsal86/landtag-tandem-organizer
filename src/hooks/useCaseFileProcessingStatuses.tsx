import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from '@/utils/debugConsole';
import { handleAppError } from '@/utils/errorHandler';

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
          .from('case_file_processing_statuses')
          .select('id, name, label, icon, color, order_index, is_active')
          .eq('is_active', true)
          .order('order_index');

        if (error) throw error;
        setStatuses((data || []).map((d: Record<string, any>) => ({
          id: d.id,
          name: d.name,
          label: d.label,
          icon: d.icon,
          color: d.color,
          order_index: d.order_index ?? 0,
          is_active: d.is_active ?? true,
        })));
      } catch (error) {
        handleAppError(error, { context: 'useCaseFileProcessingStatuses.load' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { statuses, loading };
};
