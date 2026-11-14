import { describe, expect, it } from "vitest";
import {
  ballotForComparison,
  boundaryCompatibility,
  compareDistrict,
  firstSecondDifference,
  residualVotes,
  subtract,
  turnoutRate,
  uniqueTurnout,
  validateElectionData,
} from "./calculations";
import { signedColor } from "./mapModel";
import type { DistrictResult, StateResult, Turnout } from "../types";
import type { DistrictVersion } from "./types";
const result = (extra: Partial<DistrictResult> = {}): DistrictResult => ({
  year: 2021,
  ballot: "single",
  district_number: 1,
  district_name: "Beispiel",
  party: "CDU",
  votes: 200,
  share: 20,
  preliminary: false,
  notes: null,
  data_release: "final-2021",
  ...extra,
});
const version = (
  year: number,
  identity_key: string | null = "same",
): DistrictVersion => ({
  year,
  district_number: 1,
  district_name: "Beispiel",
  geography_id: "verified",
  identity_key,
  historical_district_id: null,
  history_link_verified: false,
  notes: null,
});
const total = (extra: Partial<Turnout> = {}): Turnout => ({
  year: 2021,
  ballot: "single",
  district_number: 1,
  district_name: "Beispiel",
  eligible: 2000,
  voters: 1250,
  valid_votes: 1000,
  turnout: 62.5,
  preliminary: false,
  notes: null,
  data_release: "final-2021",
  ...extra,
});
const state = (year: number, share: number): StateResult => ({
  year,
  ballot: year === 2026 ? "second" : "single",
  party: "CDU",
  votes: 1000,
  share,
  seats: null,
  valid_votes: 10000,
  notes: null,
  data_release: `final-${year}`,
});
describe("Wahlanalyse: gemeinsame fachliche Berechnungen", () => {
  it("berechnet Swing, absolute Differenz und Abweichung vom Landestrend", () => {
    const r = compareDistrict({
      before: result(),
      after: result({
        year: 2026,
        ballot: "second",
        votes: 350,
        share: 35,
        data_release: "final-2026",
      }),
      stateBefore: state(2021, 25),
      stateAfter: state(2026, 30),
      versionBefore: version(2021),
      versionAfter: version(2026),
    });
    expect(r.swing).toBe(15);
    expect(r.voteDelta).toBe(150);
    expect(r.stateSwing).toBe(5);
    expect(r.relativeSwing).toBe(10);
    expect(r.warnings.join(" ")).toContain("Wahlsystem");
  });
  it("sperrt geänderte und ungeprüfte Grenzen; nur ungeprüfte sind explizit übersteuerbar", () => {
    const input = {
      before: result(),
      after: result({ year: 2026 }),
      versionBefore: version(2021),
      versionAfter: version(2026, "changed"),
    };
    expect(
      compareDistrict({ ...input, allowUnknownBoundaries: true }).swing,
    ).toBeNull();
    expect(
      boundaryCompatibility(version(2021, null), version(2026)).status,
    ).toBe("unknown");
    expect(
      compareDistrict({ ...input, versionAfter: undefined }).swing,
    ).toBeNull();
    expect(
      compareDistrict({
        ...input,
        versionAfter: undefined,
        allowUnknownBoundaries: true,
      }).swing,
    ).toBe(0);
  });
  it("vergleicht keine unterschiedlichen Parteien oder Wahlkreisnummern", () => {
    expect(
      compareDistrict({
        before: result(),
        after: result({ party: "SPD" }),
        versionBefore: version(2021),
        versionAfter: version(2021),
      }).comparable,
    ).toBe(false);
  });
  it("mischt vorläufig/final nur ausdrücklich, ohne unbestätigten relativen Swing", () => {
    const input = {
      before: result(),
      after: result({ year: 2026, preliminary: true }),
      versionBefore: version(2021),
      versionAfter: version(2026),
    };
    expect(compareDistrict(input).swing).toBeNull();
    expect(compareDistrict({ ...input, allowMixedStatus: true }).swing).toBe(0);
    expect(
      compareDistrict({ ...input, allowMixedStatus: true }).relativeSwing,
    ).toBeNull();
  });
  it("belässt fehlende Daten unbekannt und echte Nullwerte messbar", () => {
    expect(subtract(null, 0)).toBeNull();
    expect(subtract(0, 0)).toBe(0);
    expect(residualVotes(100, [20, null])).toBeNull();
    expect(residualVotes(100, [20, 30])).toBe(50);
  });
  it("verwendet getrennte Nenner für Erst-/Zweitstimmen", () => {
    const first = result({
        year: 2026,
        ballot: "first",
        votes: 200,
        share: 20,
        data_release: "final-2026",
      }),
      second = result({
        year: 2026,
        ballot: "second",
        votes: 200,
        share: 25,
        data_release: "final-2026",
      });
    expect(firstSecondDifference(first, second)).toEqual({
      compatible: true,
      pp: -5,
      votes: 0,
    });
    expect(
      firstSecondDifference(first, { ...second, preliminary: true }).pp,
    ).toBeNull();
    expect(
      firstSecondDifference(first, { ...second, data_release: "another" })
        .compatible,
    ).toBe(false);
  });
  it("berechnet Beteiligung einmal je Wahlkreis statt je Stimmenart", () => {
    expect(turnoutRate(2000, 1250)).toBe(62.5);
    expect(turnoutRate(0, 0)).toBeNull();
    expect(turnoutRate(10, 11)).toBeNull();
    expect(
      uniqueTurnout([
        total({ ballot: "first" }),
        total({ ballot: "second", valid_votes: 990 }),
      ]),
    ).toHaveLength(1);
  });
  it("meldet Stimmen-, Anteils-, Beteiligungs- und Statuskonflikte nachvollziehbar", () => {
    const codes = validateElectionData(
      [result({ votes: 1200, share: 1, preliminary: true })],
      [total({ turnout: 50 })],
    ).map((i) => i.code);
    expect(codes).toContain("party-votes-exceed-valid");
    expect(codes).toContain("share-mismatch");
    expect(codes).toContain("turnout-mismatch");
    expect(codes).toContain("mixed-denominator-status");
  });
  it("erkennt AfD vor Parteigründung, aber akzeptiert fehlende Daten", () => {
    expect(
      validateElectionData(
        [result({ year: 2011, party: "AfD", votes: 0, share: 0 })],
        [total({ year: 2011 })],
      ).some((i) => i.code === "afd-before-foundation"),
    ).toBe(true);
    expect(
      validateElectionData(
        [result({ year: 2011, party: "AfD", votes: null, share: null })],
        [total({ year: 2011 })],
      ).some((i) => i.code === "afd-before-foundation"),
    ).toBe(false);
  });
  it("erkennt doppelte Schlüssel und abweichende gemeinsame Wählerzahlen", () => {
    const codes = validateElectionData(
      [result(), result()],
      [
        total({ ballot: "first" }),
        total({ ballot: "second", voters: 1200, turnout: 60 }),
      ],
    ).map((i) => i.code);
    expect(codes).toContain("duplicate-result");
    expect(codes).toContain("ballot-turnout-conflict");
  });
  it("gleicht 70 eindeutige Wahlkreise nur bei gemeinsamem finalen Stand ab", () => {
    const rows = Array.from({ length: 70 }, (_, i) =>
      result({ district_number: i + 1 }),
    );
    expect(
      validateElectionData(
        rows,
        [],
        [{ ...state(2021, 20), votes: 14001 }],
      ).some((i) => i.code === "state-sum-mismatch"),
    ).toBe(true);
    expect(
      validateElectionData(
        rows.map((r) => ({ ...r, preliminary: true })),
        [],
        [state(2021, 20)],
      ).some((i) => i.code === "state-district-status"),
    ).toBe(true);
  });
  it("unterscheidet Null, Verlust und Gewinn in der Karte und wahrt Stimmenarten", () => {
    expect(signedColor(null, 10)).not.toBe(signedColor(0, 10));
    expect(signedColor(-10, 10)).not.toBe(signedColor(10, 10));
    expect(ballotForComparison(2021, "second")).toBe("single");
    expect(ballotForComparison(2026, "single")).toBe("second");
  });
});
