import { formatMandateType } from './mandateLabel';
import { DeputyPortrait, DeputyPortraitThumbnail } from './DeputyPortrait';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { historyError } from './useElectionHistory';
import { formatMandateDateRange } from './model';

type DeputyGroup = { name_key: string; name: string; parties: string[]; mandates: number; periods: number; unlinked: number };
export type DeputyMandate = { birthday?: string | null; birth_year?: number | null; id: string; person_id: string | null; connection_id: string | null; name: string; party: string; period_name: string; period_number: number; starts_on: string | null; ends_on: string | null; entry_type: string; district_name: string | null; linked_name: string | null; party_label: string | null; district_label: string | null; mandate_type: string; original_mandate: string | null; left_early: boolean; notes: string | null; end_is_expected: boolean };

export function ElectionDeputyDirectory({ readOnly = false, canEditPortraits = !readOnly }: { readOnly?: boolean; canEditPortraits?: boolean }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const [group, setGroup] = useState<DeputyGroup | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => { setTerm(search.trim()); setOffset(0); }, 300); return () => window.clearTimeout(timer); }, [search]);
  const groups = useQuery({
    queryKey: ['election-history', user?.id, 'deputies-v2', readOnly, term, offset], enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc(readOnly ? 'list_analysis_deputies' : 'list_election_history_deputies', { search_text: term, page_offset: offset }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Ungültiges Abgeordnetenregister.');
      return data as unknown as DeputyGroup[];
    }, retry: false, refetchInterval: 30_000,
  });
  const detail = useQuery({
    queryKey: ['election-history', user?.id, 'deputy-v2', readOnly, group?.name_key], enabled: !!user && !!group,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc(readOnly ? 'get_analysis_deputy' : 'get_election_history_deputy', { name_key: group!.name_key }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data) || data.length > 200) throw new Error('Die Mandatshistorie überschreitet die maximale Anzahl an Einträgen.');
      return data as unknown as DeputyMandate[];
    }, retry: false, refetchInterval: 30_000,
  });
  const rows = detail.data || [];
  const openHistory = (entry: DeputyGroup) => setGroup(entry);
  return <section className="space-y-4">
    <div><h3 className="text-xl font-semibold">Personen und ihre Mandatshistorie</h3><p className="text-sm text-muted-foreground">{readOnly ? 'Suche Abgeordnete über alle freigegebenen Legislaturperioden. Ein Klick auf den Namen öffnet die chronologische Mandatshistorie mit Zeiträumen und Wahlkreisen.' : 'Klicke auf einen Namen, um alle zugehörigen Mandate chronologisch zu sehen. Die Mandate aus dem Abgeordnetenimport werden über alle Perioden zusammengeführt, auch bei Parteiwechseln. Unterbrechungen und gleichnamige Personen bleiben getrennt erkennbar.'}</p></div>
    <div><Label htmlFor="deputy-search">Abgeordnete suchen</Label><Input id="deputy-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, z. B. Ute Vogt …" /></div>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card className="min-w-0"><CardHeader><CardTitle>Personen</CardTitle></CardHeader><CardContent className="space-y-3">
        {groups.isLoading && <p role="status">Lade Abgeordnete …</p>}
        {groups.error && <div role="alert"><p>{historyError(groups.error)}</p><Button variant="outline" onClick={() => void groups.refetch()}>Erneut laden</Button></div>}
        {groups.data?.length === 0 && <p>Keine passenden Mandatseinträge gefunden.</p>}
        {groups.data?.slice(0, 25).map(entry => <div key={entry.name_key} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <DeputyPortraitThumbnail connectionId={entry.name_key} name={entry.name} />
          <div className="min-w-0 flex-1"><button type="button" aria-pressed={group?.name_key === entry.name_key} onClick={() => openHistory(entry)} className="text-left font-medium break-words underline-offset-4 hover:underline focus-visible:underline">{entry.name}</button><p className="text-xs text-muted-foreground">{entry.parties.join(', ')} · {entry.periods} Legislaturperioden · {entry.mandates} Mandate</p></div>
          <Button size="sm" variant={group?.name_key === entry.name_key ? 'default' : 'outline'} onClick={() => openHistory(entry)}>Ansehen</Button>
        </div>)}
        <div className="flex gap-2"><Button variant="outline" disabled={groups.isFetching || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 25))}>Zurück</Button><Button variant="outline" disabled={groups.isFetching || !groups.data || groups.data.length <= 25} onClick={() => setOffset(value => value + 25)}>Weitere 25</Button></div>
      </CardContent></Card>
      {!group && readOnly && <Card className="min-w-0"><CardHeader><CardTitle>Abgeordneten auswählen</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Wähle links einen Namen. Hier erscheinen die Mandate mit Legislaturperioden, Zeiträumen, Fraktionen und Wahlkreisen.</p></CardContent></Card>}
      {group && <Card className="min-w-0"><CardHeader><CardTitle>{group.name}: Mandatshistorie</CardTitle></CardHeader><CardContent className="space-y-4">
        <DeputyPortrait key={group.name_key} connectionId={group.name_key} name={group.name} editable={canEditPortraits} />
        {detail.isLoading && <p role="status">Lade Mandate …</p>}
        {detail.error && <div role="alert"><p>{historyError(detail.error)}</p><Button variant="outline" onClick={() => void detail.refetch()}>Erneut laden</Button></div>}
        {!detail.isLoading && !detail.error && rows.length > 0 && <p className="text-sm text-muted-foreground">{new Set(rows.map(row => row.period_number)).size} Legislaturperioden · {rows.length} Mandate. Die Zeiträume entsprechen den aktuellen Einträgen; Unterbrechungen bleiben erhalten.</p>}
        <ol className="ml-2 space-y-5 border-l pl-5">
          {rows.map(row => <li key={row.id} className="relative">
            <span className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border bg-background" aria-hidden="true" />
            <div className="flex items-start gap-2">
              <div className="min-w-0 space-y-1">
                <h4 className="font-semibold">{row.period_name}</h4>
                <p className="text-sm">{formatMandateDateRange(row)}{row.end_is_expected ? ' (voraussichtliches Ende)' : ''}</p>
                <p className="text-sm">{row.district_name ? `Wahlkreis ${row.district_label ? `${row.district_label}: ` : ''}${row.district_name}` : 'Ohne Wahlkreiszuordnung'}</p>
                <p className="text-sm text-muted-foreground">{row.party_label || row.party} · {formatMandateType(row.mandate_type)} · {row.entry_type === 'succession' ? 'nachgerückt' : 'gewählt'}{row.left_early ? ' · vorzeitig ausgeschieden' : ''}</p>
                {row.name !== group.name && <p className="text-xs text-muted-foreground">Historischer Name: {row.name}</p>}
                {row.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{row.notes}</p>}
              </div>
            </div>
          </li>)}
        </ol>
      </CardContent></Card>}
    </div>
  </section>;
}
