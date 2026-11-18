import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { CandidacyStateListPlace } from './candidacyListPlaces';

/** Only selected-period candidates already visible in the grid; no person-register download or name matching. */
export function useCandidacyStateListPlaces(periodId: string, visiblePersonIds: readonly string[], enabled: boolean) {
  const { user } = useAuth();
  const personIds = [...new Set(visiblePersonIds)].sort();
  return useQuery({
    queryKey: ['election-history', user?.id, 'candidacy-state-list-places', periodId, personIds],
    enabled: !!user && enabled && !!periodId && personIds.length > 0,
    queryFn: async ({ signal }): Promise<CandidacyStateListPlace[]> => {
      const batches: string[][] = [];
      for (let offset = 0; offset < personIds.length; offset += 100) batches.push(personIds.slice(offset, offset + 100));
      const pages = await Promise.all(batches.map(async ids => {
        const mapping = await supabase.from('election_history_connection_people').select('connection_id,person_id')
          .in('person_id', ids).limit(100).abortSignal(signal);
        if (mapping.error) throw mapping.error;
        if (!mapping.data?.length) return [];
        const personByConnection = new Map(mapping.data.map(row => [row.connection_id, row.person_id]));
        const { data, error } = await supabase.from('election_history_state_list_entries')
          .select('id,list_id,position,connection_id,list:election_history_state_lists!inner(period_id,party,source_url)')
          .eq('list.period_id', periodId).in('connection_id', [...personByConnection.keys()]).limit(1000).abortSignal(signal);
        if (error) throw error;
        if ((data?.length || 0) >= 1000) throw new Error('Zu viele Listenplätze für diese Auswahl. Bitte die Kandidaturen filtern.');
        return (data || []).flatMap(row => {
          const personId = row.connection_id ? personByConnection.get(row.connection_id) : undefined;
          return personId && row.list ? [{ id: row.id, list_id: row.list_id, position: row.position, person_id: personId,
            period_id: row.list.period_id, party: row.list.party, source_url: row.list.source_url }] : [];
        });
      }));
      return pages.flat();
    }, staleTime: 60_000, retry: false,
  });
}
