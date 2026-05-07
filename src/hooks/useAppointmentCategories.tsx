import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { STALE_TIME } from '@/lib/query-cache';

export interface AppointmentCategory {
  id: string;
  name: string;
  label: string;
  color: string;
  icon?: string;
  is_active: boolean;
  order_index: number;
}

export const useAppointmentCategories = () => {
  return useQuery({
    queryKey: ['appointment-categories'],
    staleTime: STALE_TIME.LOOKUP,
    gcTime: STALE_TIME.LOOKUP * 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment_categories')
        .select('id, name, label, color, icon, is_active, order_index')
        .eq('is_active', true)
        .order('order_index');

      if (error) throw error;
      return data as AppointmentCategory[];
    }
  });
};
