import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { historyError, useElectionPersonSearch } from './useElectionHistory';
import { formatMandateDateRange } from './model';
import { canConfirmDeputySelection } from './deputySelection';

type DeputyGroup = { name_key: string; name: string; parties: string[]; mandates: number; periods: number; unlinked: number };
type DeputyMandate = { id: string; person_id: string | null; name: string; party: string; period_name: string; period_number: number; starts_on: string | null; ends_on: string | null; entry_type: string; district_name: string | null; linked_name: string | null };
const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export function ElectionDeputyDirectory() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const [group, setGroup] = useState<DeputyGroup | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [target, setTarget] = useState('');
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
    }, retry: false,
  });
  const detail = useQuery({
    queryKey: ['election-history', user?.id, 'deputy', group?.name_key], enabled: !!user && !!group,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_election_history_deputy', { name_key: group!.name_key }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data) || data.length > 200) throw new Error('Zu viele gleichnamige Mandate für eine gemeinsame Zuordnung. Bitte im Mandatseditor einzeln zuordnen.');
      return data as unknown as DeputyMandate[];
    }, retry: false,
  });
  const people = useElectionPersonSearch(personSearch, !!group);
  const rows = detail.data || [];
  const targets = [...new Map([...rows.filter(row => row.person_id).map(row => ({ id: row.person_id!, name: row.linked_name || row.name })), ...(people.data || [])].map(person => [person.id, person])).values()];
  const confirm = async () => {
    if (saving || !canConfirmDeputySelection(rows, selected) || (!target && !name.trim())) return;
    const targetName = target ? targets.find(person => person.id === target)?.name : name.trim();
    if (!targetName || !window.confirm(`${selected.length} ausgewählte Mandate gehören zu derselben Person „${targetName}“?${target ? '' : ' Dafür wird eine neue Person angelegt.'}`)) return;
    setSaving(true); setError(''); setStatus('');
    try {
      const { error } = await supabase.rpc('confirm_election_history_deputy', {
        mandate_ids: selected, person_name: name.trim(), ...(target ? { target_person: target } : {}),
      });
      if (error) throw error;
      setSelected([]);
      setStatus('Die ausgewählten Mandate sind jetzt derselben Person zugeordnet.');
      await cache.invalidateQueries({ queryKey: ['election-history'] });
    } catch (failure) { setError(historyError(failure)); }
    finally { setSaving(false); }
  };
  return <section className="space-y-4">
    <div><h3 className="text-xl font-semibold">Abgeordnete aller Legislaturperioden</h3><p className="text-sm text-muted-foreground">Gleichnamige Einträge werden zum Vergleich zusammen angezeigt. Wähle die Mandate aus, die zu derselben Person gehören. Parteiwechsel sind möglich.</p></div>
    <div><Label htmlFor="deputy-search">Abgeordnete suchen</Label><Input id="deputy-search" value={search} disabled={saving} onChange={event => setSearch(event.target.value)} placeholder="Name, z. B. Ute Vogt …" /></div>
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card className="min-w-0"><CardHeader><CardTitle>Abgeordnete</CardTitle></CardHeader><CardContent className="space-y-3">
        {groups.isLoading && <p role="status">Lade Abgeordnete …</p>}
        {groups.error && <div role="alert"><p>{historyError(groups.error)}</p><Button variant="outline" onClick={() => void groups.refetch()}>Erneut laden</Button></div>}
        {groups.data?.length === 0 && <p>Keine passenden Mandatseinträge gefunden.</p>}
        {groups.data?.slice(0, 25).map(entry => <div key={entry.name_key} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="min-w-0"><p className="font-medium break-words">{entry.name}</p><p className="text-xs text-muted-foreground">{entry.parties.join(', ')} · {entry.periods} Legislaturperioden · {entry.mandates} Mandate · {entry.unlinked} ohne Zuordnung</p></div>
          <Button size="sm" variant={group?.name_key === entry.name_key ? 'default' : 'outline'} disabled={saving} onClick={() => { setGroup(entry); setSelected([]); setName(entry.name); setPersonSearch(entry.name); setTarget(''); setError(''); setStatus(''); }}>Mandate vergleichen</Button>
        </div>)}
        <div className="flex gap-2"><Button variant="outline" disabled={saving || groups.isFetching || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 25))}>Zurück</Button><Button variant="outline" disabled={saving || groups.isFetching || !groups.data || groups.data.length <= 25} onClick={() => setOffset(value => value + 25)}>Weitere 25</Button></div>
      </CardContent></Card>
      {group && <Card className="min-w-0"><CardHeader><CardTitle>{group.name}: Mandate vergleichen</CardTitle></CardHeader><CardContent className="space-y-4">
        {detail.isLoading && <p role="status">Lade Mandate …</p>}
        {detail.error && <div role="alert"><p>{historyError(detail.error)}</p><Button variant="outline" onClick={() => void detail.refetch()}>Erneut laden</Button></div>}
        {rows.some(row => !row.person_id) && <Button size="sm" variant="outline" disabled={saving} onClick={() => setSelected(rows.filter(row => !row.person_id).map(row => row.id))}>Alle noch nicht zugeordneten Mandate auswählen</Button>}
        {rows.map(row => <Label key={row.id} className="flex items-start gap-2 rounded-md border p-3">
          <input type="checkbox" className="mt-1" disabled={saving || !!row.person_id} checked={selected.includes(row.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, row.id] : ids.filter(id => id !== row.id))} />
          <span><span className="block">{row.period_name} · {row.party}</span><span className="block text-xs text-muted-foreground">{row.district_name || 'ohne Wahlkreis'} · {formatMandateDateRange(row)} · {row.entry_type === 'succession' ? 'nachgerückt' : 'gewählt'}</span><span className="block text-xs">{row.person_id ? `Zugeordnet: ${row.linked_name}` : 'Noch keiner Person zugeordnet'}</span></span>
        </Label>)}
        {rows.some(row => !row.person_id) && <fieldset disabled={saving} className="space-y-3">
          <div><Label htmlFor="deputy-person-search">Bestehende Person suchen</Label><Input id="deputy-person-search" value={personSearch} onChange={event => { setPersonSearch(event.target.value); setTarget(''); }} placeholder="Mindestens 2 Anfangsbuchstaben" />{people.error && <p role="alert">{historyError(people.error)}</p>}</div>
          <div><Label htmlFor="deputy-target">Zugeordnete Person</Label><select id="deputy-target" className={selectClass} value={target} onChange={event => setTarget(event.target.value)}><option value="">Neue Person anlegen</option>{targets.map(person => <option key={person.id} value={person.id}>{person.name} · {person.id.slice(0, 8)}</option>)}</select></div>
          {!target && <div><Label htmlFor="deputy-name">Name der neuen Person</Label><Input id="deputy-name" value={name} onChange={event => setName(event.target.value)} /></div>}
          <Button disabled={!canConfirmDeputySelection(rows, selected) || (!target && !name.trim())} onClick={() => void confirm()}>{saving ? 'Speichert …' : `${selected.length} ausgewählte Mandate zuordnen`}</Button>
        </fieldset>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {status && <p role="status" className="text-sm">{status}</p>}
      </CardContent></Card>}
    </div>
  </section>;
}
