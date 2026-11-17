import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { historyError } from './useElectionHistory';
import { stateListDistrictLabel, type DeputyStateListPlace } from './stateListPlaces';
export function DeputyStateListPlaces({ connectionId }: { connectionId: string }) {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['election-history', user?.id, 'deputy-state-lists', connectionId], enabled: !!user && !!connectionId,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_deputy_state_list_places', { connection: connectionId }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data) || data.length > 100) throw new Error('Ungültige Landeslisten-Zuordnung.');
      return data as unknown as DeputyStateListPlace[];
    }, retry: false, staleTime: 30_000 });
  if (!query.isLoading && !query.error && !query.data?.length) return null;
  return <section className="mt-6 min-w-0 space-y-3" aria-label="Landeslistenplätze"><h4 className="text-sm font-semibold uppercase tracking-wide">Landeslisten</h4>
    {query.isLoading && <p role="status" className="text-sm">Listenplätze werden geladen …</p>}
    {query.error && <div role="alert" className="text-sm"><p>{historyError(query.error)}</p><Button variant="link" className="h-auto p-0" onClick={() => void query.refetch()}>Erneut laden</Button></div>}
    <ul className="space-y-3">{query.data?.map(row => <li key={row.id} className="min-w-0 rounded-md border p-3 [overflow-wrap:anywhere]"><p className="font-semibold">{row.party} · Listenplatz {row.position}</p><p className="text-sm text-muted-foreground">Landtagswahl {row.election_year || '–'} · {row.period_number}. Legislaturperiode</p><p className="mt-1 text-sm">{stateListDistrictLabel(row)}</p>{row.residence && <p className="text-xs text-muted-foreground">Wohnort bei Listenaufstellung: {row.residence}</p>}{row.source_url && <a href={row.source_url} className="mt-1 inline-block text-xs underline" target="_blank" rel="noopener noreferrer">Quelle der Landesliste</a>}</li>)}</ul>
    {!!query.data?.length && <p className="text-xs text-muted-foreground">Der Listenplatz beschreibt die Kandidatur. Er belegt keinen Mandatsgewinn und keine tatsächliche Mandatszeit.</p>}
  </section>;
}
