import { projectShares } from "../lab/scenarios";
import type { ElectionFile, SeatParty } from "./types";

export const DISTRICT_MODEL_VERSION = "bw-district-model-v1";

export function readDistrictModel(value: unknown) {
  return value === "swing" || value === "logratio" ? value : "manual";
}

export type DistrictModel = ReturnType<typeof readDistrictModel>;

/** Numerical share-to-count rounding, not an electoral lot decision. Sum of valid ballots remains fixed. */
export function roundDistrictVotes(weights: number[], total: number) {
  const raw = weights.map((w) => (w / 100) * total),
    out = raw.map(Math.floor);
  const remainder = total - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  if (remainder < 0 || remainder > weights.length)
    throw new Error("Anteile lassen sich nicht stabil in Stimmen umrechnen.");
  for (let i = 0; i < remainder; i++) out[order[i].i]++;
  return out;
}

export function projectDistrictVotes(
  file: ElectionFile,
  parties: SeatParty[],
  changes: Record<string, number>,
  model: Exclude<DistrictModel, "manual">,
) {
  if (!Object.values(changes).some(Boolean)) return file.districts;
  const stateVotes = new Map(
    file.parties.map((party) => [party.id, party.votes]),
  );
  const adjustedVotes = new Map(
    parties.map((party) => [party.id, party.votes]),
  );

  return file.districts.map((district) => {
    const candidates = district.candidates.filter(
      (candidate) => candidate.partyId !== null,
    );
    const available = candidates.reduce(
      (sum, candidate) => sum + candidate.votes,
      0,
    );
    if (available === 0) return district;
    const hasLocalChange = candidates.some(
      ({ partyId }) =>
        changes[partyId!] !== undefined && changes[partyId!] !== 0,
    );
    if (!hasLocalChange) return district;

    let percentages: number[];
    if (model === "swing") {
      // The swing is measured against all valid first votes. Project only the
      // party ballots, leaving the independent candidates' votes reserved.
      percentages = projectShares(
        candidates.map(
          ({ partyId, votes }) =>
            ((votes + ((changes[partyId!] || 0) / 100) * district.validFirst) /
              available) *
            100,
        ),
      );
    } else {
      const weights = candidates.map(({ partyId, votes }) => {
        const before = stateVotes.get(partyId!) ?? 0;
        const after = adjustedVotes.get(partyId!) ?? 0;
        return votes * (before === after ? 1 : (after + 0.5) / (before + 0.5));
      });
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      percentages = weights.map((weight) => (weight / total) * 100);
    }

    const votes = roundDistrictVotes(percentages, available);
    const byId = new Map(
      candidates.map((candidate, index) => [candidate.id, votes[index]]),
    );
    return {
      ...district,
      candidates: district.candidates.map((candidate) => ({
        ...candidate,
        votes: byId.get(candidate.id) ?? candidate.votes,
      })),
    };
  });
}
