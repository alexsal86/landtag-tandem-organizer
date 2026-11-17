import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
export function useHistoryFactions() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['election-history', user?.id, 'factions'], enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('election_history_factions').select('id,name,full_name,aliases,is_active,result_code').order('name').limit(1000).abortSignal(signal);
      if (error) throw error;
      return data || [];
    }, staleTime: 60_000, retry: false });
}
