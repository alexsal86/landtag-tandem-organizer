export interface LinkedCandidateResult {
  candidacy_id: string; person_id: string; person_name: string | null; party: string;
  votes: number | null; vote_share: number | null; ballot_type: 'candidate' | 'first_vote';
  outcome: 'direct' | 'list' | 'not_elected' | 'unknown';
  mandate_entry_type: 'election' | 'succession' | null;
  next_mandate_period: number | null;
  result_notes: string | null;
  source_url: string | null;
  link_status: 'linked' | 'ambiguous' | 'missing' | 'ballot_mismatch';
  district_result: { ballot: 'single' | 'first'; votes: number | null; share: number | null;
    preliminary: boolean; data_release: string | null; notes: string | null } | null;
}

export function candidateMandateLabel(row: Pick<LinkedCandidateResult, 'mandate_entry_type' | 'next_mandate_period'>): string | null {
  if (row.mandate_entry_type === 'succession') return 'In dieser Wahlperiode nachgerückt';
  if (row.mandate_entry_type === 'election') return 'Mandat in dieser Wahlperiode';
  if (row.next_mandate_period !== null) return `Mandat ab der ${row.next_mandate_period}. Wahlperiode erfasst`;
  return null;
}

export function candidateOutcomeLabel(row: Pick<LinkedCandidateResult, 'outcome' | 'ballot_type'>): string {
  if (row.outcome === 'direct') return 'Direkt gewählt';
  if (row.outcome === 'list') return row.ballot_type === 'first_vote' ? 'Über Landesliste gewählt' : 'Zweitmandat';
  if (row.outcome === 'not_elected') return 'Bei dieser Wahlbewerbung ohne Mandat';
  return 'Wahlausgang offen';
}

/** Keep reported personal numbers independent from the linked district source. */
export function candidateResultConflict(row: LinkedCandidateResult): boolean {
  const result = row.district_result;
  if (row.link_status !== 'linked' || !result) return false;
  return (row.votes !== null && result.votes !== null && row.votes !== result.votes)
    || (row.vote_share !== null && result.share !== null && Math.abs(row.vote_share - result.share) > 0.00001);
}

/** Provenance is per field: manually supplied numbers never become auto-owned. */
export function candidacyResultOrigin(row: Pick<import('./types').ElectionCandidacy,
  'votes' | 'vote_share' | 'result_origin' | 'result_snapshot'>): 'automatic' | 'mixed' | 'manual' | 'missing' {
  if (row.votes === null && row.vote_share === null) return 'missing';
  if (row.result_origin !== 'district_result' || !row.result_snapshot) return 'manual';
  const manualVotes = row.votes !== null && row.votes !== row.result_snapshot.votes;
  const manualShare = row.vote_share !== null && row.vote_share !== row.result_snapshot.share;
  return manualVotes || manualShare ? 'mixed' : 'automatic';
}
