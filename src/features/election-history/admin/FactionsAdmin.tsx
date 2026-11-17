import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { historyError } from '../useElectionHistory';
import { useHistoryFactions } from '../useHistoryFactions';
import type { HistoryFaction } from '../factions';
const blank = { name: '', full_name: '', aliases: '', is_active: true };
export function FactionsAdmin() {
  const query = useHistoryFactions(); const cache = useQueryClient();
  const [editing, setEditing] = useState<string | null | undefined>(); const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const edit = (row: HistoryFaction) => { setEditing(row.id); setForm({ name: row.name, full_name: row.full_name || '', aliases: row.aliases.join('\n'), is_active: row.is_active }); setError(''); };
  const save = async () => {
    if (saving || !form.name.trim()) return; setSaving(true); setError('');
    try {
      const payload = { name: form.name.trim(), full_name: form.full_name.trim() || null, aliases: form.aliases.split('\n').map(s => s.trim()).filter(Boolean), is_active: form.is_active };
      const result = editing ? await supabase.from('election_history_factions').update(payload).eq('id', editing) : await supabase.from('election_history_factions').insert(payload);
      if (result.error) throw result.error;
      await Promise.all([cache.invalidateQueries({ queryKey: ['election-history'] }), cache.invalidateQueries({ queryKey: ['election-analysis'] })]); setEditing(undefined);
    } catch (e) { setError(historyError(e)); } finally { setSaving(false); }
  };
  return <section className="min-w-0 space-y-4"><div><h3 className="text-xl font-semibold">Zentrale Fraktionen & Parteien</h3><p className="text-sm text-muted-foreground">Ein gemeinsames Verzeichnis für alle Legislaturperioden. Namensänderungen gelten für alle Zuordnungen in Mandaten, Kandidaturen, Landeslisten und Sitzverteilungen. Historische Parteien können unabhängig vom Fraktionsstatus erfasst werden.</p></div>
    <Button disabled={saving} onClick={() => { setEditing(null); setForm(blank); setError(''); }}>Eintrag anlegen</Button>
    {query.isLoading && <p role="status">Verzeichnis wird geladen …</p>}{query.error && <p role="alert">{historyError(query.error)} <Button variant="link" onClick={() => void query.refetch()}>Erneut laden</Button></p>}
    {editing !== undefined && <form className="min-w-0 space-y-3 rounded-lg border p-4" onSubmit={e => { e.preventDefault(); void save(); }}>
      <div className="grid min-w-0 gap-3 md:grid-cols-2"><div><Label htmlFor="faction-name">Einheitliche Kurzbezeichnung</Label><Input id="faction-name" value={form.name} maxLength={100} required disabled={saving} onChange={e => setForm({ ...form, name: e.target.value })} /></div><div><Label htmlFor="faction-full">Vollständiger Name</Label><Input id="faction-full" value={form.full_name} disabled={saving} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div></div>
      <div><Label htmlFor="faction-aliases">Weitere Schreibweisen für Importe (eine pro Zeile)</Label><Textarea id="faction-aliases" value={form.aliases} disabled={saving} onChange={e => setForm({ ...form, aliases: e.target.value })} /><p className="text-xs text-muted-foreground">Schreibweisen dürfen nur zu einem Eintrag gehören. Beim Umbenennen bleibt die bisherige Bezeichnung als Schreibweise erhalten.</p></div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} disabled={saving} onChange={e => setForm({ ...form, is_active: e.target.checked })} />Für neue Zuordnungen auswählbar</label>
      <p className="text-xs text-muted-foreground">Inaktive Einträge bleiben in vorhandenen historischen Zuordnungen erhalten.</p>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving || !form.name.trim()}>{saving ? 'Speichert …' : 'Speichern'}</Button><Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(undefined)}>Abbrechen</Button></div>
    </form>}{error && <p role="alert" className="text-destructive">{error}</p>}
    <ul className="space-y-2">{query.data?.map(row => <li key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><p className="font-medium">{row.name}{row.is_active ? '' : ' · inaktiv'}</p>{row.full_name && <p className="text-sm">{row.full_name}</p>}{row.aliases.length > 0 && <p className="text-xs text-muted-foreground">Schreibweisen: {row.aliases.join(', ')}</p>}</div><Button variant="outline" disabled={saving} onClick={() => edit(row)}>Bearbeiten</Button></li>)}</ul>
  </section>;
}
