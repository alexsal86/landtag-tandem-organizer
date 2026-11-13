import { Badge } from '@/components/ui/badge';
import { getPartyColor, getPartyTextColor } from '@/features/election-districts/partyColors';
import { formatPersonalResult, personElectionSummary } from './model';
import type { ElectionHistoryData } from './types';

export function DistrictElectionHistory({ data, periodId, districtNumber }: { data: ElectionHistoryData; periodId: string; districtNumber: number }) {
  const period = data.periods.find(p => p.id === periodId);
  const district = data.districts.find(d => d.period_id === periodId && d.district_number === districtNumber);
  const mandates = data.mandates.filter(m => m.period_id === periodId && m.district_id === district?.id)
    .sort((a, b) => Number(b.mandate_type === 'direct') - Number(a.mandate_type === 'direct') || a.starts_on.localeCompare(b.starts_on));
  const winner = data.candidacies.find(c => c.period_id === periodId && c.district_id === district?.id && c.outcome === 'direct');
  const party = winner?.party || mandates.find(m => m.mandate_type === 'direct')?.party;
  const source = (url: string | null) => url && <a className="text-xs text-muted-foreground underline" href={url} target="_blank" rel="noopener noreferrer">Quelle</a>;
  const periodData = { ...data, mandates: data.mandates.filter(m => (data.periods.find(p => p.id === m.period_id)?.number ?? Infinity) <= (period?.number ?? 0)), candidacies: data.candidacies.filter(c => (data.periods.find(p => p.id === c.period_id)?.number ?? Infinity) <= (period?.number ?? 0)) };
  return <div className="space-y-3">
    <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1"><Badge className="border-0" style={{ backgroundColor: getPartyColor(party), color: getPartyTextColor(party) }}>{districtNumber}</Badge><span className="font-semibold">{district?.name || `Wahlkreis ${districtNumber}`}</span><span className="ml-auto text-xs font-normal text-muted-foreground">{period?.name}</span></h3>
    {!district && <p className="text-sm text-muted-foreground">Für diese Periode ist der Wahlkreis noch nicht zentral hinterlegt.</p>}
    {district?.boundary_note && <p className="text-xs text-muted-foreground">{district.boundary_note}</p>}
    {mandates.map(m => {
      const person = data.people.find(p => p.id === m.person_id);
      const result = data.candidacies.find(c => c.id === m.candidacy_id) || data.candidacies.find(c => c.person_id === m.person_id && c.period_id === periodId && c.district_id === district?.id);
      const summary = personElectionSummary(periodData, m.person_id);
      return <div key={m.id} className="border-t border-border/60 pt-2 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{person?.name}</span><Badge variant="outline" className="border-0 px-2 py-0 text-xs" style={{ backgroundColor: getPartyColor(m.party), color: getPartyTextColor(m.party) }}>{m.party}</Badge><span className="text-xs text-muted-foreground">{m.mandate_type === 'direct' ? '★ Direkt' : 'Liste'}{m.entry_type === 'succession' ? ' · nachgerückt' : ''}</span></div>
        <p className="text-xs text-muted-foreground">{result ? formatPersonalResult(result) : 'Persönliches Wahlergebnis noch nicht erfasst'}</p>
        <p className="text-xs text-muted-foreground">Mandat: {new Date(`${m.starts_on}T12:00:00`).toLocaleDateString('de-DE')}{m.ends_on ? ` – ${new Date(`${m.ends_on}T12:00:00`).toLocaleDateString('de-DE')}` : ' · Ende offen'}</p>
        {summary.reelections !== null ? <p className="text-xs text-muted-foreground">{summary.reelections} Wiederwahl{summary.reelections === 1 ? '' : 'en'} bis zu dieser Periode · {summary.directWins} Direktwahlsieg{summary.directWins === 1 ? '' : 'e'}</p> : <p className="text-xs text-muted-foreground">{summary.elections} gewählte Legislaturperiode{summary.elections === 1 ? '' : 'n'} erfasst · Historie noch unvollständig</p>}
        <div className="flex gap-2">{source(result?.source_url || null)}{m.source_url !== result?.source_url && source(m.source_url)}</div>
      </div>;
    })}
    {district && !mandates.length && <p className="text-sm text-muted-foreground">Noch keine Mandate für diese Periode erfasst.</p>}
    {district && <details className="border-t pt-2"><summary className="cursor-pointer text-xs text-muted-foreground">Alle persönlichen Wahlkreisergebnisse</summary><div className="mt-2 space-y-2">{data.candidacies.filter(c => c.district_id === district.id).sort((a, b) => (a.district_rank ?? Infinity) - (b.district_rank ?? Infinity)).map(c => <div key={c.id} className="text-sm">{data.people.find(p => p.id === c.person_id)?.name} · {c.party}<p className="text-xs text-muted-foreground">{formatPersonalResult(c)} · {c.outcome === 'direct' ? 'Direkt gewählt' : c.outcome === 'list' ? 'Über Liste gewählt' : c.outcome === 'not_elected' ? 'Nicht gewählt' : 'Wahlausgang offen'}</p>{source(c.source_url)}</div>)}</div></details>}
    <details className="border-t pt-2"><summary className="cursor-pointer text-sm font-medium">Frühere Abgeordnete</summary><div className="mt-2 space-y-3">{data.periods.filter(p => p.number < (period?.number || 0)).sort((a, b) => b.number - a.number).map(p => {
      const historical = data.districts.find(d => d.period_id === p.id && d.district_number === districtNumber);
      const previous = data.mandates.filter(m => m.period_id === p.id && historical && m.district_id === historical.id);
      if (!historical && !previous.length) return null;
      return <div key={p.id}><h4 className="text-xs text-muted-foreground">{p.name} · {historical?.name}</h4>{historical?.boundary_note && <p className="text-xs text-muted-foreground">{historical.boundary_note}</p>}{previous.map(m => <p key={m.id} className="mt-1 text-sm">{data.people.find(person => person.id === m.person_id)?.name} · {m.party} · {m.mandate_type === 'direct' ? '★ Direkt' : 'Liste'}{m.entry_type === 'succession' ? ' · nachgerückt' : ''}</p>)}{!previous.length && <p className="text-xs text-muted-foreground">Mandate noch nicht erfasst.</p>}</div>;
    })}<p className="text-xs text-muted-foreground">Zuordnung über die damalige Wahlkreisnummer. Bei Grenzänderungen sind Wahlkreise nicht unmittelbar vergleichbar. Weitere Perioden können noch fehlen.</p></div></details>
  </div>;
}
