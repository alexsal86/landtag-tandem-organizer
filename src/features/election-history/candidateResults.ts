export interface LinkedCandidateResult {
  candidacy_id: string; person_id: string; person_name: string | null; party: string;
  votes: number | null; vote_share: number | null; ballot_type: 'candidate' | 'first_vote';
  link_status: 'linked' | 'ambiguous' | 'missing' | 'ballot_mismatch';
  district_result: { ballot: 'single' | 'first'; votes: number | null; share: number | null;
    preliminary: boolean; data_release: string | null; notes: string | null } | null;
}

/** Keep reported personal numbers independent from the linked district source. */
export function candidateResultConflict(row: LinkedCandidateResult): boolean {
  const result = row.district_result;
  if (row.link_status !== 'linked' || !result) return false;
  return (row.votes !== null && result.votes !== null && row.votes !== result.votes)
    || (row.vote_share !== null && result.share !== null && Math.abs(row.vote_share - result.share) > 0.00001);
}
