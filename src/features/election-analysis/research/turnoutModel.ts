import type { DistrictResult, Turnout } from "../types";
import type { DistrictSeries } from "./types";
import { ballotForComparison, compareDistrict, subtract } from "./calculations";
import type { Ballot } from "../types";

export interface TurnoutChange {
  districtNumber: number;
  districtName: string;
  party: string;
  before: Turnout | undefined;
  after: Turnout | undefined;
  resultBefore: DistrictResult | undefined;
  resultAfter: DistrictResult | undefined;
  eligibleDelta: number | null;
  votersDelta: number | null;
  validDelta: number | null;
  turnoutDelta: number | null;
  votesDelta: number | null;
  shareDelta: number | null;
  comparable: boolean;
  warnings: string[];
}
export interface TurnoutSelection {
  beforeYear: number;
  afterYear: number;
  ballot: Ballot;
  party: string;
  allowUnknownBoundaries: boolean;
  allowMixedStatus: boolean;
}
/** Uses exactly one ballot denominator per year; never sums first and second votes. */
export function turnoutChanges(
  data: DistrictSeries,
  selection: TurnoutSelection,
): TurnoutChange[] {
  const { beforeYear, afterYear, party, ballot } = selection;
  const beforeBallot = ballotForComparison(beforeYear, ballot),
    afterBallot = ballotForComparison(afterYear, ballot);
  const resultIndex = new Map(
    data.results.map((r) => [
      `${r.year}:${r.ballot}:${r.district_number}:${r.party}`,
      r,
    ]),
  );
  const turnoutIndex = new Map(
    data.turnout.map((r) => [`${r.year}:${r.ballot}:${r.district_number}`, r]),
  );
  const versionIndex = new Map(
    data.versions.map((v) => [`${v.year}:${v.district_number}`, v]),
  );
  return Array.from({ length: 70 }, (_, i) => {
    const n = i + 1,
      resultBefore = resultIndex.get(
        `${beforeYear}:${beforeBallot}:${n}:${party}`,
      ),
      resultAfter = resultIndex.get(
        `${afterYear}:${afterBallot}:${n}:${party}`,
      );
    const before = turnoutIndex.get(`${beforeYear}:${beforeBallot}:${n}`),
      after = turnoutIndex.get(`${afterYear}:${afterBallot}:${n}`);
    const versionBefore = versionIndex.get(`${beforeYear}:${n}`),
      versionAfter = versionIndex.get(`${afterYear}:${n}`);
    const comparison = compareDistrict({
      before: resultBefore,
      after: resultAfter,
      versionBefore,
      versionAfter,
      allowUnknownBoundaries: selection.allowUnknownBoundaries,
      allowMixedStatus: selection.allowMixedStatus,
    });
    const warnings = [...comparison.warnings];
    const pairMatches = (
      t: Turnout | undefined,
      r: DistrictResult | undefined,
    ) =>
      !!t &&
      !!r &&
      t.preliminary === r.preliminary &&
      !!t.data_release &&
      t.data_release === r.data_release;
    const sameDenominators =
      pairMatches(before, resultBefore) && pairMatches(after, resultAfter);
    if (!before || !after)
      warnings.push("Beteiligungsdaten fehlen für mindestens eine Wahl.");
    else if (!sameDenominators)
      warnings.push(
        "Beteiligung und Parteiergebnis haben keinen gemeinsam bestätigten Datenstand.",
      );
    const comparable = comparison.comparable && sameDenominators;
    return {
      districtNumber: n,
      districtName:
        after?.district_name ||
        before?.district_name ||
        versionAfter?.district_name ||
        versionBefore?.district_name ||
        `Wahlkreis ${n}`,
      party,
      before,
      after,
      resultBefore,
      resultAfter,
      eligibleDelta: comparable
        ? subtract(after?.eligible, before?.eligible)
        : null,
      votersDelta: comparable ? subtract(after?.voters, before?.voters) : null,
      validDelta: comparable
        ? subtract(after?.valid_votes, before?.valid_votes)
        : null,
      turnoutDelta: comparable
        ? subtract(after?.turnout, before?.turnout)
        : null,
      votesDelta: comparable ? comparison.voteDelta : null,
      shareDelta: comparable ? comparison.swing : null,
      comparable,
      warnings,
    };
  });
}
export interface Correlation {
  value: number | null;
  pairs: number;
  excluded: number;
  reason: string | null;
}
/** Descriptive Pearson r over complete district pairs, never an individual voter effect. */
export function turnoutCorrelation(
  rows: Pick<TurnoutChange, "turnoutDelta" | "shareDelta">[],
): Correlation {
  const pairs = rows.filter(
    (r): r is { turnoutDelta: number; shareDelta: number } =>
      r.turnoutDelta != null &&
      r.shareDelta != null &&
      Number.isFinite(r.turnoutDelta) &&
      Number.isFinite(r.shareDelta),
  );
  const base = { pairs: pairs.length, excluded: rows.length - pairs.length };
  if (pairs.length < 3)
    return {
      ...base,
      value: null,
      reason: "Mindestens drei vollständige Wahlkreispaare erforderlich.",
    };
  const meanX =
      pairs.reduce((sum, r) => sum + r.turnoutDelta, 0) / pairs.length,
    meanY = pairs.reduce((sum, r) => sum + r.shareDelta, 0) / pairs.length;
  let cross = 0,
    xx = 0,
    yy = 0;
  for (const p of pairs) {
    const x = p.turnoutDelta - meanX,
      y = p.shareDelta - meanY;
    cross += x * y;
    xx += x * x;
    yy += y * y;
  }
  if (xx === 0 || yy === 0)
    return {
      ...base,
      value: null,
      reason: "Ohne Streuung einer Kennzahl ist keine Korrelation definiert.",
    };
  return {
    ...base,
    value: Math.max(-1, Math.min(1, cross / Math.sqrt(xx * yy))),
    reason: null,
  };
}

