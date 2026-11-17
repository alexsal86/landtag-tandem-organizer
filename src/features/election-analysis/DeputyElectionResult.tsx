import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { deputyElectionResultBars, type DeputyElectionResultData } from './deputyElectionResult';

export function DeputyElectionResult({ mandateId }: { mandateId: string }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['election-history',user?.id,'deputy-election-result',mandateId], enabled: !!user && !!mandateId,
    queryFn: async ({ signal }) => {
      const { data,error } = await supabase.rpc('get_analysis_deputy_election_result',{ selected_mandate:mandateId }).abortSignal(signal);
      if (error) throw error;
      if (data===null) return null;
      if (typeof data!=='object' || Array.isArray(data) || !Array.isArray(data.candidates) || !Array.isArray(data.results)) throw new Error('Ungültiges Wahlkreisergebnis.');
      return data as unknown as DeputyElectionResultData;
    }, staleTime:30_000,retry:false,
  });
  const data = query.data;
  const bars = data ? deputyElectionResultBars(data) : [];
  const own = bars.find(row => row.own);
  return <section className="deputy-election-result" aria-label="Wahlkreisergebnis der ausgewählten Legislaturperiode" aria-busy={query.isFetching}>
    <h4 className="deputy-caption deputy-result-heading"><span aria-hidden="true">02</span> Wahlkreisergebnis</h4>
    {query.isLoading && <p role="status" className="text-sm text-muted-foreground">Lade Wahlkreisergebnis …</p>}
    {query.error && <p role="alert" className="text-sm">Das Wahlkreisergebnis konnte nicht geladen werden. <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>Erneut laden</Button></p>}
    {!query.isLoading && !query.error && <>
      {bars.length>0 ? <ul className="deputy-result-bars">{bars.map(row => <li key={row.key} data-own={row.own}>
        <div className="deputy-result-label"><span>{row.label}{row.party && row.label!==row.party && <small>{row.party}</small>}{row.own && <span className="sr-only"> · eigenes Ergebnis</span>}</span><strong>{row.share===null ? 'Nicht erfasst' : `${row.share.toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})} %`}</strong></div>
        {row.share!==null && <div className="deputy-result-track" aria-hidden="true"><span style={{width:`${Math.max(0,Math.min(100,row.share))}%`}} /></div>}
        {row.votes!==null && <p className="deputy-result-votes">{row.votes.toLocaleString('de-DE')} Stimmen</p>}
        {row.conflict && <p className="text-xs text-muted-foreground">Abweichung zum zugeordneten Parteiergebnis; angezeigt ist das persönlich gespeicherte Ergebnis.</p>}
      </li>)}</ul> : <p className="text-sm text-muted-foreground">Für diese Periode ist kein zugeordnetes Wahlkreisergebnis erfasst.</p>}
      {data && <p className="deputy-result-context">{data.ballot==='first' ? 'Erststimmen' : 'Einzelstimmen'}, {data.period_number}. Wahlperiode{data.district_name ? ` · ${data.district_name}` : ''}. {data.entry_type==='succession' ? 'Nachgerückt; kein erneuter Wahleinzug.' : data.mandate_type==='direct' ? 'Direkt gewählt.' : data.ballot==='first' ? 'Einzug über die Landesliste.' : 'Einzug über ein Zweit-/Listenmandat.'}</p>}
      {bars.length>0 && !own && <p className="text-xs text-muted-foreground">Eine persönliche Kandidatur ist für diese Person hier nicht eindeutig zugeordnet. Vorhandene Wahlkreisergebnisse bleiben sichtbar.</p>}
      {bars.some(row => row.preliminary===null) && <p className="text-xs text-muted-foreground">Der Ergebnisstatus ist teilweise nicht erfasst.</p>}
      {bars.some(row => row.preliminary) && <p className="text-xs text-muted-foreground">Enthält vorläufige Ergebnisse.</p>}
      {bars.length>0 && <details className="deputy-result-sources"><summary>Quellen & Datenstand</summary>
        <p>Namen erscheinen nur bei eindeutig erfassten Kandidaturen. Weitere Ergebnisse sind als Partei beschriftet. Die Auswahl ist keine vollständige Kandidatenliste.</p>
        {[...new Set(bars.map(row => [row.data_release,row.notes].filter(Boolean).join(' · ')).filter(Boolean))].map(note => <p key={note}>{note}</p>)}
        {data?.candidates.filter(row => row.source_url).map(row => <a key={row.id} href={row.source_url!} target="_blank" rel="noreferrer">Quelle: {row.name || row.party}</a>)}
      </details>}
    </>}
  </section>;
}
