import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPersonalResult, formatMandateDateRange } from './model';
import type { ElectionHistoryData, HistoricalMandate } from './types';
const outcomes = { direct: 'Direkt gewählt', list: 'Über Liste gewählt', not_elected: 'Nicht gewählt', unknown: 'Ausgang offen' };

export function ElectionPeriodPreview({ data, periodId }: { data: ElectionHistoryData; periodId: string }) {
  const period = data.periods.find(p => p.id === periodId);
  const candidates = data.candidacies.filter(c => c.period_id === periodId);
  const mandates = data.mandates.filter(m => m.period_id === periodId);
  const districts = data.districts.filter(d => d.period_id === periodId).sort((a, b) => (a.district_number ?? Infinity) - (b.district_number ?? Infinity) || a.name.localeCompare(b.name, 'de'));
  const districtIds = new Set(districts.map(d => d.id));
  const withoutDistrict = mandates.filter(m => !m.district_id);
  const unresolved = mandates.filter(m => m.district_id && !districtIds.has(m.district_id));
  const assigned = mandates.length - withoutDistrict.length - unresolved.length;
  const missingBoundaries = districts.filter(d => !d.boundaries).length;
  const mandateRow = (m: HistoricalMandate) => <li key={m.id} className="text-sm">
    <p>{data.people.find(p => p.id === m.person_id)?.name || m.person_name} · {m.party} · {m.original_mandate || (m.mandate_type === 'direct' ? 'Direktmandat' : 'Listenmandat')}{m.entry_type === 'succession' ? ' · nachgerückt' : ''}</p>
    <p className="text-xs text-muted-foreground">{formatMandateDateRange(m)}{m.end_from_period && period?.ends_on_is_expected ? ' (voraussichtliches Periodenende, kein tatsächliches Ausscheiden)' : ''}{m.start_from_period || m.end_from_period ? ' · Periodendaten übernommen' : ''}</p>
  </li>;
  return <Card><CardHeader><CardTitle>Vorschau: {period?.name}</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-sm">{districts.length} Wahlkreise · {mandates.length} Mandate · {period?.is_published ? 'Freigegeben' : 'Entwurf'}</p>
    <p className="text-xs text-muted-foreground">{assigned} Mandate einem Wahlkreis zugeordnet · {withoutDistrict.length} ohne Wahlkreis · {candidates.length} persönliche Wahlergebnisse erfasst.</p>
    {missingBoundaries > 0 && <p className="text-xs text-muted-foreground">{missingBoundaries} Wahlkreise haben noch keinen historischen Grenzumriss.</p>}
    {unresolved.length > 0 && <p className="text-sm text-destructive" role="alert">Bei {unresolved.length} Mandaten verweist die Zuordnung auf einen Wahlkreis, der in dieser Periode nicht geladen wurde. Bitte unter „Mandate“ prüfen.</p>}
    {districts.map(d => {
      const districtMandates = mandates.filter(m => m.district_id === d.id).sort((a, b) => Number(b.mandate_type === 'direct') - Number(a.mandate_type === 'direct') || Number(a.entry_type === 'succession') - Number(b.entry_type === 'succession'));
      const districtCandidates = candidates.filter(c => c.district_id === d.id).sort((a, b) => (a.district_rank ?? Infinity) - (b.district_rank ?? Infinity));
      return <details key={d.id} className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">{d.district_number ?? d.number_label ?? '–'}: {d.name} <span className="font-normal text-muted-foreground">· {districtMandates.length} Mandate</span></summary>
        {d.boundary_note && <p className="mt-2 text-xs text-muted-foreground">{d.boundary_note}</p>}
        <ul className="mt-2 space-y-2">{districtMandates.map(mandateRow)}</ul>
        {!districtMandates.length && <p className="mt-2 text-xs text-muted-foreground">Noch keine Mandate diesem Wahlkreis zugeordnet.</p>}
        {districtCandidates.length > 0 && <div className="mt-3 border-t pt-2"><h4 className="text-xs font-medium text-muted-foreground">Persönliche Wahlergebnisse</h4><ul className="mt-1 space-y-2">{districtCandidates.map(c => <li key={c.id} className="text-sm">{data.people.find(p => p.id === c.person_id)?.name} · {c.party} · {outcomes[c.outcome]}<p className="text-xs text-muted-foreground">{formatPersonalResult(c)}</p></li>)}</ul></div>}
      </details>;
    })}
    {withoutDistrict.length > 0 && <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Mandate ohne Wahlkreis ({withoutDistrict.length})</summary><p className="mt-2 text-xs text-muted-foreground">Landeslistenmandate können ohne eigene Wahlkreiskandidatur vergeben werden. Diese Einträge stehen deshalb separat.</p><ul className="mt-2 space-y-2">{withoutDistrict.map(mandateRow)}</ul></details>}
    {candidates.some(c => !c.district_id) && <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm">Kandidaturen ohne Wahlkreis</summary>{candidates.filter(c => !c.district_id).map(c => <p key={c.id} className="mt-2 text-sm">{data.people.find(p => p.id === c.person_id)?.name} · {c.party} · {outcomes[c.outcome]}</p>)}</details>}
  </CardContent></Card>;
}