export interface VoteFactors {
  eligible: number;
  participation: number;
  validity: number;
  partyShare: number;
}
export interface VoteContributions {
  eligible: number;
  participation: number;
  validity: number;
  partyShare: number;
  total: number;
}
/** Prepared for a later, reviewed UI: symmetric Shapley decomposition over all 24 factor orders. */
export function voteFactors(
  turnout: Turnout,
  result: DistrictResult,
): VoteFactors | null {
  if (
    turnout.year !== result.year ||
    turnout.ballot !== result.ballot ||
    turnout.district_number !== result.district_number ||
    turnout.preliminary !== result.preliminary ||
    !turnout.data_release ||
    turnout.data_release !== result.data_release
  )
    return null;
  const { eligible, voters, valid_votes } = turnout;
  const votes = result.votes;
  if (
    eligible == null ||
    voters == null ||
    valid_votes == null ||
    votes == null ||
    ![eligible, voters, valid_votes, votes].every(Number.isSafeInteger) ||
    eligible <= 0 ||
    voters <= 0 ||
    valid_votes <= 0 ||
    votes < 0 ||
    votes > valid_votes ||
    valid_votes > voters ||
    voters > eligible
  )
    return null;
  return {
    eligible,
    participation: voters / eligible,
    validity: valid_votes / voters,
    partyShare: votes / valid_votes,
  };
}
export function decomposeVotes(
  before: VoteFactors | null,
  after: VoteFactors | null,
): VoteContributions | null {
  if (!before || !after) return null;
  const keys = ["eligible", "participation", "validity", "partyShare"] as const;
  for (const row of [before, after])
    if (
      keys.some(
        (k) =>
          !Number.isFinite(row[k]) ||
          row[k] < 0 ||
          (k !== "eligible" && row[k] > 1),
      ) ||
      row.eligible <= 0
    )
      return null;
  const product = (row: VoteFactors) => keys.reduce((p, k) => p * row[k], 1);
  const contributions: VoteContributions = {
    eligible: 0,
    participation: 0,
    validity: 0,
    partyShare: 0,
    total: product(after) - product(before),
  };
  function visit(
    remaining: (typeof keys)[number][],
    current: VoteFactors,
    path: Partial<VoteFactors>,
  ) {
    if (!remaining.length) {
      for (const key of keys) contributions[key] += (path[key] ?? 0) / 24;
      return;
    }
    for (const key of remaining) {
      const next = { ...current, [key]: after![key] };
      visit(
        remaining.filter((k) => k !== key),
        next,
        { ...path, [key]: product(next) - product(current) },
      );
    }
  }
  visit([...keys], { ...before }, {});
  return contributions;
}
