export type StateList = { id: string; period_id: string; party: string; source_url: string | null; notes: string | null };
export type StateListEntry = { id: string; list_id: string; position: number; person_name: string; connection_id: string | null; link_mode: 'auto' | 'manual' | 'unlinked'; notes: string | null };
export type StateListPerson = { connection_id: string; name: string; parties: string[]; periods: number[]; exact_match: boolean };
/** A bounded suggestion page must never pick among multiple exact identities. The DB rechecks all matches on save. */
export function uniqueStateListMatch(matches: readonly StateListPerson[]): StateListPerson | null {
  const exact = [...new Map(matches.filter(match => match.exact_match).map(match => [match.connection_id, match])).values()];
  return exact.length === 1 ? exact[0] : null;
}
