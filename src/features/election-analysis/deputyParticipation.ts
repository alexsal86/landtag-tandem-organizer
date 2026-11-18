import type { ElectionCandidacy } from '@/features/election-history/types';

export type DeputyCandidacy = Pick<ElectionCandidacy, 'id' | 'person_id' | 'period_id' | 'party' | 'outcome' | 'ballot_type' | 'votes' | 'vote_share' | 'list_position' | 'source_url' | 'notes' | 'result_preliminary' | 'result_notes'> & {
  period_number: number; election_year: number | null;
  district_name: string | null; district_label: string | null;
};

/** An election entry never creates tenure or turns an unknown result into a defeat. */
export function candidacyPeriodLabel(candidates: readonly Pick<ElectionCandidacy, 'outcome'>[]): string {
  if (!candidates.length) return 'Keine Mitgliedschaft';
  if (candidates.every(candidate => candidate.outcome === 'not_elected')) return 'Kandidiert · nicht gewählt';
  if (candidates.every(candidate => candidate.outcome === 'unknown')) return 'Kandidiert · Wahlausgang offen';
  return 'Kandidatur · kein Mandat in dieser Periode erfasst';
}
