import { useEffect, useState } from 'react';
import { GitMerge, Search, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, StatusPill } from '@/components/ui-patterns';
import { notify } from '@/lib/notify';
import { formatMandateType } from './mandateLabel';
import { DeputyPortrait, DeputyPortraitThumbnail } from './DeputyPortrait';
import { historyError } from './useElectionHistory';
import { formatMandateDateRange } from './model';

type DeputyGroup = { name_key: string; name: string; parties: string[]; mandates: number; periods: number; unlinked: number };
export type DeputyMandate = { birthday?: string | null; birth_year?: number | null; id: string; person_id: string | null; connection_id: string | null; name: string; party: string; period_name: string; period_number: number; starts_on: string | null; ends_on: string | null; entry_type: string; district_name: string | null; linked_name: string | null; party_label: string | null; district_label: string | null; mandate_type: string; original_mandate: string | null; left_early: boolean; notes: string | null; end_is_expected: boolean };

export function ElectionDeputyDirectory({ readOnly = false, canEditPortraits = !readOnly }: { readOnly?: boolean; canEditPortraits?: boolean }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const [group, setGroup] = useState<DeputyGroup | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<DeputyGroup | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');
  useEffect(() => { const timer = window.setTimeout(() => { setTerm(search.trim()); setOffset(0); }, 300); return () => window.clearTimeout(timer); }, [search]);
  const groups = useQuery({
    queryKey: ['election-history', user?.id, 'deputies-v3', readOnly, term, offset], enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc(readOnly ? 'list_analysis_deputies' : 'list_election_history_deputies', { search_text: term, page_offset: offset }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Ungültiges Abgeordnetenregister.');
      return data as unknown as DeputyGroup[];
    }, retry: false, staleTime: 30_000,
  });
  const detail = useQuery({
    queryKey: ['election-history', user?.id, 'deputy-v3', readOnly, group?.name_key], enabled: !!user && !!group,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc(readOnly ? 'get_analysis_deputy' : 'get_election_history_deputy', { name_key: group!.name_key }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data) || data.length > 200) throw new Error('Die Mandatshistorie überschreitet die maximale Anzahl an Einträgen.');
      return data as unknown as DeputyMandate[];
    }, retry: false, staleTime: 30_000,
  });
  const targetDetail = useQuery({
    queryKey: ['election-history', user?.id, 'deputy-merge-target', mergeTarget?.name_key], enabled: !!user && !readOnly && !!mergeTarget,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_election_history_deputy', { name_key: mergeTarget!.name_key }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data) || data.length > 200) throw new Error('Die Zielhistorie überschreitet die maximale Anzahl an Einträgen.');
      return data as unknown as DeputyMandate[];
    }, retry: false,
  });
  const rows = detail.data || [];
  const selectGroup = (entry: DeputyGroup) => {
    if (mergeMode && group && entry.name_key !== group.name_key) { setMergeTarget(entry); setMergeError(''); return; }
    setGroup(entry); setMergeTarget(null); setMergeMode(false); setMergeError('');
  };
  const merge = async () => {
    if (!group || !mergeTarget || merging) return;
    if (!window.confirm(`„${group.name}“ mit „${mergeTarget.name}“ zu einer Mandatshistorie verbinden? Historische Namen und alle Mandatsdaten bleiben erhalten.`)) return;
    setMerging(true); setMergeError('');
    try {
      const { data: targetKey, error } = await supabase.rpc('merge_election_history_deputies', { source_key: group.name_key, target_key: mergeTarget.name_key });
      if (error) throw error;
      await cache.invalidateQueries({ queryKey: ['election-history'] });
      setGroup({ ...mergeTarget, name_key: targetKey }); setMergeTarget(null); setMergeMode(false);
      notify.success('Mandatshistorien ausdrücklich verbunden');
    } catch (failure) { setMergeError(historyError(failure)); }
    finally { setMerging(false); }
  };

  return <section className="space-y-4">
    <div><h3 className="text-title">Abgeordnetenregister über alle Legislaturperioden</h3><p className="mt-1 max-w-4xl text-body text-muted-foreground">Die stabilen Verbindungskennungen bündeln Mandate über Perioden und Parteiwechsel. Historische Namen bleiben erhalten. Die Porträts und Bildnachweise verwenden denselben Bestand wie unter „Daten“.</p></div>
    <div className="max-w-xl"><Label htmlFor="deputy-search">Name oder historische Schreibweise suchen</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input id="deputy-search" className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Zum Beispiel Ute Vogt …" /></div></div>
    {mergeMode && group && <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-info/40 bg-info/10 p-3 text-sm"><GitMerge className="h-4 w-4 text-info" aria-hidden="true" /><span>Zusammenführung: <strong>{group.name}</strong> in eine zweite ausdrücklich gewählte Gruppe überführen. {mergeTarget ? `Ziel: ${mergeTarget.name}` : 'Ziel in der Tabelle wählen.'}</span><Button size="sm" variant="ghost" onClick={() => { setMergeMode(false); setMergeTarget(null); setMergeError(''); }}><X className="mr-1 h-4 w-4" />Abbrechen</Button></div>}
    <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.4fr)]">
      <Card className="min-w-0"><CardHeader className="pb-3"><CardTitle className="text-body">Personengruppen</CardTitle></CardHeader><CardContent className="space-y-3">
        {groups.isLoading && <p role="status">Abgeordnete werden geladen …</p>}
        {groups.error && <div role="alert"><p>{historyError(groups.error)}</p><Button variant="outline" onClick={() => void groups.refetch()}>Erneut laden</Button></div>}
        {groups.data?.length === 0 && <EmptyState size="sm" title="Keine passenden Mandate" description="Suche oder Seitenauswahl anpassen." />}
        {!!groups.data?.length && <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Parteien</TableHead><TableHead>Legislaturperioden</TableHead><TableHead>Status</TableHead><TableHead>Aktion</TableHead></TableRow></TableHeader><TableBody>{groups.data.slice(0, 25).map(entry => <TableRow key={entry.name_key} data-state={group?.name_key === entry.name_key ? 'selected' : undefined}>
          <TableCell><div className="flex items-center gap-2"><DeputyPortraitThumbnail connectionId={entry.name_key} name={entry.name} /><button type="button" onClick={() => selectGroup(entry)} className="min-w-32 text-left font-medium underline-offset-4 hover:underline">{entry.name}</button></div></TableCell>
          <TableCell className="max-w-44">{entry.parties.join(', ')}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{entry.periods}</TableCell><TableCell>{entry.unlinked ? <StatusPill tone="warning">{entry.unlinked} offen</StatusPill> : <StatusPill tone="success">Verbunden</StatusPill>}</TableCell>
          <TableCell><Button size="sm" variant={mergeMode && group?.name_key !== entry.name_key ? 'default' : 'outline'} disabled={merging || (mergeMode && group?.name_key === entry.name_key)} onClick={() => selectGroup(entry)}>{mergeMode && group?.name_key !== entry.name_key ? 'Als Ziel wählen' : 'Ansehen'}</Button></TableCell>
        </TableRow>)}</TableBody></Table></div>}
        <div className="flex items-center justify-between gap-2"><p className="text-caption text-muted-foreground">Seite {offset / 25 + 1}</p><div className="flex gap-2"><Button variant="outline" disabled={groups.isFetching || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 25))}>Zurück</Button><Button variant="outline" disabled={groups.isFetching || !groups.data || groups.data.length <= 25} onClick={() => setOffset(value => value + 25)}>Weitere 25</Button></div></div>
      </CardContent></Card>

      {!group ? <Card><CardHeader><CardTitle className="text-body">Mandatshistorie auswählen</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Wählen Sie eine Personengruppe. Hier erscheinen alle Mandate chronologisch mit Zeiträumen, Fraktionen und Wahlkreisen.</p></CardContent></Card> : <Card className="min-w-0"><CardHeader className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{group.name}</CardTitle>{!readOnly && <Button size="sm" variant="outline" disabled={merging} onClick={() => { setMergeMode(true); setMergeTarget(null); setMergeError(''); }}><GitMerge className="mr-2 h-4 w-4" aria-hidden="true" />Mit anderer Gruppe verbinden</Button>}</div><p className="text-sm text-muted-foreground">{group.periods} Legislaturperioden · {group.mandates} Mandate · {group.parties.join(', ')}</p></CardHeader><CardContent className="space-y-4">
        <DeputyPortrait key={group.name_key} connectionId={group.name_key} name={group.name} editable={canEditPortraits} />
        {mergeTarget && <div className="space-y-2 rounded-md border bg-muted/20 p-3"><p className="text-sm font-medium">Zusammenführung prüfen</p><p className="text-sm">{group.name} ({rows.length} Mandate) → {mergeTarget.name} ({targetDetail.data?.length ?? '…'} Mandate)</p><p className="text-caption text-muted-foreground">Nur bei gesicherter personeller Identität fortfahren. Gleiche Namen allein reichen nicht. Die Zielgruppe und ihre Porträtkennung bleiben bestehen.</p>{targetDetail.error && <p role="alert" className="text-sm text-destructive">{historyError(targetDetail.error)}</p>}<Button size="sm" disabled={merging || !targetDetail.data || !detail.data} onClick={() => void merge()}>{merging ? 'Wird verbunden …' : 'Zwei Gruppen verbindlich verbinden'}</Button></div>}
        {mergeError && <p role="alert" className="text-sm text-destructive">{mergeError}</p>}
        {detail.isLoading && <p role="status">Mandate werden geladen …</p>}
        {detail.error && <div role="alert"><p>{historyError(detail.error)}</p><Button variant="outline" onClick={() => void detail.refetch()}>Erneut laden</Button></div>}
        {rows.length > 0 && <div className="rounded-md border"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>Legislatur</TableHead><TableHead>Zeitraum</TableHead><TableHead>Wahlkreis</TableHead><TableHead>Partei</TableHead><TableHead>Mandat / Eintritt</TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.id}>
          <TableCell className="font-medium">{row.period_name}{row.name !== group.name && <p className="mt-1 text-caption font-normal text-muted-foreground">Historischer Name: {row.name}</p>}{row.notes && <p className="mt-1 max-w-56 whitespace-pre-wrap text-caption font-normal text-muted-foreground">{row.notes}</p>}</TableCell>
          <TableCell className="whitespace-nowrap">{formatMandateDateRange(row)}{row.end_is_expected && <p className="text-caption text-muted-foreground">voraussichtliches Ende</p>}</TableCell>
          <TableCell>{row.district_name ? `${row.district_label ? `${row.district_label}: ` : ''}${row.district_name}` : 'Ohne Wahlkreis'}</TableCell><TableCell>{row.party_label || row.party}</TableCell><TableCell>{formatMandateType(row.mandate_type)}<p className="text-caption text-muted-foreground">{row.entry_type === 'succession' ? 'nachgerückt' : 'gewählt'}{row.left_early ? ' · vorzeitig ausgeschieden' : ''}</p></TableCell>
        </TableRow>)}</TableBody></Table></div>}
      </CardContent></Card>}
    </div>
  </section>;
}
