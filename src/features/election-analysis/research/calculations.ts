import type { DistrictResult, StateResult, Turnout, Ballot } from "../types";
import type {
  ComparisonValue,
  DistrictVersion,
  ValidationIssue,
} from "./types";

export const subtract = (
  after: number | null | undefined,
  before: number | null | undefined,
): number | null => (after == null || before == null ? null : after - before);
export function turnoutRate(
  eligible: number | null,
  voters: number | null,
): number | null {
  return eligible == null ||
    voters == null ||
    eligible <= 0 ||
    voters < 0 ||
    voters > eligible
    ? null
    : (voters / eligible) * 100;
}
export function residualVotes(
  valid: number | null,
  selected: (number | null)[],
): number | null {
  if (
    valid == null ||
    valid < 0 ||
    selected.some((n) => n == null || n < 0 || !Number.isFinite(n))
  )
    return null;
  const sum = selected.reduce<number>((a, b) => a + (b ?? 0), 0);
  return sum > valid ? null : valid - sum;
}
export function boundaryCompatibility(
  before: DistrictVersion | undefined,
  after: DistrictVersion | undefined,
): { status: "same" | "changed" | "unknown"; warning: string | null } {
  if (
    before &&
    after &&
    before.year === after.year &&
    before.district_number === after.district_number
  )
    return { status: "same", warning: null };
  if (!before?.identity_key || !after?.identity_key)
    return {
      status: "unknown",
      warning:
        "Wahlkreiszuschnitte sind für diesen Vergleich nicht verifiziert.",
    };
  return before.identity_key === after.identity_key
    ? { status: "same", warning: null }
    : {
        status: "changed",
        warning: "Abweichende Wahlkreiszuschnitte: kein direkter Vergleich.",
      };
}
export function compareDistrict(input: {
  before?: DistrictResult;
  after?: DistrictResult;
  stateBefore?: StateResult;
  stateAfter?: StateResult;
  versionBefore?: DistrictVersion;
  versionAfter?: DistrictVersion;
  allowUnknownBoundaries?: boolean;
  allowMixedStatus?: boolean;
}): ComparisonValue {
  const { before, after, stateBefore, stateAfter } = input;
  const warnings: string[] = [];
  const boundary = boundaryCompatibility(
    input.versionBefore,
    input.versionAfter,
  );
  if (boundary.warning) warnings.push(boundary.warning);
  if (
    before?.notes?.includes("2011") &&
    before.year === 2006 &&
    before.district_number === 59
  )
    warnings.push(
      "Waldshut 2006: rekonstruierter Vergleichswert auf Zuschnitt 2011.",
    );
  if (before && after && before.ballot !== after.ballot)
    warnings.push(
      "Unterschiedliches Wahlsystem: Einzelstimme und Erst-/Zweitstimme.",
    );
  const mixed = !!before && !!after && before.preliminary !== after.preliminary;
  if (mixed)
    warnings.push("Vorläufiges und endgültiges Ergebnis werden verglichen.");
  if (before?.preliminary || after?.preliminary)
    warnings.push("Mindestens ein Wahlkreisergebnis ist vorläufig.");
  const sameSeries =
    !!before &&
    !!after &&
    before.party === after.party &&
    before.district_number === after.district_number;
  if (before && after && !sameSeries)
    warnings.push("Wahlkreis oder Partei passen nicht zusammen.");
  const comparable =
    sameSeries &&
    boundary.status !== "changed" &&
    (boundary.status === "same" || input.allowUnknownBoundaries === true) &&
    (!mixed || input.allowMixedStatus === true);
  const swing = comparable ? subtract(after?.share, before?.share) : null;
  const voteDelta = comparable ? subtract(after?.votes, before?.votes) : null;
  const stateSwing = subtract(stateAfter?.share, stateBefore?.share);
  const coherent =
    !!before &&
    !!after &&
    !before.preliminary &&
    !after.preliminary &&
    !!before.data_release &&
    before.data_release === stateBefore?.data_release &&
    !!after.data_release &&
    after.data_release === stateAfter?.data_release &&
    stateBefore?.year === before.year &&
    stateAfter?.year === after.year &&
    stateBefore?.party === before.party &&
    stateAfter?.party === after.party &&
    stateBefore?.ballot === before.ballot &&
    stateAfter?.ballot === after.ballot;
  if (!coherent && stateBefore && stateAfter)
    warnings.push(
      "Landes- und Wahlkreisstände nicht gemeinsam bestätigt; relativer Swing bleibt unbekannt.",
    );
  if (!before || !after)
    warnings.push("Wahlergebnis fehlt für mindestens eines der Jahre.");
  return {
    districtNumber: after?.district_number ?? before?.district_number ?? 0,
    districtName: after?.district_name ?? before?.district_name ?? "",
    party: after?.party ?? before?.party ?? "",
    before,
    after,
    swing,
    voteDelta,
    stateSwing,
    relativeSwing: comparable && coherent ? subtract(swing, stateSwing) : null,
    comparable,
    warnings,
  };
}
export function firstSecondDifference(
  first: DistrictResult | undefined,
  second: DistrictResult | undefined,
) {
  const compatible =
    !!first &&
    !!second &&
    first.year === second.year &&
    first.district_number === second.district_number &&
    first.party === second.party &&
    first.ballot === "first" &&
    second.ballot === "second" &&
    first.preliminary === second.preliminary &&
    !!first.data_release &&
    first.data_release === second.data_release;
  return {
    compatible,
    pp: compatible ? subtract(first.share, second.share) : null,
    votes: compatible ? subtract(first.votes, second.votes) : null,
  };
}

