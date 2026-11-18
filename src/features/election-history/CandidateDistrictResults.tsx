import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { candidateMandateLabel, candidateOutcomeLabel, candidateResultConflict, type LinkedCandidateResult } from './candidateResults';

const number = (value: number | null) => value === null ? 'nicht vorhanden' : value.toLocaleString('de-DE', { maximumFractionDigits: 5 });

export function CandidateDistrictResults({ periodId, districtId }: { periodId: string; districtId: string }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['election-history', user?.id, 'candidate-results', periodId, districtId],
    enabled: !!user && !!periodId && !!districtId,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_election_candidate_results', { selected_period: periodId, selected_district: districtId }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Ungültige Kandidaturergebnisse.');
      return data as unknown as LinkedCandidateResult[];
    }, staleTime: 60_000, retry: false,
  });
  return <div className="space-y-2 border-t pt-2">
    <h4 className="text-sm font-medium">Kandidaturen & zugeordnete Wahlkreisergebnisse</h4>
    {query.isLoading && <p role="status" className="text-xs">Lade Kandidaturergebnisse …</p>}
    {query.error && <p role="alert" className="text-xs">Kandidaturergebnisse konnten nicht geladen werden. <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>Erneut laden</Button></p>}
    {query.data?.length === 0 && <p className="text-xs text-muted-foreground">Keine Kandidaturen erfasst. Mandate allein belegen keine Kandidatur.</p>}
    {query.data?.slice(0, 200).map(row => <div key={row.candidacy_id} className="space-y-1 text-xs">
      <p className="font-medium">{row.person_name || 'Person ohne Namen'} · {row.party}</p>
      <p>{[candidateOutcomeLabel(row), candidateMandateLabel(row)].filter(Boolean).join(' · ')}</p>
      {(row.source_url || row.result_notes) && <details>
        <summary className="cursor-pointer text-muted-foreground">Quelle der Kandidatur</summary>
        {row.source_url && /^https?:\/\//i.test(row.source_url) && <a href={row.source_url} target="_blank" rel="noreferrer" className="underline">Quellenbeleg öffnen</a>}
        {row.result_notes && <p className="break-words">{row.result_notes}</p>}
      </details>}
      <p>Persönlich erfasst: {number(row.votes)} Stimmen · {number(row.vote_share)} %</p>
      {row.link_status === 'linked' && row.district_result && <>
        <p>Zugeordnetes {row.district_result.ballot === 'first' ? 'Erststimmen' : 'Einzelstimmen'}ergebnis: {number(row.district_result.votes)} Stimmen · {number(row.district_result.share)} % · {row.district_result.preliminary ? 'vorläufig' : 'als endgültig geführt'}</p>
        {candidateResultConflict(row) && <p className="text-destructive">Abweichung zum persönlich erfassten Ergebnis. Beide Werte bleiben erhalten.</p>}
        <details><summary className="cursor-pointer text-muted-foreground">Datenstand & Quellenhinweise</summary><p className="mt-1 break-words">{row.district_result.data_release || 'Datenstand unbekannt'} · {row.district_result.notes || 'Keine Quellenhinweise vorhanden.'}</p></details>
      </>}
      {row.link_status === 'ambiguous' && <p>Mehrere Kandidaturen derselben Partei: keine eindeutige Ergebniszuordnung.</p>}
      {row.link_status === 'missing' && <p>Kein passendes Ergebnis mit bestätigter Wahlkreisverbindung vorhanden.</p>}
      {row.link_status === 'ballot_mismatch' && <p>Die Stimmenart dieser Kandidatur passt nicht zum persönlichen Wahlkreisergebnis.</p>}
    </div>)}
    {(query.data?.length || 0) > 200 && <p className="text-xs">Es werden die ersten 200 Kandidaturen angezeigt.</p>}
    <p className="text-xs text-muted-foreground">Zuordnung über vorhandene Kandidatur, Wahl, bestätigten historischen Wahlkreis und Partei. Zweitstimmen sind kein persönliches Ergebnis. Die Zuordnung bestätigt weder die Originalquelle noch die Vollständigkeit aller Kandidierenden.</p>
  </div>;
}
