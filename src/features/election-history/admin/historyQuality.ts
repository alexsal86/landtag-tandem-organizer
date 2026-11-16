import type { ElectionCandidacy, ElectionHistoryData, HistoricalDistrict, HistoricalMandate } from '../types';

export function mandateQualityIssues(mandate: HistoricalMandate): string[] {
  const issues: string[] = [];
  if (mandate.mandate_type === 'direct' && !mandate.district_id) issues.push('Direktmandat ohne Wahlkreis');
  if (mandate.entry_type === 'succession' && (!mandate.starts_on || mandate.start_from_period)) issues.push('Nachrücker ohne eigenes Eintrittsdatum');
  if (!mandate.person_id && !mandate.connection_id) issues.push('Personenverbindung offen');
  if (!mandate.source_url) issues.push('Quelle fehlt');
  return issues;
}

export function districtQualityIssues(district: HistoricalDistrict, mandates: HistoricalMandate[]): string[] {
  const issues: string[] = [];
  if (!mandates.some(mandate => mandate.district_id === district.id && mandate.mandate_type === 'direct')) issues.push('Kein Direktmandat zugeordnet');
  if (!district.source_url) issues.push('Quelle fehlt');
  return issues;
}

export function candidacyQualityIssues(candidacy: ElectionCandidacy): string[] {
  const issues: string[] = [];
  if (candidacy.votes === null && candidacy.vote_share === null) issues.push('Ergebnis fehlt');
  if (candidacy.outcome === 'unknown') issues.push('Wahlausgang offen');
  if (!candidacy.source_url) issues.push('Quelle fehlt');
  return issues;
}

export function rowSearchText(entity: keyof Pick<ElectionHistoryData, 'periods' | 'districts' | 'candidacies' | 'mandates'>, data: ElectionHistoryData, id: string): string {
  if (entity === 'periods') {
    const row = data.periods.find(period => period.id === id);
    return row ? `${row.number} ${row.name} ${row.election_year || ''}` : '';
  }
  if (entity === 'districts') {
    const row = data.districts.find(district => district.id === id);
    return row ? `${row.district_number || ''} ${row.number_label || ''} ${row.name}` : '';
  }
  if (entity === 'mandates') {
    const row = data.mandates.find(mandate => mandate.id === id);
    if (!row) return '';
    const person = data.people.find(candidate => candidate.id === row.person_id)?.name || row.person_name || '';
    const district = data.districts.find(candidate => candidate.id === row.district_id)?.name || '';
    return `${person} ${row.party} ${row.party_label || ''} ${district} ${row.mandate_type} ${row.entry_type}`;
  }
  const row = data.candidacies.find(candidacy => candidacy.id === id);
  if (!row) return '';
  const person = data.people.find(candidate => candidate.id === row.person_id)?.name || '';
  const district = data.districts.find(candidate => candidate.id === row.district_id)?.name || '';
  return `${person} ${row.party} ${district} ${row.outcome}`;
}
