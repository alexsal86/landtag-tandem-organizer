import { CandidateDistrictResults } from './CandidateDistrictResults';
import { formatMandateType } from './mandateLabel';
import { PersonElectionSummary } from './PersonElectionSummary';
import { Badge } from '@/components/ui/badge';
import { getPartyColor, getPartyTextColor } from '@/features/election-districts/partyColors';
import { formatPersonalResult, formatMandateDateRange } from './model';
import type { ElectionHistoryData, HistoricalDistrict } from './types';

export function historicalDistrictLabel(district: HistoricalDistrict): string {
  return `${district.district_number ?? district.number_label ?? '–'}: ${district.name}`;
}
export function DistrictElectionHistory({ data, periodId, districtId }: { data: ElectionHistoryData; periodId: string; districtId: string }) {
  const period = data.periods.find(p => p.id === periodId);
  const district = data.districts.find(d => d.period_id === periodId && d.id === districtId);
  const mandates = data.mandates.filter(m => m.period_id === periodId && m.district_id === district?.id)
    .sort((a, b) => Number(b.mandate_type === 'direct') - Number(a.mandate_type === 'direct') || Number(a.entry_type === 'succession') - Number(b.entry_type === 'succession') || (a.starts_on || '').localeCompare(b.starts_on || ''));
  const winner = data.candidacies.find(c => c.period_id === periodId && c.district_id === district?.id && c.outcome === 'direct');
  const party = winner?.party || mandates.find(m => m.mandate_type === 'direct' && m.entry_type === 'election')?.party;
  return <div className="space-y-3">
    <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1"><Badge className="border-0" style={{ backgroundColor: getPartyColor(party), color: getPartyTextColor(party) }}>{district?.district_number ?? district?.number_label ?? '–'}</Badge><span className="font-semibold">{district?.name || 'Wahlkreis nicht erfasst'}</span><span className="ml-auto text-xs font-normal text-muted-foreground">{period?.name}</span></h3>
    {district?.boundary_note && <p className="text-xs text-muted-foreground">{district.boundary_note}</p>}
    {mandates.map(m => {
      const person = data.people.find(p => p.id === m.person_id);
      const result = data.candidacies.find(c => c.id === m.candidacy_id);
      return <div key={m.id} className="border-t border-border/60 pt-2 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{person?.name || m.person_name}</span><Badge variant="outline" className="border-0 px-2 py-0 text-xs" style={{ backgroundColor: getPartyColor(m.party), color: getPartyTextColor(m.party) }}>{m.party}</Badge><span className="text-xs text-muted-foreground">{formatMandateType(m.mandate_type)}{m.entry_type === 'succession' ? ' · nachgerückt' : ''}</span></div>
        {m.party_label && m.party_label !== m.party && <p className="text-xs text-muted-foreground">{m.party_label}</p>}
        {result && <p className="text-xs text-muted-foreground">{formatPersonalResult(result)}</p>}
        {(m.starts_on || m.ends_on || m.left_early) && <p className="text-xs text-muted-foreground">{formatMandateDateRange(m)}{m.end_from_period && period?.ends_on_is_expected ? ' (voraussichtliches Periodenende, kein tatsächliches Ausscheiden)' : ''}{m.left_early ? ' · vorzeitig ausgeschieden' : ''}{m.start_from_period || m.end_from_period ? ' · Periodendaten übernommen' : ''}</p>}
        {m.person_id && <PersonElectionSummary personId={m.person_id} periodId={periodId} />}
        {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
      </div>;
    })}
    {district && !mandates.length && <p className="text-sm text-muted-foreground">Noch keine Mandate für diese Periode erfasst.</p>}
    {district && <CandidateDistrictResults key={district.id} periodId={periodId} districtId={district.id} />}
    <p className="text-xs text-muted-foreground">Andere historische Wahlkreise und Abgeordnete über die Legislaturauswahl anzeigen.</p>
  </div>;
}
