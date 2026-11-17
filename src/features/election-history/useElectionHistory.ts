import { withHistoricalDistrictNames } from './historicalDistrictNames';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { historyTables, type HistoryEntity, type FormValues, parseHistoryForm } from './model';
import type { ElectionHistoryData, ElectionPeriod } from './types';
import type { Json } from '@/integrations/supabase/types';

const periodColumns = 'id,number,name,election_date,starts_on,election_year,ends_on,is_current,is_published,source_url,notes,boundary_geometry_year,boundary_geometry_confirmed,expected_ends_on,ends_on_is_expected,seat_total,seat_distribution,seat_basis,seat_reference_date,seat_source_url,seat_notes';
const personColumns = 'id,name,biography,source_url,history_complete';

/** The small period index is the only query made before a selection. */
export function useElectionPeriods(): UseQueryResult<ElectionPeriod[], Error> {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['election-history', user?.id, 'periods'], enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('election_history_periods').select(periodColumns).order('number', { ascending: false }).limit(100).abortSignal(signal);
      if (error) throw error;
      return (data || []) as ElectionPeriod[];
    }, staleTime: 60_000, gcTime: 300_000, retry: false,
  });
}
export interface ElectionPeriodOverview {
  period_id: string;
  district_count: number;
  mandate_count: number;
  candidacy_count: number;
  open_identity_count: number;
}

export function useElectionPeriodOverview(): UseQueryResult<ElectionPeriodOverview[], Error> {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['election-history', user?.id, 'period-overview'], enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_election_history_period_overview').abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Ungültige Periodenübersicht.');
      return data as ElectionPeriodOverview[];
    }, staleTime: 60_000, gcTime: 120_000, retry: false,
  });
}

export function useElectionHistory(periodId?: string): UseQueryResult<ElectionHistoryData, Error> {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['election-history', user?.id, 'period', periodId], enabled: !!user && !!periodId,
    queryFn: async ({ signal }): Promise<ElectionHistoryData> => {
      if (!periodId) throw new Error('Bitte eine Legislaturperiode auswählen.');
      const { data, error } = await supabase.rpc('get_election_history_period', { period: periodId }).abortSignal(signal);
      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data)
          || !Array.isArray(data.periods) || !Array.isArray(data.people) || !Array.isArray(data.districts)
          || !Array.isArray(data.candidacies) || !Array.isArray(data.mandates)) throw new Error('Ungültige Periodendaten.');
      return withHistoricalDistrictNames(data as unknown as ElectionHistoryData);
    }, staleTime: 60_000, gcTime: 120_000, retry: false,
  });
}
/** Search is bounded and explicit; never download the complete person register. */
export function useElectionPersonSearch(search: string, enabled: boolean) {
  const { user } = useAuth();
  const term = search.trim();
  return useQuery({
    queryKey: ['election-history', user?.id, 'people-search', term], enabled: !!user && enabled && term.length >= 2,
    queryFn: async ({ signal }) => {
      const escaped = term.replace(/[\\%_]/g, character => `\\${character}`);
      const { data, error } = await supabase.from('election_history_people').select(personColumns).ilike('name', `${escaped}%`).order('name').limit(20).abortSignal(signal);
      if (error) throw error;
      return data || [];
    }, staleTime: 60_000, gcTime: 120_000,
  });
}
export async function saveHistoryEntry(entity: HistoryEntity, values: FormValues, id?: string) {
  const parsed = parseHistoryForm(entity, values);
  // Keep each table and payload paired for the generated Supabase types.
  const mutation = (() => {
    switch (parsed.entity) {
      case 'periods': return id ? supabase.from('election_history_periods').update(parsed.data).eq('id', id) : supabase.from('election_history_periods').insert(parsed.data);
      case 'people': return id ? supabase.from('election_history_people').update(parsed.data).eq('id', id) : supabase.from('election_history_people').insert(parsed.data);
      case 'districts': {
        const districtData = { ...parsed.data, boundaries: parsed.data.boundaries as unknown as Json };
        return id ? supabase.from('election_history_districts').update(districtData).eq('id', id) : supabase.from('election_history_districts').insert(districtData);
      }
      case 'candidacies': return id ? supabase.from('election_history_candidacies').update(parsed.data).eq('id', id) : supabase.from('election_history_candidacies').insert(parsed.data);
      case 'mandates': return id ? supabase.from('election_history_mandates').update(parsed.data).eq('id', id) : supabase.from('election_history_mandates').insert(parsed.data);
    }
  })();
  const { error } = await mutation;
  if (error) throw error;
}
export async function deleteHistoryEntry(entity: HistoryEntity, id: string) {
  const { error } = await supabase.from(historyTables[entity]).delete().eq('id', id);
  if (error) throw error;
}
export function historyError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === '23503') return 'Der Datensatz wird noch verwendet oder eine Zuordnung gehört zu einer anderen Periode. Bitte zuerst die Verknüpfungen prüfen.';
    if (error.code === '23505') return 'Dieser Datensatz oder diese Zuordnung existiert bereits. Bitte vorhandene Mandate und Wahlkreisnummern prüfen.';
    if (error.code === '42501') return 'Nur Super-Admins dürfen zentrale Wahldaten ändern.';
    if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202') return 'Die zentrale Wahldatenbank ist noch nicht eingerichtet. Bitte die neue Datenbankmigration einspielen.';
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Die Wahldaten konnten nicht verarbeitet werden.';
}
