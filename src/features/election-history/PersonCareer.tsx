import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { historyError } from './useElectionHistory';
import { formatPersonalResult, formatMandateDateRange } from './model';
import { formatMandateType } from './mandateLabel';
import { careerPeriods, candidacyMandateStatus, candidacyOutcomeLabels, type PersonCareer } from './admin/candidateCareerModel';

export function PersonCareerPanel({ personId, candidaciesOnly = false }: { personId: string; candidaciesOnly?: boolean }) {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['election-history', user?.id, 'person-career', personId], enabled: !!user && !!personId,
    queryFn: async ({ signal }): Promise<PersonCareer> => {
      const { data, error } = await supabase.rpc('get_election_person_career', { person: personId }).abortSignal(signal);
      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data) || !data.person || !Array.isArray(data.candidacies) || !Array.isArray(data.mandates)) throw new Error('Die Personenlaufbahn ist nicht verfügbar.');
      if (data.candidacies.length > 200 || data.mandates.length > 200) throw new Error('Die Laufbahn umfasst zu viele Einträge für diese Übersicht.');
      return data as unknown as PersonCareer;
    }, retry: false, staleTime: 30_000,
  });
  const career = query.data;
  return <section className="min-w-0 space-y-3">
    {query.isLoading && <p role="status">Wahlteilnahmen und Mandate werden geladen …</p>}
    {query.error && <div role="alert"><p>{historyError(query.error)}</p><Button variant="outline" onClick={() => void query.refetch()}>Erneut laden</Button></div>}
    {career && <>
      {!candidaciesOnly && <div className="space-y-1"><h3 className="text-xl font-semibold">{career.person.name}</h3>{career.person.biography && <p className="text-sm text-muted-foreground">{career.person.biography}</p>}<p className="text-sm">{career.candidacies.length} Wahlteilnahmen · {new Set(career.mandates.map(m => m.period_id)).size} Legislaturperioden mit erfasstem Mandat</p></div>}
      {!career.candidacies.length && !career.mandates.length && <p className="text-sm text-muted-foreground">Für diese Person sind noch keine Kandidaturen oder Mandate erfasst.</p>}
      {candidaciesOnly && !career.candidacies.length && <p className="text-sm text-muted-foreground">Noch keine Wahlteilnahmen erfasst.</p>}
      <ol className="space-y-3">{careerPeriods(career).filter(period => !candidaciesOnly || career.candidacies.some(c => c.period_id === period.id)).map(period => <li key={period.id} className="min-w-0 rounded-md border p-3 [overflow-wrap:anywhere]">
        <h4 className="font-semibold">{period.name}</h4>
        <div className="mt-2 space-y-3">{career.candidacies.filter(c => c.period_id === period.id).map(candidate => <div key={candidate.id} className="space-y-1 text-sm">
          <p className="font-medium">Kandidatur · {candidate.party} · {candidacyOutcomeLabels[candidate.outcome]}</p>
          <p>{candidate.district_name ? `Wahlkreis ${candidate.district_label ? `${candidate.district_label}: ` : ''}${candidate.district_name}` : 'Ohne Wahlkreiszuordnung'}{candidate.list_position ? ` · Listenplatz ${candidate.list_position}` : ''}</p>
          <p>{formatPersonalResult(candidate)}</p><p className="text-xs text-muted-foreground">{candidacyMandateStatus(candidate, career.mandates)}</p>
          {candidate.result_preliminary && <p className="text-xs text-muted-foreground">Vorläufiges Ergebnis</p>}
          {candidate.notes && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{candidate.notes}</p>}
          {candidate.source_url && <a className="inline-block underline" href={candidate.source_url} target="_blank" rel="noopener noreferrer">Quelle der Kandidatur</a>}
        </div>)}</div>
        {!candidaciesOnly && <div className="mt-2 space-y-3">{career.mandates.filter(m => m.period_id === period.id).map(mandate => <div key={mandate.id} className="space-y-1 border-l-2 pl-3 text-sm">
          <p className="font-medium">Tatsächliches Mandat · {mandate.party_label || mandate.party}</p><p>{formatMandateDateRange(mandate)}{mandate.end_is_expected ? ' (voraussichtliches Ende)' : ''}</p>
          <p>{formatMandateType(mandate.mandate_type)} · {mandate.entry_type === 'succession' ? 'nachgerückt' : 'bei der Wahl gewählt'}{mandate.left_early ? ' · vorzeitig ausgeschieden' : ''}</p>
          <p>{mandate.district_name ? `Wahlkreis ${mandate.district_label ? `${mandate.district_label}: ` : ''}${mandate.district_name}` : 'Ohne Wahlkreiszuordnung'}</p>
        </div>)}</div>}
      </li>)}</ol>
    </>}
  </section>;
}
export function PersonCareerDialog({ personId, onClose }: { personId: string | null; onClose: () => void }) {
  return <Dialog open={!!personId} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Wahlteilnahmen & Mandate</DialogTitle></DialogHeader>{personId && <PersonCareerPanel key={personId} personId={personId} />}</DialogContent></Dialog>;
}
export function PersonCandidacyHistory({ personId }: { personId: string }) {
  const [open, setOpen] = useState(false);
  return <details className="rounded-md border p-3" onToggle={event => setOpen(event.currentTarget.open)}><summary className="cursor-pointer text-sm font-medium">Alle Wahlteilnahmen, auch ohne anschließendes Mandat</summary>{open && <div className="mt-3"><PersonCareerPanel personId={personId} candidaciesOnly /></div>}</details>;
}

