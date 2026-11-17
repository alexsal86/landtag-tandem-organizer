import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface AssemblyStatus {
  automatic_results: number; linked_mandates: number; issue_count: number;
  issues: { record_key: string; reason: string; details: string | null; person_name: string | null; district_name: string | null }[];
}
export function CandidacyAssemblyStatus({ periodId }: { periodId: string }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['election-history', user?.id, 'assembly-status', periodId],
    enabled: !!user && !!periodId,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_election_history_assembly_status', { selected_period: periodId }).abortSignal(signal);
      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.issues)) throw new Error('Ungültiger Zusammenführungsstatus.');
      return data as unknown as AssemblyStatus;
    }, staleTime: 15_000, retry: false,
  });
  return <section className="space-y-2 rounded-md border p-3 text-sm" aria-label="Automatische Kandidaturergebnisse">
    <h3 className="font-medium">Automatisch zusammengeführte Kandidaturen & Ergebnisse</h3>
    <p>Ursprüngliche Wahleinzüge, vorhandene Personenverbindungen und passende Wahlkreisergebnisse werden automatisch übernommen. Eine zusätzliche Bestätigung pro Kandidatur ist nicht nötig. Nachrückmandate erzeugen keine neue Wahlkandidatur; Zweitstimmen werden nicht zu persönlichen Ergebnissen.</p>
    {query.isLoading && <p role="status">Zusammenführungsstatus wird geladen …</p>}
    {query.error && <p role="alert">Der Zusammenführungsstatus ist nicht verfügbar. <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>Erneut laden</Button></p>}
    {query.data && <>
      <p>{query.data.automatic_results.toLocaleString('de-DE')} Kandidaturen mit übernommenen Ergebnissen · {query.data.linked_mandates.toLocaleString('de-DE')} verknüpfte Mandate</p>
      {query.data.issue_count > 0 && <details><summary className="cursor-pointer">{query.data.issue_count.toLocaleString('de-DE')} fehlende oder widersprüchliche Grundlagen</summary>
        <p className="mt-2 text-muted-foreground">Vorhandene abweichende Angaben bleiben geschützt. Fehlende Stimmen werden nicht geschätzt. Dies sind Datenhinweise, keine ausstehende Bestätigung.</p>
        <ul className="mt-2 space-y-1">{query.data.issues.map(issue => <li key={issue.record_key}>{[issue.person_name, issue.district_name].filter(Boolean).join(' · ')}: {issue.reason}{issue.details ? ` – ${issue.details}` : ''}</li>)}</ul>
        {query.data.issue_count > query.data.issues.length && <p>Die ersten {query.data.issues.length} Hinweise werden angezeigt.</p>}
      </details>}
    </>}
  </section>;
}
