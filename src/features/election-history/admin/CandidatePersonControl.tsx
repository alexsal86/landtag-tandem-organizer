import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ElectionPerson } from '../types';
import { historyError } from '../useElectionHistory';
import { PersonCareerDialog } from '../PersonCareer';

type Props = { id: string; value: string; people: ElectionPerson[]; search: string; onSearch: (value: string) => void; onSelect: (id: string) => void; onCreated: (person: ElectionPerson) => void; disabled: boolean; onBusyChange: (busy: boolean) => void; searchError: unknown };
export function CandidatePersonControl({ id, value, people, search, onSearch, onSelect, onCreated, disabled, searchError, onBusyChange }: Props) {
  const cache = useQueryClient(); const [creating, setCreating] = useState(false); const [name, setName] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [review, setReview] = useState<string | null>(null);
  const create = async () => {
    if (busy || !name.trim()) return; setBusy(true); onBusyChange(true); setError('');
    try {
      const { data, error } = await supabase.rpc('create_election_candidate_person', { person_name: name.trim(), identity_note: note.trim() }); if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.id !== 'string' || typeof data.name !== 'string') throw new Error('Die neue Person konnte nicht bestätigt werden.');
      onCreated(data as unknown as ElectionPerson); setCreating(false); setName(''); setNote(''); await cache.invalidateQueries({ queryKey: ['election-history'] });
    } catch (failure) { setError(historyError(failure)); } finally { setBusy(false); onBusyChange(false); }
  };
  return <div className="min-w-0 space-y-2">
    <div><Label htmlFor={`${id}-search`} className="text-xs">Vorhandene Person über alle Perioden suchen</Label><Input id={`${id}-search`} disabled={disabled || busy} value={search} onChange={event => onSearch(event.target.value)} placeholder="Mindestens 2 Anfangsbuchstaben" /></div>
    <select id={id} className="h-9 min-w-0 w-full max-w-full rounded-md border bg-background px-2 text-sm" value={value} disabled={disabled || busy} onChange={event => onSelect(event.target.value)}><option value="">Kandidierende Person auswählen</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}{person.biography ? ` · ${person.biography.slice(0, 120)}` : ''}</option>)}</select>
    {value && people.filter(person => person.name.toLocaleLowerCase('de') === people.find(item => item.id === value)?.name.toLocaleLowerCase('de')).length > 1 && <p className="text-xs text-muted-foreground">Es gibt mehrere namensgleiche Personen. Bitte vor der Zuordnung die vorhandene Laufbahn prüfen.</p>}
    <p className="text-xs text-muted-foreground">Auch Personen ohne Mandat können kandidieren. Bei einer späteren Wahl oder einem Mandat dieselbe Person wiederverwenden.</p>
    {searchError && <p role="alert" className="text-xs">{historyError(searchError)}</p>}
    <div className="flex flex-wrap gap-2">{value && <Button size="sm" className="h-auto max-w-full whitespace-normal py-2" variant="outline" disabled={busy} onClick={() => setReview(value)}>Vorhandene Laufbahn prüfen</Button>}<Button size="sm" className="h-auto max-w-full whitespace-normal py-2" variant="outline" disabled={disabled || busy} onClick={() => { setCreating(value => !value); setName(search.trim()); setError(''); }}>Neue kandidierende Person</Button></div>
    {creating && <div className="space-y-2 rounded-md border bg-muted/20 p-3"><div><Label htmlFor={`${id}-new-name`}>Name der neuen Person</Label><Input id={`${id}-new-name`} maxLength={300} value={name} disabled={busy || disabled} onChange={event => setName(event.target.value)} /></div><div><Label htmlFor={`${id}-new-note`}>Identifikationshinweis</Label><Input id={`${id}-new-note`} maxLength={2000} value={note} disabled={busy || disabled} placeholder="Bei Namensgleichheit erforderlich, z. B. Geburtsjahr oder Herkunft" onChange={event => setNote(event.target.value)} /></div><p className="text-xs text-muted-foreground">Die Person wird im zentralen Register gespeichert und für diese Kandidatur ausgewählt. Anschließend die Kandidatur speichern.</p><Button size="sm" className="h-auto max-w-full whitespace-normal py-2" disabled={busy || disabled || !name.trim()} onClick={() => void create()}>{busy ? 'Speichert …' : 'Person anlegen und auswählen'}</Button></div>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <PersonCareerDialog personId={review} onClose={() => setReview(null)} />
  </div>;
}
