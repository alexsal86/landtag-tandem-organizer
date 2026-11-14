import { parties as focusParties } from './model';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { AnalysisRows, AnalysisSection, AnalysisYear, Ballot } from './types';

const tables = { state: 'election_analysis_state', districts: 'election_analysis_districts', turnout: 'election_analysis_turnout', flows: 'election_analysis_flows', demographics: 'election_analysis_demographics' } as const;
export function useAnalysisYears(): UseQueryResult<AnalysisYear[], Error> {
  const { user } = useAuth();
  return useQuery({ queryKey: ['election-analysis', user?.id, 'years'], enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('election_analysis_years').select('*').eq('is_published', true).order('year', { ascending: false }).limit(50).abortSignal(signal);
      if (error) throw error;
      return data || [];
    }, staleTime: 300_000, gcTime: 300_000, retry: false });
}
export function useAnalysisRows<K extends AnalysisSection>(section: K, year: number, ballot: Ballot, party: string, gender: string, enabled = true): UseQueryResult<AnalysisRows[K][], Error> {
  const { user } = useAuth();
  const filter = section === 'flows' || section === 'districts' ? party : section === 'demographics' ? gender : '';
  return useQuery({ queryKey: ['election-analysis', user?.id, section, year, section === 'flows' ? '' : ballot, filter], enabled: !!user && !!year && enabled,
    queryFn: async ({ signal }) => {
      // The filters are applied by PostgREST before the bounded result is sent.
      const table = tables[section];
      const result = await (() => {
        switch (table) {
          case 'election_analysis_state': return supabase.from('election_analysis_state').select('*').eq('year', year).eq('ballot', ballot).in('party',focusParties).order('party').limit(100).abortSignal(signal);
          case 'election_analysis_districts': return supabase.from('election_analysis_districts').select('*').eq('year', year).eq('ballot', ballot).eq('party', party).order('district_number').limit(200).abortSignal(signal);
          case 'election_analysis_turnout': return supabase.from('election_analysis_turnout').select('*').eq('year', year).eq('ballot', ballot).order('district_number').limit(200).abortSignal(signal);
          case 'election_analysis_flows': return supabase.from('election_analysis_flows').select('*').eq('year', year).eq('target_party', party).order('partner').limit(100).abortSignal(signal);
          case 'election_analysis_demographics': return supabase.from('election_analysis_demographics').select('*').eq('year', year).eq('ballot', ballot).eq('gender', gender).order('age_group').order('party').limit(200).abortSignal(signal);
        }
      })();
      if (result.error) throw result.error;
      // This boundary pairs the selected relation with its corresponding row type.
      return (result.data || []) as unknown as AnalysisRows[K][];
    }, staleTime: 60_000, gcTime: 120_000, retry: false });
}
export function analysisError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202')) return 'Die Wahlanalyse ist noch nicht in der Datenbank eingerichtet. Bitte die neuen Migrationen einspielen.';
  return 'Die Analysedaten konnten nicht geladen werden. Bitte erneut versuchen.';
}
