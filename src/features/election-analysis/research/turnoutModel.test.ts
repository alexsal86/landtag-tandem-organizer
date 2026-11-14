import { describe, expect, it } from "vitest";
import {
  decomposeVotes,
  turnoutChanges,
  turnoutCorrelation,
  voteFactors,
} from "./turnoutModel";
import type { TurnoutSelection, VoteFactors } from "./turnoutModel";
import type { DistrictSeries, DistrictVersion } from "./types";
import type { DistrictResult, Turnout } from "../types";
const totals = (year: number, extra: Partial<Turnout> = {}): Turnout => ({
  year,
  ballot: year === 2026 ? "second" : "single",
  district_number: 1,
  district_name: "Beispiel",
  eligible: 1000,
  voters: 600,
  valid_votes: 500,
  turnout: 60,
  preliminary: false,
  data_release: `final-${year}`,
  notes: null,
  ...extra,
});
const result = (
  year: number,
  extra: Partial<DistrictResult> = {},
): DistrictResult => ({
  year,
  ballot: year === 2026 ? "second" : "single",
  district_number: 1,
  district_name: "Beispiel",
  party: "CDU",
  votes: 100,
  share: 20,
  preliminary: false,
  data_release: `final-${year}`,
  notes: null,
  ...extra,
});
const version = (
  year: number,
  identity_key: string | null = "same",
): DistrictVersion => ({
  year,
  district_number: 1,
  district_name: "Beispiel",
  geography_id: "official",
  identity_key,
  historical_district_id: null,
  history_link_verified: false,
  notes: null,
});
const selection: TurnoutSelection = {
  beforeYear: 2021,
  afterYear: 2026,
  ballot: "second",
  party: "CDU",
  allowUnknownBoundaries: false,
  allowMixedStatus: false,
};
const data = (): DistrictSeries => ({
  results: [result(2021), result(2026, { votes: 150, share: 25 })],
  turnout: [
    totals(2021),
    totals(2026, {
      eligible: 1100,
      voters: 770,
      valid_votes: 600,
      turnout: 70,
    }),
  ],
  versions: [version(2021), version(2026)],
  state: [],
});
describe("Beteiligung und Stimmenentwicklung", () => {
  it("berechnet sechs Änderungen in passenden Einheiten", () => {
    const r = turnoutChanges(data(), selection)[0];
    expect(r.comparable).toBe(true);
    expect(r.turnoutDelta).toBe(10);
    expect(r.eligibleDelta).toBe(100);
    expect(r.votersDelta).toBe(170);
    expect(r.validDelta).toBe(100);
    expect(r.votesDelta).toBe(50);
    expect(r.shareDelta).toBe(5);
  });
  it("zählt Erst- und Zweitstimmen nicht doppelt", () => {
    const input = data();
    input.turnout.push(
      totals(2026, {
        ballot: "first",
        valid_votes: 590,
        voters: 770,
        eligible: 1100,
        turnout: 70,
      }),
    );
    expect(turnoutChanges(input, selection)[0].validDelta).toBe(100);
  });
  it("sperrt unbekannte und veränderte Zuschnitte ohne Werte zu erfinden", () => {
    const input = data();
    input.versions[1] = version(2026, null);
    expect(turnoutChanges(input, selection)[0].turnoutDelta).toBeNull();
    expect(
      turnoutChanges(input, { ...selection, allowUnknownBoundaries: true })[0]
        .turnoutDelta,
    ).toBe(10);
    input.versions[1] = version(2026, "different");
    expect(
      turnoutChanges(input, { ...selection, allowUnknownBoundaries: true })[0]
        .turnoutDelta,
    ).toBeNull();
  });
  it("sperrt gemischte Stände auch innerhalb eines Wahljahres", () => {
    const input = data();
    input.turnout[1].data_release = "unmatched";
    expect(
      turnoutChanges(input, { ...selection, allowMixedStatus: true })[0]
        .comparable,
    ).toBe(false);
  });
  it("vergleicht vorläufig und endgültig nur ausdrücklich", () => {
    const input = data();
    input.turnout[1].preliminary = true;
    input.results[1].preliminary = true;
    expect(turnoutChanges(input, selection)[0].turnoutDelta).toBeNull();
    expect(
      turnoutChanges(input, { ...selection, allowMixedStatus: true })[0]
        .turnoutDelta,
    ).toBe(10);
  });
  it("erhält Nullwerte und lässt fehlende Einzelkennzahlen unbekannt", () => {
    const input = data();
    input.results[1].votes = 0;
    input.results[1].share = 0;
    input.turnout[1].eligible = null;
    const r = turnoutChanges(input, selection)[0];
    expect(r.votesDelta).toBe(-100);
    expect(r.shareDelta).toBe(-20);
    expect(r.eligibleDelta).toBeNull();
  });
  it("berechnet Pearson r nur über vollständige Paare und meldet Ausschlüsse", () => {
    expect(
      turnoutCorrelation([
        { turnoutDelta: 1, shareDelta: 2 },
        { turnoutDelta: 2, shareDelta: 4 },
        { turnoutDelta: 3, shareDelta: 6 },
        { turnoutDelta: null, shareDelta: 0 },
      ]),
    ).toMatchObject({ value: 1, pairs: 3, excluded: 1 });
    expect(
      turnoutCorrelation([
        { turnoutDelta: 1, shareDelta: 6 },
        { turnoutDelta: 2, shareDelta: 4 },
        { turnoutDelta: 3, shareDelta: 2 },
      ]).value,
    ).toBe(-1);
    expect(
      turnoutCorrelation([
        { turnoutDelta: 1, shareDelta: 2 },
        { turnoutDelta: 1, shareDelta: 3 },
        { turnoutDelta: 1, shareDelta: 4 },
      ]).value,
    ).toBeNull();
    expect(
      turnoutCorrelation([
        { turnoutDelta: 1, shareDelta: 2 },
        { turnoutDelta: 2, shareDelta: 3 },
      ]).value,
    ).toBeNull();
  });
});
describe("Vorbereitete symmetrische Stimmenzerlegung", () => {
  const before: VoteFactors = {
    eligible: 1000,
    participation: 0.6,
    validity: 0.95,
    partyShare: 0.2,
  };
  const after: VoteFactors = {
    eligible: 1100,
    participation: 0.7,
    validity: 0.97,
    partyShare: 0.3,
  };
  it("zerlegt die gesamte Differenz ohne Rest in vier symmetrische Beiträge", () => {
    const d = decomposeVotes(before, after)!;
    expect(d.total).toBeCloseTo(
      1100 * 0.7 * 0.97 * 0.3 - 1000 * 0.6 * 0.95 * 0.2,
      10,
    );
    expect(
      d.eligible + d.participation + d.validity + d.partyShare,
    ).toBeCloseTo(d.total, 10);
  });
  it("kehrt alle Vorzeichen beim Vertauschen der Wahlen um", () => {
    const forward = decomposeVotes(before, after)!,
      reverse = decomposeVotes(after, before)!;
    for (const key of [
      "eligible",
      "participation",
      "validity",
      "partyShare",
      "total",
    ] as const)
      expect(reverse[key]).toBeCloseTo(-forward[key], 10);
  });
  it("liefert bei identischen Wahlen nur Nullen", () => {
    expect(decomposeVotes(before, before)).toEqual({
      eligible: 0,
      participation: 0,
      validity: 0,
      partyShare: 0,
      total: 0,
    });
  });
  it("ordnet eine reine Ein-Faktor-Änderung vollständig diesem Faktor zu", () => {
    const d = decomposeVotes(before, { ...before, eligible: 1200 })!;
    expect(d.eligible).toBeCloseTo(d.total, 10);
    expect(d.participation).toBe(0);
    expect(d.validity).toBe(0);
    expect(d.partyShare).toBe(0);
  });
  it("ist symmetrisch gegenüber dem Umbenennen von Quotenfaktoren", () => {
    const d = decomposeVotes(before, after)!;
    const swap = (v: VoteFactors) => ({
      ...v,
      participation: v.partyShare,
      partyShare: v.participation,
    });
    const s = decomposeVotes(swap(before), swap(after))!;
    expect(s.participation).toBeCloseTo(d.partyShare, 10);
    expect(s.partyShare).toBeCloseTo(d.participation, 10);
    expect(s.total).toBeCloseTo(d.total, 10);
  });
  it("akzeptiert echte Null-Parteistimmen, aber keine undefinierten Nenner", () => {
    expect(
      voteFactors(totals(2021), result(2021, { votes: 0, share: 0 }))
        ?.partyShare,
    ).toBe(0);
    expect(
      voteFactors(
        totals(2021, { voters: 0, valid_votes: 0 }),
        result(2021, { votes: 0 }),
      ),
    ).toBeNull();
    expect(decomposeVotes(null, after)).toBeNull();
    expect(decomposeVotes(before, { ...after, participation: 1.1 })).toBeNull();
  });
  it("verwendet keine unterschiedlichen Datenstände oder Stimmenarten für die Faktoren", () => {
    expect(
      voteFactors(totals(2021), result(2021, { data_release: "other" })),
    ).toBeNull();
    expect(
      voteFactors(totals(2026, { ballot: "first" }), result(2026)),
    ).toBeNull();
  });
});
