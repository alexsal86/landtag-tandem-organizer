import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export interface Funding {
  id: string;
  title: string;
  description?: string;
  total_amount?: number;
  allocated_amount?: number;
  start_date?: string;
  end_date?: string;
  status: string;
  funding_source?: string;
  category?: string;
  participant_role?: string;
  participant_count: number;
}

export const useContactFundings = (contactId?: string) => {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['contact-fundings', contactId, currentTenant?.id],
    queryFn: async () => {
      if (!contactId || !currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('funding_participants')
        .select(`
          allocated_amount,
          role,
          notes,
          funding_id,
          fundings!inner (
            id,
            title,
            description,
            total_amount,
            start_date,
            end_date,
            status,
            funding_source,
            category
          )
        `)
        .eq('contact_id', contactId);

      if (error) throw error;

      // Get participant counts
      const fundingIds = data?.map(d => d.funding_id) || [];
      if (fundingIds.length === 0) return [];

      const { data: counts } = await supabase
        .from('funding_participants')
        .select('funding_id')
        .in('funding_id', fundingIds);

      const participantCounts = counts?.reduce((acc, item) => {
        acc[item.funding_id] = (acc[item.funding_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return data?.map(item => ({
        id: item.fundings.id,
        title: item.fundings.title,
        description: item.fundings.description,
        total_amount: item.fundings.total_amount,
        allocated_amount: item.allocated_amount,
        start_date: item.fundings.start_date,
        end_date: item.fundings.end_date,
        status: item.fundings.status,
        funding_source: item.fundings.funding_source,
        category: item.fundings.category,
        participant_role: item.role,
        participant_count: participantCounts[item.funding_id] || 1,
      })) || [];
    },
    enabled: !!contactId && !!currentTenant?.id,
  });
};
