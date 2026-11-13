import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { historyTables, type HistoryEntity, type FormValues, parseHistoryForm } from './model';
import type { ElectionHistoryData, ElectionHistoryTables } from './types';

// Supabase's default row limit must not silently truncate historical records.
async function readAll<K extends typeof historyTables[HistoryEntity]>(table: K): Promise<ElectionHistoryTables[K]['Row'][]> {
  const rows: ElectionHistoryTables[K]['Row'][] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select('*').order('id').range(offset, offset + 499);
    if (error) throw error;
    const page = (data || []) as unknown as ElectionHistoryTables[K]['Row'][];
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}
export function useElectionHistory(): UseQueryResult<ElectionHistoryData, Error> {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['election-history', user?.id], enabled: !!user,
    queryFn: async (): Promise<ElectionHistoryData> => {
      const [periods, people, districts, candidacies, mandates] = await Promise.all([
        readAll('election_history_periods'), readAll('election_history_people'), readAll('election_history_districts'),
        readAll('election_history_candidacies'), readAll('election_history_mandates'),
      ]);
      return { periods: periods.sort((a, b) => b.number - a.number), people: people.sort((a, b) => a.name.localeCompare(b.name, 'de')), districts, candidacies, mandates };
    }, staleTime: 60_000, retry: false,
  });
}
export async function saveHistoryEntry(entity: HistoryEntity, values: FormValues, id?: string) {
  const parsed = parseHistoryForm(entity, values);
  // Keep each table and payload paired for the generated Supabase types.
  const mutation = (() => {
    switch (parsed.entity) {
      case 'periods': return id ? supabase.from('election_history_periods').update(parsed.data).eq('id', id) : supabase.from('election_history_periods').insert(parsed.data);
      case 'people': return id ? supabase.from('election_history_people').update(parsed.data).eq('id', id) : supabase.from('election_history_people').insert(parsed.data);
      case 'districts': return id ? supabase.from('election_history_districts').update(parsed.data).eq('id', id) : supabase.from('election_history_districts').insert(parsed.data);
      case 'candidacies': return id ? supabase.from('election_history_candidacies').update(parsed.data).eq('id', id) : supabase.from('election_history_candidacies').insert(parsed.data);
      case 'mandates': return id ? supabase.from('election_history_mandates').update(parsed.data).eq('id', id) : supabase.from('election_history_mandates').insert(parsed.data);
    }
  })();
  const { data, error } = await mutation.select('id').single();
  if (error) throw error;
  if (!data) throw new Error('Der Datensatz konnte nicht gespeichert werden.');
}
export async function deleteHistoryEntry(entity: HistoryEntity, id: string) {
  const { data, error } = await supabase.from(historyTables[entity]).delete().eq('id', id).select('id').single();
  if (error) throw error;
  if (!data) throw new Error('Der Datensatz wurde nicht gelöscht.');
}
export function historyError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === '23503') return 'Der Datensatz wird noch verwendet oder eine Zuordnung gehört zu einer anderen Periode. Bitte zuerst die Verknüpfungen prüfen.';
    if (error.code === '23505') return 'Dieser Eintrag existiert bereits. Pro Wahlkreis und Wahl kann es nur einen Direktwahlsieger geben.';
    if (error.code === '42501') return 'Nur Super-Admins dürfen zentrale Wahldaten ändern.';
    if (error.code === '42P01' || error.code === 'PGRST205') return 'Die zentrale Wahldatenbank ist noch nicht eingerichtet. Bitte die neue Datenbankmigration einspielen.';
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Die Wahldaten konnten nicht verarbeitet werden.';
}
