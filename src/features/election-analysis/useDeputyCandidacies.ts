import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { DeputyCandidacy } from './deputyParticipation';

/** Only confirmed person IDs from the selected deputy's published mandates; no name matching. */
export function useDeputyCandidacies(connectionId: string | undefined, confirmedPersonIds: readonly string[], enabled: boolean) {
  const { user } = useAuth();
  const personIds = [...new Set(confirmedPersonIds)].sort();
  return useQuery({
    queryKey: ['election-history', user?.id, 'analysis-deputy-candidacies', connectionId, personIds],
    enabled: !!user && enabled && !!connectionId && personIds.length === 1,
    queryFn: async ({ signal }): Promise<DeputyCandidacy[]> => {
      const { data, error } = await supabase.from('election_history_candidacies')
        .select('id,person_id,period_id,party,outcome,ballot_type,votes,vote_share,list_position,source_url,notes,result_preliminary,result_notes,period:election_history_periods!inner(number,election_year,is_published),district:election_history_districts(name,number_label,district_number)')
        .eq('person_id', personIds[0]).eq('period.is_published', true).order('id').limit(201).abortSignal(signal);
      if (error) throw error;
      if ((data?.length || 0) > 200) throw new Error('Die Wahlteilnahmen konnten nicht vollständig geladen werden.');
      return (data || []).map((row): DeputyCandidacy => {
        const outcome = row.outcome;
        const ballot_type = row.ballot_type;
        if (!row.period) throw new Error('Ungültige Kandidaturdaten.');
        if (outcome !== 'direct' && outcome !== 'list' && outcome !== 'not_elected' && outcome !== 'unknown') throw new Error('Unbekannter Wahlausgang.');
        if (ballot_type !== 'candidate' && ballot_type !== 'first_vote') throw new Error('Unbekannte Stimmenart.');
        return { id: row.id, person_id: row.person_id, period_id: row.period_id, party: row.party, outcome, ballot_type,
          votes: row.votes, vote_share: row.vote_share, list_position: row.list_position, source_url: row.source_url, notes: row.notes,
          result_preliminary: row.result_preliminary, result_notes: row.result_notes,
          period_number: row.period.number, election_year: row.period.election_year,
          district_name: row.district?.name ?? null,
          district_label: row.district?.number_label ?? (row.district?.district_number == null ? null : String(row.district.district_number)),
        };
      });
    }, staleTime: 30_000, retry: false,
  });
}
