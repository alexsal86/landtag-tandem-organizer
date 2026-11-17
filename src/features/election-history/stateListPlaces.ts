export type DeputyStateListPlace = {
  id: string; position: number; person_name: string; birth_year: number | null;
  district_number: number | null; district_name: string | null;
  candidacy_role: 'direct' | 'substitute' | 'list_only' | null; residence: string | null;
  party: string; source_url: string | null; period_id: string; period_number: number; period_name: string; election_year: number | null;
};
export const listCandidacyRoleLabels = { direct: 'Direktbewerbung', substitute: 'Ersatzbewerbung', list_only: 'Nur Landesliste' };
export function stateListDistrictLabel(row: Pick<DeputyStateListPlace, 'candidacy_role' | 'district_number' | 'district_name'>): string {
  if (row.candidacy_role === 'list_only') return 'Keine Wahlkreisbewerbung';
  const district = [row.district_number, row.district_name].filter(value => value !== null && value !== '').join(' · ');
  return `${row.candidacy_role ? listCandidacyRoleLabels[row.candidacy_role] : 'Wahlkreis'}${district ? ` · ${district}` : ''}`;
}
