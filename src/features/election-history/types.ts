export interface ElectionPeriod {
  id: string; number: number; name: string; election_date: string | null; starts_on: string | null; election_year: number | null; ends_on: string | null;
  is_current: boolean; is_published: boolean; source_url: string | null; notes: string | null;
}
export interface ElectionPerson {
  id: string; name: string; biography: string | null; source_url: string | null; history_complete: boolean;
}
export interface HistoricalDistrict {
  id: string; period_id: string; district_number: number | null; number_label: string | null; boundaries: import('@/types/geoDomain').GeoJsonGeometry | null; name: string; boundary_note: string | null; source_url: string | null;
}
export interface ElectionCandidacy {
  id: string; period_id: string; person_id: string; district_id: string | null; party: string;
  votes: number | null; vote_share: number | null; district_rank: number | null; list_position: number | null;
  ballot_type: 'candidate' | 'first_vote'; outcome: 'direct' | 'list' | 'not_elected' | 'unknown';
  source_url: string | null; notes: string | null;
}
export interface HistoricalMandate {
  id: string; period_id: string; person_id: string | null; person_name: string | null; original_mandate: string | null; party_label: string | null; left_early: boolean; district_id: string | null; candidacy_id: string | null;
  party: string; mandate_type: 'direct' | 'list'; entry_type: 'election' | 'succession';
  start_from_period: boolean; end_from_period: boolean; starts_on: string | null; ends_on: string | null; source_url: string | null; notes: string | null;
}
export interface ElectionAudit {
  id: string; table_name: string; record_id: string; action: string; actor_id: string | null; occurred_at: string;
  old_data: import('@/integrations/supabase/types').Json | null; new_data: import('@/integrations/supabase/types').Json | null;
}
type Entry<T> = { Row: { [K in keyof T]: T[K] }; Insert: Omit<T, 'id'> & { id?: string }; Update: Partial<Omit<T, 'id'>>; Relationships: [] };
export type ElectionHistoryTables = {
  election_history_periods: Entry<ElectionPeriod>;
  election_history_people: Entry<ElectionPerson>;
  election_history_districts: Entry<HistoricalDistrict>;
  election_history_candidacies: Entry<ElectionCandidacy>;
  election_history_mandates: Entry<HistoricalMandate>;
  election_history_audit: { Row: { [K in keyof ElectionAudit]: ElectionAudit[K] }; Insert: never; Update: never; Relationships: [] };
};
export interface ElectionHistoryData {
  periods: ElectionPeriod[]; people: ElectionPerson[]; districts: HistoricalDistrict[];
  candidacies: ElectionCandidacy[]; mandates: HistoricalMandate[];
}
