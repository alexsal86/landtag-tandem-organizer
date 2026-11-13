import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPersonalResult } from './model';
import type { ElectionHistoryData } from './types';
const outcomes = { direct: 'Direkt gewählt', list: 'Über Liste gewählt', not_elected: 'Nicht gewählt', unknown: 'Ausgang offen' };
export function ElectionPeriodPreview({ data, periodId }: { data: ElectionHistoryData; periodId: string }) {
  const period = data.periods.find(p => p.id === periodId);
  const candidates = data.candidacies.filter(c => c.period_id === periodId);
  const mandates = data.mandates.filter(m => m.period_id === periodId);
  const districts = data.districts.filter(d => d.period_id === periodId).sort((a, b) => a.district_number - b.district_number);
  const unlinked = mandates.filter(m => !m.candidacy_id).length;
  const missingSources = [...candidates, ...mandates, ...districts].filter(row => !row.source_url).length;
  return <Card><CardHeader><CardTitle>Vorschau: {period?.name}</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-sm">{districts.length} Wahlkreise · {candidates.length} Kandidaturen · {mandates.length} Mandatsabschnitte · {period?.is_published ? 'Freigegeben' : 'Entwurf'}</p>
    <p className="text-xs text-muted-foreground">{unlinked} Mandate ohne verknüpfte Kandidatur · {missingSources} Einträge ohne Quellen-URL. Leere Ergebnisse sind unbekannt, nicht null Stimmen.</p>
    {districts.map(d => <details key={d.id} className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">{d.district_number}: {d.name}</summary>
      {d.boundary_note && <p className="mt-2 text-xs text-muted-foreground">{d.boundary_note}</p>}
      <ul className="mt-2 space-y-2">{candidates.filter(c => c.district_id === d.id).sort((a, b) => (a.district_rank ?? Infinity) - (b.district_rank ?? Infinity)).map(c => <li key={c.id} className="text-sm">{data.people.find(p => p.id === c.person_id)?.name} · {c.party} · {outcomes[c.outcome]}<p className="text-xs text-muted-foreground">{formatPersonalResult(c)}</p></li>)}</ul>
      {!candidates.some(c => c.district_id === d.id) && <p className="mt-2 text-xs text-muted-foreground">Keine Kandidaturen erfasst.</p>}
    </details>)}
    {candidates.some(c => !c.district_id) && <div className="border-t pt-2"><h4 className="text-sm font-medium">Kandidaturen ohne Wahlkreis</h4>{candidates.filter(c => !c.district_id).map(c => <p key={c.id} className="text-sm">{data.people.find(p => p.id === c.person_id)?.name} · {c.party} · {outcomes[c.outcome]}</p>)}</div>}
    <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm">Mandate prüfen</summary>{mandates.map(m => <p key={m.id} className="mt-2 text-sm">{data.people.find(p => p.id === m.person_id)?.name} · {m.party} · {m.mandate_type === 'direct' ? 'Direkt' : 'Liste'} · {m.entry_type === 'succession' ? 'Nachgerückt' : 'Gewählt'} · {m.starts_on}–{m.ends_on || 'offen'}</p>)}</details>
  </CardContent></Card>;
}