/** One turnout record per election and district, not one per ballot type. */
export function uniqueTurnout(rows: Turnout[]): Turnout[] {
  const unique = new Map<string, Turnout>();
  for (const row of rows) {
    const key = `${row.year}:${row.district_number}`;
    const previous = unique.get(key);
    if (!previous || row.ballot === "second") unique.set(key, row);
  }
  return [...unique.values()];
}
export function validateElectionData(
  results: DistrictResult[],
  turnout: Turnout[],
  state: StateResult[] = [],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [label, rows] of [
    ["result", results],
    ["turnout", turnout],
  ] as const) {
    const seen = new Set<string>();
    for (const r of rows) {
      const key = `${r.year}:${r.ballot}:${r.district_number}:${"party" in r ? r.party : ""}`;
      if (seen.has(key))
        issues.push({
          year: r.year,
          district: r.district_number,
          ballot: r.ballot,
          code: "duplicate-" + label,
          severity: "error",
          message: "Doppelter natürlicher Datenschlüssel.",
        });
      seen.add(key);
    }
  }
  const totals = new Map(
    turnout.map((r) => [`${r.year}:${r.ballot}:${r.district_number}`, r]),
  );
  for (const r of results) {
    const base = {
      year: r.year,
      district: r.district_number,
      party: r.party,
      ballot: r.ballot,
    };
    const denominator = totals.get(
      `${r.year}:${r.ballot}:${r.district_number}`,
    );
    if (!denominator || denominator.valid_votes == null)
      issues.push({
        ...base,
        code: "missing-denominator",
        severity: "warning",
        message:
          "Gültige Stimmen fehlen; der Parteianteil ist nicht nachprüfbar.",
      });
    if ((r.votes == null) !== (r.share == null))
      issues.push({
        ...base,
        code: "incomplete-result",
        severity: "warning",
        message:
          "Stimmen oder Anteil fehlen; der Wert wird nicht als null Stimmen ersetzt.",
      });
    if (
      (r.votes != null && (!Number.isSafeInteger(r.votes) || r.votes < 0)) ||
      (r.share != null &&
        (!Number.isFinite(r.share) || r.share < 0 || r.share > 100))
    )
      issues.push({
        ...base,
        code: "invalid-result",
        severity: "error",
        message: "Ungültige Stimmenzahl oder ungültiger Anteil.",
      });
    if (
      r.party.toUpperCase() === "AFD" &&
      r.year < 2013 &&
      (r.votes !== null || r.share !== null)
    )
      issues.push({
        ...base,
        code: "afd-before-foundation",
        severity: "error",
        message:
          "AfD vor 2013: fehlender Wert darf kein gemessenes Nullergebnis sein.",
      });
    if (
      r.votes != null &&
      denominator?.valid_votes != null &&
      r.votes > denominator.valid_votes
    )
      issues.push({
        ...base,
        code: "party-votes-exceed-valid",
        severity: "error",
        message: "Parteistimmen überschreiten gültige Stimmen.",
      });
    if (
      r.share != null &&
      r.votes != null &&
      denominator?.valid_votes &&
      Math.abs(r.share - (r.votes / denominator.valid_votes) * 100) > 0.051
    )
      issues.push({
        ...base,
        code: "share-mismatch",
        severity: "error",
        message:
          "Stimmenanteil passt nicht zu absoluten und gültigen Stimmen (Toleranz 0,051 PP).",
      });
    if (
      denominator &&
      (r.preliminary !== denominator.preliminary ||
        (r.data_release &&
          denominator.data_release &&
          r.data_release !== denominator.data_release))
    )
      issues.push({
        ...base,
        code: "mixed-denominator-status",
        severity: "error",
        message:
          "Parteiergebnis und Nenner haben unterschiedliche Datenstände.",
      });
  }
  const groups = new Map<string, Turnout[]>();
  for (const r of turnout) {
    const base = {
      year: r.year,
      district: r.district_number,
      ballot: r.ballot,
    };
    const calculated = turnoutRate(r.eligible, r.voters);
    if (
      [r.eligible, r.voters, r.valid_votes].some(
        (n) => n != null && (!Number.isSafeInteger(n) || n < 0),
      )
    )
      issues.push({
        ...base,
        code: "invalid-denominator",
        severity: "error",
        message:
          "Wahlberechtigte, Wählende und gültige Stimmen müssen nichtnegative ganze Zahlen sein.",
      });
    if (
      r.turnout != null &&
      (!Number.isFinite(r.turnout) || r.turnout < 0 || r.turnout > 100)
    )
      issues.push({
        ...base,
        code: "invalid-turnout",
        severity: "error",
        message: "Beteiligung liegt nicht zwischen 0 und 100 Prozent.",
      });
    if (
      r.turnout != null &&
      calculated != null &&
      Math.abs(r.turnout - calculated) > 0.051
    )
      issues.push({
        ...base,
        code: "turnout-mismatch",
        severity: "error",
        message: "Beteiligung passt nicht zu Wahlberechtigten und Wählenden.",
      });
    if (r.voters != null && r.eligible != null && r.voters > r.eligible)
      issues.push({
        ...base,
        code: "voters-exceed-eligible",
        severity: "error",
        message: "Mehr Wählende als Wahlberechtigte.",
      });
    if (r.valid_votes != null && r.voters != null && r.valid_votes > r.voters)
      issues.push({
        ...base,
        code: "valid-exceed-voters",
        severity: "error",
        message: "Gültige Stimmen übersteigen die Wählendenzahl.",
      });
    const key = `${r.year}:${r.district_number}`;
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  for (const group of groups.values())
    if (
      group.some(
        (r) => r.eligible !== group[0].eligible || r.voters !== group[0].voters,
      )
    )
      issues.push({
        year: group[0].year,
        district: group[0].district_number,
        code: "ballot-turnout-conflict",
        severity: "error",
        message:
          "Erst-/Zweitstimmen unterscheiden sich bei Wahlberechtigten oder Wählenden.",
      });
  for (const s of state) {
    const base = { year: s.year, party: s.party, ballot: s.ballot };
    if (s.votes != null && s.valid_votes != null && s.votes > s.valid_votes)
      issues.push({
        ...base,
        code: "state-votes-exceed-valid",
        severity: "error",
        message: "Landesparteistimmen überschreiten gültige Stimmen.",
      });
    if (
      s.share != null &&
      s.votes != null &&
      s.valid_votes &&
      Math.abs(s.share - (s.votes / s.valid_votes) * 100) > 0.051
    )
      issues.push({
        ...base,
        code: "state-share-mismatch",
        severity: "error",
        message: "Landesanteil passt nicht zu absoluten und gültigen Stimmen.",
      });
    const denominators = turnout.filter(
      (r) => r.year === s.year && r.ballot === s.ballot,
    );
    if (
      denominators.length === 70 &&
      new Set(denominators.map((r) => r.district_number)).size === 70 &&
      denominators.every(
        (r) =>
          r.valid_votes != null &&
          !r.preliminary &&
          !!s.data_release &&
          s.data_release === r.data_release,
      ) &&
      s.valid_votes != null &&
      denominators.reduce((sum, r) => sum + (r.valid_votes ?? 0), 0) !==
        s.valid_votes
    )
      issues.push({
        ...base,
        code: "state-valid-sum-mismatch",
        severity: "error",
        message:
          "Gültige Stimmen der 70 Wahlkreise weichen vom Landesnenner ab.",
      });
    const matching = results.filter(
      (r) => r.year === s.year && r.ballot === s.ballot && r.party === s.party,
    );
    if (
      new Set(matching.map((r) => r.district_number)).size !== 70 ||
      matching.length !== 70 ||
      matching.some((r) => r.votes == null) ||
      s.votes == null
    )
      continue;
    const comparable = matching.every(
      (r) =>
        !r.preliminary && !!s.data_release && s.data_release === r.data_release,
    );
    if (!comparable)
      issues.push({
        year: s.year,
        party: s.party,
        ballot: s.ballot,
        code: "state-district-status",
        severity: "warning",
        message:
          "Landes-/Wahlkreissumme wegen unterschiedlicher Stände nicht gleichgesetzt.",
      });
    else if (matching.reduce((sum, r) => sum + (r.votes ?? 0), 0) !== s.votes)
      issues.push({
        year: s.year,
        party: s.party,
        ballot: s.ballot,
        code: "state-sum-mismatch",
        severity: "error",
        message: "Summe der 70 Wahlkreise weicht vom Landeswert ab.",
      });
  }
  return issues;
}
export function ballotForComparison(year: number, ballot: Ballot): Ballot {
  return year < 2026 ? "single" : ballot === "single" ? "second" : ballot;
}
