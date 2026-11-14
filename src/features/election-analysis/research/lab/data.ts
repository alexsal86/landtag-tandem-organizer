import type { Ballot } from "../../types";
import type { QualityData } from "../hooks";
import { parties } from "../../model";
export interface ResearchDistrict {
  notes?: string | null;
  number: number;
  name: string;
  shares: Record<string, number>;
  valid: number;
  eligible: number;
  voters: number;
  turnout: number;
  preliminary: boolean;
  release: string;
  identity: string | null;
}
export interface ResearchDataset {
  rows: ResearchDistrict[];
  excluded: { number: number; reason: string }[];
  parties: string[];
}
/** All shares are recomputed from the same ballot denominator; missing counts are never zero-filled. */
export function researchDataset(
  data: QualityData | undefined,
  year: number,
  ballot: Ballot,
  selectedParties?: string[],
): ResearchDataset {
  const selected = parties.filter(
      (p) =>
        (!selectedParties || selectedParties.includes(p)) &&
        (p !== "AfD" || year >= 2013),
    ),
    rows: ResearchDistrict[] = [],
    excluded: ResearchDataset["excluded"] = [];
  if (!data || !selected.length) return { rows, excluded, parties: selected };
  for (let n = 1; n <= 70; n++) {
    const turnout = data.turnout.filter(
      (t) => t.year === year && t.ballot === ballot && t.district_number === n,
    );
    const t = turnout[0];
    const values = selected.map((p) =>
      data.results.filter(
        (r) =>
          r.year === year &&
          r.ballot === ballot &&
          r.district_number === n &&
          r.party === p,
      ),
    );
    const fail = (reason: string) => excluded.push({ number: n, reason });
    if (turnout.length !== 1 || !t || values.some((r) => r.length !== 1)) {
      fail("Nenner oder Parteizeile fehlt/ist mehrdeutig.");
      continue;
    }
    const result = values.map((r) => r[0]);
    if (
      t.valid_votes == null ||
      t.voters == null ||
      t.eligible == null ||
      ![t.valid_votes, t.voters, t.eligible].every(Number.isSafeInteger) ||
      t.valid_votes <= 0 ||
      t.valid_votes > t.voters ||
      t.voters > t.eligible ||
      t.eligible <= 0
    ) {
      fail("Ungültige oder fehlende Bezugsgrößen.");
      continue;
    }
    if (
      !t.data_release ||
      result.some(
        (r) =>
          r.votes == null ||
          !Number.isSafeInteger(r.votes) ||
          r.votes < 0 ||
          r.data_release !== t.data_release ||
          r.preliminary !== t.preliminary,
      )
    ) {
      fail("Stimmen fehlen oder Datenstände passen nicht zusammen.");
      continue;
    }
    const shares = Object.fromEntries(
      result.map((r) => [r.party, (r.votes! / t.valid_votes!) * 100]),
    );
    const sum = Object.values(shares).reduce((a, b) => a + b, 0);
    if (sum > 100 + 1e-8) {
      fail("Parteistimmen überschreiten gültige Stimmen.");
      continue;
    }
    shares.REST = Math.max(0, 100 - sum);
    rows.push({
      notes:
        [
          ...new Set([t.notes, ...result.map((r) => r.notes)].filter(Boolean)),
        ].join(" · ") || null,
      number: n,
      name: t.district_name,
      shares,
      valid: t.valid_votes,
      eligible: t.eligible,
      voters: t.voters,
      turnout: (t.voters / t.eligible) * 100,
      preliminary: t.preliminary,
      release: t.data_release,
      identity:
        data.versions.find((v) => v.year === year && v.district_number === n)
          ?.identity_key || null,
    });
  }
  return { rows, excluded, parties: selected };
}
export function coherentDataset(rows: ResearchDistrict[]): boolean {
  return (
    rows.length === 70 &&
    new Set(rows.map((r) => r.number)).size === 70 &&
    new Set(rows.map((r) => `${r.release}:${r.preliminary}`)).size === 1
  );
}
export function weightedShares(
  rows: ResearchDistrict[],
  keys: string[],
): Record<string, number> | null {
  if (!coherentDataset(rows)) return null;
  const valid = rows.reduce((sum, r) => sum + r.valid, 0);
  return Object.fromEntries(
    keys.map((key) => [
      key,
      rows.reduce((sum, r) => sum + r.shares[key] * r.valid, 0) / valid,
    ]),
  );
}
