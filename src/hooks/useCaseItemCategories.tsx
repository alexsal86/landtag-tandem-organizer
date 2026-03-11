import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export interface CaseItemCategory {
  id: string;
  name: string;
  label: string;
  is_active: boolean;
  order_index: number;
}

export const DEFAULT_CASE_ITEM_CATEGORIES = [
  'Allgemein',
  'Bürgeranliegen',
  'Anfrage',
  'Beschwerde',
  'Termin',
  'Sonstiges',
] as const;

export const useCaseItemCategories = () => {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['case-item-categories', currentTenant?.id],
    enabled: Boolean(currentTenant?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('case_item_categories')
        .select('id, name, label, is_active, order_index')
        .eq('tenant_id', currentTenant!.id)
        .eq('is_active', true)
        .order('order_index');

      if (error) throw error;
      return (data ?? []) as CaseItemCategory[];
    },
  });
};
