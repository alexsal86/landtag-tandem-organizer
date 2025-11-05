import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment_categories')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

      if (error) throw error;
      return data as AppointmentCategory[];
    }
  });
};