type PersonRow = { id: string; name: string; biography: string | null; candidacy_count: number; mandate_period_count: number };
export function PersonCareerDirectory() {
  const { user } = useAuth(); const [search, setSearch] = useState(''); const [term, setTerm] = useState(''); const [offset, setOffset] = useState(0); const [personId, setPersonId] = useState<string | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => { setTerm(search.trim()); setOffset(0); }, 300); return () => window.clearTimeout(timer); }, [search]);
  const query = useQuery({ queryKey: ['election-history', user?.id, 'person-careers', term, offset], enabled: !!user,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.rpc('search_election_person_careers', { search_text: term, page_offset: offset }).abortSignal(signal); if (error) throw error; if (!Array.isArray(data)) throw new Error('Ungültiges Personenverzeichnis.'); return data as unknown as PersonRow[]; }, retry: false,
  });
  return <section className="min-w-0 space-y-3"><p className="text-sm text-muted-foreground">Alle zentralen Personen, einschließlich Kandidierenden ohne Mandat. Frühere und spätere Wahlteilnahmen bleiben mit derselben Person verbunden.</p><div><Label htmlFor="person-career-search">Name oder Identifikationshinweis suchen</Label><Input id="person-career-search" type="search" value={search} onChange={event => setSearch(event.target.value)} /></div>
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"><Card className="min-w-0"><CardHeader><CardTitle>Personen</CardTitle></CardHeader><CardContent className="space-y-3">
      {query.isLoading && <p role="status">Personen werden geladen …</p>}{query.error && <div role="alert"><p>{historyError(query.error)}</p><Button onClick={() => void query.refetch()}>Erneut laden</Button></div>}
      {query.data?.length === 0 && <p>Keine passenden Personen gefunden.</p>}
      <ul className="space-y-2">{query.data?.slice(0, 25).map(person => <li key={person.id} className="min-w-0 rounded-md border p-3 [overflow-wrap:anywhere]"><button type="button" className="text-left font-medium underline-offset-4 hover:underline" aria-pressed={personId === person.id} onClick={() => setPersonId(person.id)}>{person.name}</button>{person.biography && <p className="text-xs text-muted-foreground">{person.biography}</p>}<p className="text-xs text-muted-foreground">{person.mandate_period_count ? `${person.mandate_period_count} Legislaturperioden mit Mandat` : person.candidacy_count ? 'Kandidierende Person · kein Mandat erfasst' : 'Noch keine Wahlteilnahme erfasst'}</p><Button size="sm" variant="outline" className="mt-2" onClick={() => setPersonId(person.id)}>Laufbahn ansehen</Button></li>)}</ul>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={offset === 0 || query.isFetching} onClick={() => setOffset(value => Math.max(0, value - 25))}>Zurück</Button><Button variant="outline" disabled={!query.data || query.data.length <= 25 || query.isFetching} onClick={() => setOffset(value => value + 25)}>Weitere 25</Button></div>
    </CardContent></Card><Card className="min-w-0"><CardHeader><CardTitle>Wahlteilnahmen & Mandate</CardTitle></CardHeader><CardContent>{personId ? <PersonCareerPanel key={personId} personId={personId} /> : <p className="text-sm text-muted-foreground">Eine Person auswählen, um ihre Laufbahn über alle Legislaturperioden zu sehen.</p>}</CardContent></Card></div>
  </section>;
}
