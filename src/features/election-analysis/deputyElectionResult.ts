export interface DeputyResultNumber {
  party: string; votes: number | null; share: number | null;
  preliminary: boolean | null; data_release: string | null; notes: string | null;
}
export interface DeputyResultCandidate extends DeputyResultNumber {
  id: string; name: string | null; is_own: boolean; source_url: string | null;
}
export interface DeputyElectionResultData {
  mandate_id: string; period_number: number; ballot: 'single' | 'first';
  entry_type: string; mandate_type: string; district_name: string | null;
  candidates: DeputyResultCandidate[]; results: DeputyResultNumber[];
  direct_succession_notes?: string[];
  turnout: { valid_votes: number | null; data_release: string | null; preliminary: boolean } | null;
}
export interface DeputyResultBar {
  key: string; label: string; party: string | null; share: number | null; votes: number | null;
  own: boolean; preliminary: boolean | null; data_release: string | null; notes: string | null;
  conflict: boolean;
}

export function deputyElectionResultBars(data: DeputyElectionResultData): DeputyResultBar[] {
  const parties = [...new Set([...data.results.map(row => row.party), ...data.candidates.map(row => row.party)])];
  const bars: DeputyResultBar[] = [];
  for (const party of parties) {
    const candidates = data.candidates.filter(row => row.party === party);
    const source = data.results.find(row => row.party === party);
    if (candidates.length > 1) {
      // Multiple known nominations cannot share a party aggregate as personal votes.
      for (const candidate of candidates) bars.push({ key: candidate.id, label: candidate.name || party, party,
        share: candidate.share, votes: candidate.votes, own: candidate.is_own,
        preliminary: candidate.preliminary, data_release: candidate.data_release, notes: candidate.notes, conflict: false });
      continue;
    }
    const candidate = candidates[0];
    const hasPersonalResult = !!candidate && (candidate.share !== null || candidate.votes !== null);
    // Do not combine a personal share with an incompatible source's vote count.
    const result = hasPersonalResult ? candidate : source;
    const conflict = !!candidate && !!source && (
      (candidate.share !== null && source.share !== null && Math.abs(candidate.share-source.share)>0.00001)
      || (candidate.votes !== null && source.votes !== null && candidate.votes!==source.votes));
    bars.push({ key: party, label: candidate?.name || party, party, share: result?.share ?? null,
      votes: result?.votes ?? null, own: candidate?.is_own === true,
      preliminary: result?.preliminary ?? null, data_release: result?.data_release ?? null,
      notes: result?.notes ?? candidate?.notes ?? null, conflict });
  }
  bars.sort((a,b) => Number(b.own)-Number(a.own) || (b.share ?? -1)-(a.share ?? -1) || a.label.localeCompare(b.label,'de'));
  // Only a coherent absolute denominator can establish a real residual. A mere
  // selection of parties or rounded percentages does not establish completeness.
  const total = data.turnout;
  if (bars.length && total?.valid_votes && total.data_release && bars.every(row =>
    !row.conflict && row.votes !== null && row.data_release === total.data_release && row.preliminary === total.preliminary)
    && !data.results.some(row => ['SONSTIGE','NPD (darunter)'].includes(row.party))
    && !parties.some(party => data.candidates.filter(row => row.party===party).length>1)) {
    const known = bars.reduce((sum,row) => sum+row.votes!,0);
    if (known<=total.valid_votes && known>=0) {
      const rest = total.valid_votes-known;
      bars.push({ key:'residual',label:'Sonstige',party:null,share:rest/total.valid_votes*100,votes:rest,own:false,
        preliminary:total.preliminary,data_release:total.data_release,notes:'Rechnerischer Rest der gültigen Stimmen; nicht einzeln ausgewiesene Kandidaturen.',conflict:false });
    }
  }
  return bars;
}
