import { describe, expect, it } from "vitest";
import {
  candidateComparison,
  candidateCoverageReady,
  directPartyChanges,
  electedMandates,
  mandateCounts,
  mandateDays,
  personTransitions,
} from "./mandateModel";
import type {
  ElectionHistoryData,
  ElectionPeriod,
  HistoricalMandate,
} from "@/features/election-history/types";
import type {
  CandidateCoverage,
  DistrictVersion,
  VerifiedCandidate,
} from "./types";
const period: ElectionPeriod = {
  id: "p",
  number: 18,
  name: "18",
  election_year: 2026,
  election_date: null,
  starts_on: "2026-01-01",
  ends_on: "2031-01-01",
  ends_on_is_expected: true,
  is_current: true,
  is_published: true,
  source_url: null,
  notes: null,
};
const mandate = (
  extra: Partial<HistoricalMandate> = {},
): HistoricalMandate => ({
  id: "m",
  period_id: "p",
  person_id: "person",
  person_name: "Gleicher Name",
  original_mandate: "Direktmandat",
  party_label: null,
  left_early: false,
  district_id: "d",
  candidacy_id: null,
  party: "CDU",
  mandate_type: "direct",
  entry_type: "election",
  start_from_period: false,
  end_from_period: false,
  starts_on: "2026-01-01",
  ends_on: "2026-01-10",
  source_url: null,
  notes: null,
  ...extra,
});
const data = (
  mandates: HistoricalMandate[] = [mandate()],
): ElectionHistoryData => ({
  periods: [period],
  people: [
    {
      id: "person",
      name: "Bestätigte Person",
      history_complete: false,
      source_url: null,
      biography: null,
    },
  ],
  districts: [
    {
      id: "d",
      period_id: "p",
      district_number: 1,
      name: "Beispiel",
      number_label: null,
      boundaries: null,
      boundary_note: null,
      source_url: null,
    },
  ],
  candidacies: [],
  mandates,
});
const version = (extra: Partial<DistrictVersion> = {}): DistrictVersion => ({
  year: 2026,
  district_number: 1,
  district_name: "Beispiel",
  geography_id: "g",
  identity_key: "same",
  historical_district_id: "d",
  history_link_verified: true,
  notes: null,
  ...extra,
});
describe("Mandatsanalyse", () => {
  it("zählt Nachrücker separat und unterscheidet Zweit- und Listenmandate", () => {
    const counts = mandateCounts(
      data([
        mandate(),
        mandate({
          id: "second",
          person_id: "s",
          mandate_type: "list",
          original_mandate: "Zweitmandat",
        }),
        mandate({
          id: "list",
          person_id: "l",
          mandate_type: "list",
          original_mandate: "Landeslistenmandat",
        }),
        mandate({ id: "succession", person_id: "n", entry_type: "succession" }),
      ]),
    );
    expect(counts.rows[0]).toMatchObject({
      direct: 1,
      second: 1,
      list: 1,
      successors: 1,
    });
  });
  it("fasst nur bestätigte identische Personen zusammen und sperrt widersprüchliche Wahleinträge", () => {
    expect(
      electedMandates([mandate(), mandate({ id: "duplicate" })]).duplicates,
    ).toBe(1);
    expect(
      electedMandates([
        mandate({ person_id: null }),
        mandate({ id: "another", person_id: null }),
      ]).rows,
    ).toHaveLength(2);
    expect(
      electedMandates([mandate(), mandate({ id: "conflict", party: "SPD" })])
        .conflicts,
    ).toBe(2);
  });
  it("verwechselt Nachrücken und gleiche Namen nicht mit Wiederwahl", () => {
    expect(
      personTransitions(data([mandate({ entry_type: "succession" })]), data()),
    ).toHaveLength(0);
    expect(
      personTransitions(
        data([mandate({ person_id: null })]),
        data([mandate({ person_id: null })]),
      ),
    ).toHaveLength(0);
    expect(
      personTransitions(
        data(),
        data([
          mandate({
            mandate_type: "list",
            original_mandate: "Landeslistenmandat",
          }),
        ]),
      )[0],
    ).toMatchObject({ reelected: true, typeChanged: true });
  });
  it("berechnet nur abgeschlossene tatsächliche Kalenderintervalle inklusive beider Tage", () => {
    expect(mandateDays(mandate(), period, "2026-11-14")).toBe(10);
    expect(
      mandateDays(
        mandate({ starts_on: "2024-02-28", ends_on: "2024-03-01" }),
        period,
        "2026-11-14",
      ),
    ).toBe(3);
    expect(
      mandateDays(mandate({ end_from_period: true }), period, "2026-11-14"),
    ).toBeNull();
    expect(
      mandateDays(mandate({ ends_on: "2031-01-01" }), period, "2026-11-14"),
    ).toBeNull();
    expect(
      mandateDays(mandate({ ends_on: null }), period, "2026-11-14"),
    ).toBeNull();
  });
  it("bestimmt Direktparteiwechsel ausschließlich bei geprüfter gemeinsamer Geometrie", () => {
    const before = data([mandate({ period_id: "old", district_id: "old-d" })]);
    before.periods = [
      { ...period, id: "old", number: 17, election_year: 2021 },
    ];
    before.districts = [
      { ...before.districts[0], id: "old-d", period_id: "old" },
    ];
    const after = data([mandate({ party: "SPD" })]);
    const versions = [
      version(),
      version({ year: 2021, historical_district_id: "old-d" }),
    ];
    expect(directPartyChanges(before, after, versions)[0].changed).toBe(true);
    expect(directPartyChanges(before, after, [])[0].changed).toBeNull();
    after.mandates.push(
      mandate({ id: "ambiguous", person_id: null, party: "SPD" }),
    );
    expect(directPartyChanges(before, after, versions)[0].changed).toBeNull();
  });
});
describe("Kandidaturvollständigkeit und bestätigter Referenzvergleich", () => {
  const candidate = {
    id: "c",
    period_id: "p",
    person_id: "person",
    district_id: "d",
    party: "CDU",
    votes: 300,
    vote_share: 30,
    district_rank: 1,
    list_position: null,
    ballot_type: "first_vote" as const,
    outcome: "direct" as const,
    source_url: "https://example.org",
    notes: null,
  };
  const coverage: CandidateCoverage = {
    period_id: "p",
    is_complete: true,
    expected_district_candidacies: 1,
    source_url: "https://example.org",
    reviewed_at: "2026-11-14T00:00:00Z",
    notes: null,
  };
  const official: VerifiedCandidate = {
    year: 2026,
    district_number: 1,
    party: "CDU",
    candidate_name: "Amtliche Person",
    votes: 300,
    share: 30,
    source_url: "https://example.org",
    verified: true,
    person_id: "person",
    data_release: "official",
  };
  const reference = {
    year: 2026,
    ballot: "second" as const,
    district_number: 1,
    district_name: "Beispiel",
    party: "CDU",
    votes: 250,
    share: 25,
    preliminary: false,
    notes: null,
    data_release: "official",
  };
  it("leitet keine Kandidaturen aus Mandaten ab und verlangt bestätigte vollständige Erfassung", () => {
    const d = data();
    expect(candidateCoverageReady(d, coverage)).toBe(false);
    d.candidacies = [candidate];
    expect(candidateCoverageReady(d, coverage)).toBe(true);
    expect(candidateCoverageReady(d, { ...coverage, is_complete: false })).toBe(
      false,
    );
    expect(
      candidateCoverageReady(d, {
        ...coverage,
        expected_district_candidacies: 2,
      }),
    ).toBe(false);
  });
  it("vergleicht nur bestätigte Personen, Grenzen, Stimmen und endgültige Datenstände", () => {
    const d = data();
    d.candidacies = [candidate];
    expect(
      candidateComparison(d, [version()], [reference], [official])[0]
        .difference,
    ).toBe(5);
    expect(
      candidateComparison(
        d,
        [version()],
        [reference],
        [{ ...official, person_id: null }],
      )[0].difference,
    ).toBeNull();
    expect(
      candidateComparison(
        d,
        [version()],
        [{ ...reference, preliminary: true }],
        [official],
      )[0].difference,
    ).toBeNull();
    expect(
      candidateComparison(
        d,
        [version()],
        [{ ...reference, data_release: "different" }],
        [official],
      )[0].difference,
    ).toBeNull();
    expect(
      candidateComparison(d, [], [reference], [official])[0].difference,
    ).toBeNull();
  });
});
