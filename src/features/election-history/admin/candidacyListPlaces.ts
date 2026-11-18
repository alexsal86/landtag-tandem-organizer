import type { ElectionCandidacy } from '../types';

export type CandidacyStateListPlace = {
  id: string; list_id: string; person_id: string; period_id: string;
  party: string; position: number; source_url: string | null;
};
/** Display confirmed roster evidence without rewriting personal results or inferring identity from names. */
export function candidacyListPlacement(candidate: Pick<ElectionCandidacy, 'person_id' | 'period_id' | 'party' | 'list_position'>, places: readonly CandidacyStateListPlace[]) {
  const matches = [...new Map(places.filter(place => place.person_id === candidate.person_id
    && place.period_id === candidate.period_id && place.party === candidate.party
    && Number.isSafeInteger(place.position) && place.position > 0).map(place => [place.id, place])).values()];
  const roster = matches.length === 1 ? matches[0] : null;
  return {
    position: candidate.list_position ?? roster?.position ?? null,
    roster,
    ambiguous: matches.length > 1,
    conflict: candidate.list_position != null && roster !== null && candidate.list_position !== roster.position,
  };
}
