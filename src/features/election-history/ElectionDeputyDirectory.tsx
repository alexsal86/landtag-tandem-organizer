import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { historyError } from './useElectionHistory';
import { formatMandateDateRange } from './model';
import { canConfirmDeputySelection, connectedDeputyMandates } from './deputySelection';

type DeputyGroup = { name_key: string; name: string; parties: string[]; mandates: number; periods: number; unlinked: number };
type DeputyMandate = { id: string; person_id: string | null; connection_id: string | null; name: string; party: string; period_name: string; period_number: number; starts_on: string | null; ends_on: string | null; entry_type: string; district_name: string | null; linked_name: string | null };

export function ElectionDeputyDirectory() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const [group, setGroup] = useState<DeputyGroup | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => { const timer = window.setTimeout(() => { setTerm(search.trim()); setOffset(0); }, 300); return () => window.clearTimeout(timer); }, [search]);
  const groups = useQuery({
    queryKey: ['election-history', user?.id, 'deputies', term, offset], enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('list_election_history_deputies', { search_text: term, page_offset: offset }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Ungültiges Abgeordnetenregister.');
      return data as unknown as DeputyGroup[];
    }, retry: false, refetchInterval: 30_000,
  });
  const detail = useQuery({
    queryKey: ['election-history', user?.id, 'deputy', group?.name_key], enabled: !!user && !!group,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_election_history_deputy', { name_key: group!.name_key }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data) || data.length > 200) throw new Error('Zu viele gleichnamige Mandate für eine gemeinsame Zuordnung. Bitte im Mandatseditor einzeln zuordnen.');
      return data as unknown as DeputyMandate[];
    }, retry: false, refetchInterval: 30_000,
  });
  const rows = detail.data || [];
  const connections = connectedDeputyMandates(rows);
  const confirm = async () => {
    if (saving || !canConfirmDeputySelection(rows, selected)) return;
    const periods = rows.filter(row => selected.includes(row.id)).map(row => row.period_name).join(', ');
    if (!window.confirm(`Diese Mandate von ${group?.name} gehören zusammen: ${periods}. Verbindung bestätigen?`)) return;
    setSaving(true); setError(''); setStatus('');
    try {
      const { error } = await supabase.rpc('connect_election_history_mandates', { mandate_ids: selected });
      if (error) throw error;
      setSelected([]);
      setStatus('Die Mandate sind verbunden. Spätere Zeitraumkorrekturen werden automatisch in dieser Verbindung angezeigt.');
      await cache.invalidateQueries({ queryKey: ['election-history'] });
    } catch (failure) { setError(historyError(failure)); }
    finally { setSaving(false); }
  };
  return <section className="space-y-4">
    <div><h3 className="text-xl font-semibold">Abgeordnete aller Legislaturperioden</h3><p className="text-sm text-muted-foreground">Wähle die Legislaturperioden aus und bestätige: Diese Mandate gehören zusammen. Die Verbindung bleibt bei späteren Zeitraumkorrekturen erhalten.</p></div>
    <div><Label htmlFor="deputy-search">Abgeordnete suchen</Label><Input id="deputy-search" value={search} disabled={saving} onChange={event => setSearch(event.target.value)} placeholder="Name, z. B. Ute Vogt …" /></div>
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card className="min-w-0"><CardHeader><CardTitle>Abgeordnete</CardTitle></CardHeader><CardContent className="space-y-3">
        {groups.isLoading && <p role="status">Lade Abgeordnete …</p>}
        {groups.error && <div role="alert"><p>{historyError(groups.error)}</p><Button variant="outline" onClick={() => void groups.refetch()}>Erneut laden</Button></div>}
        {groups.data?.length === 0 && <p>Keine passenden Mandatseinträge gefunden.</p>}
        {groups.data?.slice(0, 25).map(entry => <div key={entry.name_key} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="min-w-0"><p className="font-medium break-words">{entry.name}</p><p className="text-xs text-muted-foreground">{entry.parties.join(', ')} · {entry.periods} Legislaturperioden · {entry.mandates} Mandate · {entry.unlinked} noch nicht bestätigt</p></div>
          <Button size="sm" variant={group?.name_key === entry.name_key ? 'default' : 'outline'} disabled={saving} onClick={() => { setGroup(entry); setSelected([]); setError(''); setStatus(''); }}>Mandatszeiten verbinden</Button>
        </div>)}
        <div className="flex gap-2"><Button variant="outline" disabled={saving || groups.isFetching || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 25))}>Zurück</Button><Button variant="outline" disabled={saving || groups.isFetching || !groups.data || groups.data.length <= 25} onClick={() => setOffset(value => value + 25)}>Weitere 25</Button></div>
      </CardContent></Card>
      {group && <Card className="min-w-0"><CardHeader><CardTitle>{group.name}: Mandatszeiten verbinden</CardTitle></CardHeader><CardContent className="space-y-4">
        {detail.isLoading && <p role="status">Lade Mandate …</p>}
        {detail.error && <div role="alert"><p>{historyError(detail.error)}</p><Button variant="outline" onClick={() => void detail.refetch()}>Erneut laden</Button></div>}
        {connections.map(connection => <div key={connection[0].connection_id || connection[0].person_id} className="rounded-md border border-green-600/30 bg-green-600/5 p-3 text-sm">
          <p className="font-medium">Bestätigte Mandatszeiten</p>
          {connection.map(row => <p key={row.id}>{row.period_name}: {formatMandateDateRange(row)}</p>)}
          <p className="mt-2 text-xs text-muted-foreground">Die Zeiträume werden aus den aktuellen Mandaten übernommen. Unterbrechungen bleiben erhalten.</p>
        </div>)}
        {rows.some(row => !row.connection_id) && <Button size="sm" variant="outline" disabled={saving} onClick={() => setSelected(rows.map(row => row.id))}>Alle angezeigten Mandate auswählen</Button>}
        {rows.map(row => <Label key={row.id} className="flex items-start gap-2 rounded-md border p-3">
          <input type="checkbox" className="mt-1" disabled={saving} checked={selected.includes(row.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, row.id] : ids.filter(id => id !== row.id))} />
          <span><span className="block">{row.period_name} · {row.party} · {row.name}</span><span className="block text-xs text-muted-foreground">{row.district_name || 'ohne Wahlkreis'} · {formatMandateDateRange(row)} · {row.entry_type === 'succession' ? 'nachgerückt' : 'gewählt'}</span><span className="block text-xs">{row.connection_id || row.person_id ? 'Bereits bestätigt · zum Erweitern der Verbindung mit auswählen' : 'Noch nicht bestätigt'}</span></span>
        </Label>)}
        {rows.length > 1 && <div className="space-y-2">
          <Button disabled={saving || !canConfirmDeputySelection(rows, selected)} onClick={() => void confirm()}>{saving ? 'Speichert …' : 'Ja, diese Mandate gehören zusammen'}</Button>
          {selected.length > 0 && !canConfirmDeputySelection(rows, selected) && <p className="text-xs text-muted-foreground">Wähle mindestens zwei Mandate aus, darunter ein Mandat ohne feste Mandatsverbindung. Bereits getrennt bestätigte Verbindungen werden nicht zusammengeführt.</p>}
        </div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {status && <p role="status" className="text-sm">{status}</p>}
      </CardContent></Card>}
    </div>
  </section>;
}
