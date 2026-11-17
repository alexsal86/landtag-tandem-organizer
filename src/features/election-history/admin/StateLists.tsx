import { FactionSelect } from './FactionSelect';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { historyError } from '../useElectionHistory';
import { uniqueStateListMatch, type StateList, type StateListEntry, type StateListPerson } from './stateListModel';

type Props = { periodId: string; periodNumber: number; initialListId?: string; initialEntryId?: string; onOpenDeputy: (id: string, name: string) => void };
const emptyEntry = { position: '', person_name: '', connection_id: '', notes: '' };
export function StateLists({ periodId, periodNumber, initialListId = '', initialEntryId = '', onOpenDeputy }: Props) {
  const { user } = useAuth(); const cache = useQueryClient();
  const [selected, setSelected] = useState(initialListId); const [offset, setOffset] = useState(0);
  const [header, setHeader] = useState<{ id?: string; party: string; source_url: string; notes: string } | null>(null);
  const openedFocus = useRef('');
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [entry, setEntry] = useState(emptyEntry); const [term, setTerm] = useState('');
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const lists = useQuery({ queryKey: ['election-history', user?.id, 'state-lists', periodId], enabled: !!user && !!periodId && periodNumber >= 18,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.from('election_history_state_lists').select('*').eq('period_id', periodId).order('party').limit(100).abortSignal(signal); if (error) throw error; return data as StateList[]; }, retry: false,
  });
  const listId = selected || lists.data?.[0]?.id || '';
  const list = lists.data?.find(item => item.id === listId);
  useEffect(() => {
    if (list && initialListId === list.id && initialEntryId === list.id && openedFocus.current !== list.id) {
      openedFocus.current = list.id; setHeader({ id: list.id, party: list.party, source_url: list.source_url || '', notes: list.notes || '' });
    }
  }, [list, initialListId, initialEntryId]);
  const entries = useQuery({ queryKey: ['election-history', user?.id, 'state-list-entries', listId, offset], enabled: !!user && !!listId,
    queryFn: async ({ signal }) => { const { data, error, count } = await supabase.from('election_history_state_list_entries').select('*', { count: 'exact' }).eq('list_id', listId).order('position').range(offset, offset + 99).abortSignal(signal); if (error) throw error; return { rows: data as StateListEntry[], total: count || 0 }; }, retry: false,
  });
  // An issue may point at an entry beyond the first roster page.
  const focused = useQuery({ queryKey: ['election-history', user?.id, 'state-list-entry', initialEntryId, listId], enabled: !!user && !!listId && !!initialEntryId && initialEntryId !== initialListId,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.from('election_history_state_list_entries').select('*').eq('id', initialEntryId).eq('list_id', listId).abortSignal(signal).maybeSingle(); if (error) throw error; return data as StateListEntry | null; }, retry: false,
  });
  useEffect(() => { if (focused.data && openedFocus.current !== focused.data.id) { const row = focused.data; openedFocus.current = row.id; setEditing(row.id); setEntry({ position: String(row.position), person_name: row.person_name, connection_id: row.connection_id || '', notes: row.notes || '' }); } }, [focused.data]);
  useEffect(() => { const timer = window.setTimeout(() => setTerm(entry.person_name.trim()), 250); return () => window.clearTimeout(timer); }, [entry.person_name]);
  const matches = useQuery({ queryKey: ['election-history', user?.id, 'state-list-people', term], enabled: !!user && editing !== undefined && term.length >= 2,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.rpc('search_election_state_list_people', { search_text: term }).abortSignal(signal); if (error) throw error; if (!Array.isArray(data)) throw new Error('Ungültige Namenssuche.'); return data as unknown as StateListPerson[]; }, retry: false,
  });
  const exact = term === entry.person_name.trim() ? uniqueStateListMatch(matches.data || []) : null;
  const refresh = () => cache.invalidateQueries({ queryKey: ['election-history'] });
  const failure = (value: unknown, forHeader = false) => setError(typeof value === 'object' && value && 'code' in value && value.code === '23505' ? forHeader ? 'Für diese Partei existiert in dieser Legislaturperiode bereits eine Landesliste.' : 'Dieser Listenplatz oder diese Person ist in der Landesliste bereits erfasst.' : historyError(value));
  const saveHeader = async () => {
    if (!header || !header.party.trim() || saving) return;
    setSaving(true); setError('');
    try {
      const source = header.source_url.trim();
      if (source) { let valid = false; try { valid = ['http:', 'https:'].includes(new URL(source).protocol); } catch { /* Invalid source URL. */ } if (!valid) throw new Error('Bitte eine gültige Quellen-URL mit http:// oder https:// angeben.'); }
      const payload = { period_id: periodId, party: header.party.trim(), source_url: source || null, notes: header.notes.trim() || null };
      const result = header.id ? await supabase.from('election_history_state_lists').update(payload).eq('id', header.id).select('id').single() : await supabase.from('election_history_state_lists').insert(payload).select('id').single();
      if (result.error) throw result.error; if (result.data.id !== listId) { setEditing(undefined); setEntry(emptyEntry); setOffset(0); } setSelected(result.data.id); setHeader(null); await refresh();
    } catch (value) { failure(value, true); } finally { setSaving(false); }
  };
  const saveEntry = async () => {
    if (!listId || saving || !entry.person_name.trim()) return;
    const position = Number(entry.position); if (!Number.isInteger(position) || position < 1 || position > 1000) { setError('Bitte einen Listenplatz zwischen 1 und 1000 angeben.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { list_id: listId, position, person_name: entry.person_name.trim(), connection_id: entry.connection_id || null, link_mode: entry.connection_id ? 'manual' : 'auto', notes: entry.notes.trim() || null };
      const result = editing ? await supabase.from('election_history_state_list_entries').update(payload).eq('id', editing) : await supabase.from('election_history_state_list_entries').insert(payload);
      if (result.error) throw result.error; setEditing(undefined); setEntry({ ...emptyEntry, position: String(position + 1) }); await refresh();
    } catch (value) { failure(value); } finally { setSaving(false); }
  };
  const removeEntry = async (row: StateListEntry) => {
    if (saving || !window.confirm(`Listenplatz ${row.position}: ${row.person_name} aus dieser Landesliste entfernen? Die Mandatshistorie bleibt erhalten.`)) return;
    setSaving(true); setError(''); try { const { error } = await supabase.from('election_history_state_list_entries').delete().eq('id', row.id); if (error) throw error; if (editing === row.id) setEditing(undefined); await refresh(); } catch (value) { failure(value); } finally { setSaving(false); }
  };
  if (periodNumber < 18) return <p>Landeslisten werden ab der 18. Legislaturperiode erfasst. Bitte eine entsprechende Wahl auswählen.</p>;
  return <section className="min-w-0 space-y-4">
    <div><h3 className="text-xl font-semibold">Landeslisten dieser Wahl</h3><p className="text-sm text-muted-foreground">Je Partei eine geordnete Liste. Eindeutige Namensübereinstimmungen werden mit der vorhandenen Mandatshistorie verbunden. Eine Listenaufstellung erzeugt kein Mandat und kein Wahlergebnis.</p></div>
    <div className="flex min-w-0 flex-wrap items-end gap-2"><div className="min-w-0 flex-1"><Label htmlFor="state-list-choice">Partei / Liste</Label><select id="state-list-choice" className="h-10 min-w-0 w-full rounded-md border bg-background px-2" value={listId} disabled={saving} onChange={event => { setSelected(event.target.value); setOffset(0); setEditing(undefined); setHeader(null); setError(''); }}><option value="" disabled>Landesliste auswählen</option>{lists.data?.map(item => <option key={item.id} value={item.id}>{item.party}</option>)}</select></div><Button disabled={saving} onClick={() => { setHeader({ party: '', source_url: '', notes: '' }); setError(''); }}>Landesliste anlegen</Button>{list && <Button variant="outline" disabled={saving} onClick={() => setHeader({ id: list.id, party: list.party, source_url: list.source_url || '', notes: list.notes || '' })}>Quelle / Liste bearbeiten</Button>}</div>
    {lists.isLoading && <p role="status">Landeslisten werden geladen …</p>}{lists.error && <div role="alert"><p>{historyError(lists.error)}</p><Button onClick={() => void lists.refetch()}>Erneut laden</Button></div>}
    {header && <Card><CardHeader><CardTitle>{header.id ? 'Landesliste bearbeiten' : 'Neue Landesliste'}</CardTitle></CardHeader><CardContent className="space-y-3"><div><Label htmlFor="state-list-party">Partei</Label><FactionSelect id="state-list-party" required disabled={saving} value={header.party} onChange={party => setHeader({ ...header, party })} /></div><div><Label htmlFor="state-list-source">Quellen-URL</Label><Input id="state-list-source" type="url" disabled={saving} value={header.source_url} onChange={event => setHeader({ ...header, source_url: event.target.value })} /></div><div><Label htmlFor="state-list-notes">Anmerkungen</Label><Textarea id="state-list-notes" disabled={saving} value={header.notes} onChange={event => setHeader({ ...header, notes: event.target.value })} /></div><div className="flex flex-wrap gap-2"><Button disabled={saving || !header.party.trim()} onClick={() => void saveHeader()}>Liste speichern</Button><Button variant="outline" disabled={saving} onClick={() => setHeader(null)}>Abbrechen</Button></div></CardContent></Card>}
    {list && <>
      {list.source_url && <a className="break-all text-sm underline" href={list.source_url} target="_blank" rel="noopener noreferrer">Quelle der Landesliste</a>}{list.notes && <p className="whitespace-pre-wrap text-sm">{list.notes}</p>}
      <Button disabled={saving} onClick={() => { setEntry({ ...emptyEntry, position: entry.position }); setEditing(null); setError(''); }}>Listenplatz ergänzen</Button>
      {editing !== undefined && <Card><CardHeader><CardTitle>{editing ? 'Listenplatz bearbeiten' : 'Neuer Listenplatz'}</CardTitle></CardHeader><CardContent className="min-w-0 space-y-3">
        <div className="grid min-w-0 gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]"><div><Label htmlFor="state-entry-position">Listenplatz</Label><Input id="state-entry-position" type="number" min={1} max={1000} disabled={saving} value={entry.position} onChange={event => setEntry({ ...entry, position: event.target.value })} /></div><div className="min-w-0"><Label htmlFor="state-entry-name">Name</Label><Input id="state-entry-name" maxLength={300} disabled={saving} value={entry.person_name} onChange={event => setEntry({ ...entry, person_name: event.target.value, connection_id: '' })} /></div></div>
        {entry.connection_id ? <p className="text-sm">Die gewählte Mandatshistorie wird übernommen. <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEntry({ ...entry, connection_id: '' })}>Auswahl zurücksetzen</Button></p> : exact ? <p role="status" className="text-sm">Eindeutig gefunden: {exact.name} ({exact.parties.join(', ')}). Wird beim Speichern automatisch verbunden.</p> : <p className="text-sm text-muted-foreground">Bei keinem oder mehreren passenden Namen bleibt die Zuordnung offen. Du kannst einen Treffer ausdrücklich auswählen.</p>}
        {matches.isFetching && <p role="status" className="text-sm">Vorhandene Abgeordnete werden gesucht …</p>}
        {matches.error && <p role="alert">{historyError(matches.error)}</p>}
        {!entry.connection_id && !!matches.data?.length && <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">{matches.data.map(person => <li key={person.connection_id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 p-1"><span className="min-w-0 text-sm [overflow-wrap:anywhere]">{person.name} · {person.parties.join(', ')} · LP {person.periods.join(', ')}</span><Button size="sm" variant="outline" disabled={saving} onClick={() => setEntry({ ...entry, connection_id: person.connection_id })}>Übernehmen</Button></li>)}</ul>}
        <div><Label htmlFor="state-entry-notes">Anmerkungen</Label><Textarea id="state-entry-notes" disabled={saving} value={entry.notes} onChange={event => setEntry({ ...entry, notes: event.target.value })} /></div>
        <div className="flex flex-wrap gap-2"><Button disabled={saving || !entry.person_name.trim() || !entry.position} onClick={() => void saveEntry()}>{saving ? 'Speichert …' : 'Listenplatz speichern'}</Button><Button variant="outline" disabled={saving} onClick={() => setEditing(undefined)}>Abbrechen</Button></div>
      </CardContent></Card>}
      {entries.isLoading && <p role="status">Listenplätze werden geladen …</p>}{entries.error && <div role="alert"><p>{historyError(entries.error)}</p><Button onClick={() => void entries.refetch()}>Erneut laden</Button></div>}{focused.error && <p role="alert">{historyError(focused.error)}</p>}
      <ol className="space-y-2">{entries.data?.rows.map(row => <li key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3"><div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><p className="font-medium">{row.position}. {row.person_name}</p><p className="text-xs text-muted-foreground">{row.connection_id ? row.link_mode === 'auto' ? 'Automatisch mit Mandatshistorie verbunden' : 'Mit Mandatshistorie verbunden' : 'Zuordnung offen · kein eindeutiger Treffer'}{row.notes ? ` · ${row.notes}` : ''}</p></div><div className="flex flex-wrap gap-2">{row.connection_id && <Button size="sm" variant="outline" onClick={() => onOpenDeputy(row.connection_id!, row.person_name)}>Mandatshistorie</Button>}<Button size="sm" variant="outline" disabled={saving} onClick={() => { setEditing(row.id); setEntry({ position: String(row.position), person_name: row.person_name, connection_id: row.connection_id || '', notes: row.notes || '' }); setError(''); }}>Bearbeiten</Button><Button size="sm" variant="ghost" disabled={saving} onClick={() => void removeEntry(row)}>Entfernen</Button></div></li>)}</ol>
      {entries.data && <div className="flex flex-wrap items-center gap-2"><span className="text-sm">{entries.data.total} Listenplätze</span><Button variant="outline" disabled={offset === 0 || entries.isFetching} onClick={() => setOffset(value => Math.max(0, value - 100))}>Zurück</Button><Button variant="outline" disabled={offset + 100 >= entries.data.total || entries.isFetching} onClick={() => setOffset(value => value + 100)}>Weitere 100</Button></div>}
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
