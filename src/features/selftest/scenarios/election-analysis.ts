import {
  electedMandates,
  mandateDays,
  candidateCoverageReady,
} from "@/features/election-analysis/research/mandateModel";
import type {
  ElectionHistoryData,
  HistoricalMandate,
} from "@/features/election-history/types";
import {
  decomposeVotes,
  turnoutCorrelation,
  turnoutChanges,
} from "@/features/election-analysis/research/turnoutModel";
import {
  boundaryCompatibility,
  compareDistrict,
  firstSecondDifference,
  residualVotes,
  subtract,
  turnoutRate,
  uniqueTurnout,
  validateElectionData,
} from "@/features/election-analysis/research/calculations";
import type {
  DistrictResult,
  Turnout,
} from "@/features/election-analysis/types";
import type { TestScenario } from "../types";
export const electionAnalysisScenario: TestScenario = {
  id: "election-analysis",
  title: "Wahlanalyse: Datenqualität und Vergleichbarkeit",
  description: "Reine Rechenregeln ohne Datenbankänderungen.",
  features: ["election-analysis"],
  touches: [],
  checks: [
    "Unbekannt gegenüber echter Null",
    "Getrennte Stimmenarten und gemeinsame Beteiligung",
    "Keine erfundenen historischen Identitäten",
    "AfD vor Parteigründung",
  ],
  limitations: [
    "Amtliche Downloads, Datenbank-RLS und Vollständigkeit historischer Kandidaturen sind separate Prüfungen.",
  ],
  steps: [
    {
      id: "mandate-analysis",
      label: "Mandate: Identitäten, Nachrücker und tatsächliche Amtszeit",
      kind: "logic",
      run: async () => {
        const m: HistoricalMandate = {
          id: "m",
          period_id: "p",
          person_id: "confirmed",
          person_name: "Beispiel",
          party: "CDU",
          mandate_type: "direct",
          entry_type: "election",
          district_id: null,
          candidacy_id: null,
          original_mandate: "Direktmandat",
          party_label: null,
          left_early: false,
          start_from_period: false,
          end_from_period: false,
          starts_on: "2024-02-28",
          ends_on: "2024-03-01",
          source_url: null,
          notes: null,
        };
        const data: ElectionHistoryData = {
          periods: [
            {
              id: "p",
              number: 18,
              name: "Beispiel",
              election_year: 2026,
              election_date: null,
              starts_on: null,
              ends_on: null,
              ends_on_is_expected: true,
              is_current: true,
              is_published: true,
              source_url: null,
              notes: null,
            },
          ],
          people: [],
          districts: [],
          candidacies: [],
          mandates: [m],
        };
        const checks = {
          successorNotWin:
            electedMandates([{ ...m, entry_type: "succession" }]).rows
              .length === 0,
          confirmedDuplicate:
            electedMandates([m, { ...m, id: "duplicate" }]).rows.length === 1,
          unlinkedNamesDistinct:
            electedMandates([
              { ...m, person_id: null },
              { ...m, id: "other", person_id: null },
            ]).rows.length === 2,
          conflictsExcluded:
            electedMandates([m, { ...m, id: "conflict", party: "SPD" }]).rows
              .length === 0,
          inclusiveLeapDays:
            mandateDays(m, data.periods[0], "2026-11-14") === 3,
          expectedEndUnknown:
            mandateDays(
              { ...m, end_from_period: true },
              data.periods[0],
              "2026-11-14",
            ) === null,
          candidatesNotInferred: !candidateCoverageReady(data, null),
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message:
            "Keine erfundenen Identitäten, Wahlsiege oder Kandidaturen; nur abgeschlossene Amtsintervalle.",
          details: checks,
        };
      },
    },
    {
      id: "turnout-statistics",
      label:
        "Beteiligung: vollständige Paare und symmetrische Stimmenzerlegung",
      kind: "logic",
      run: async () => {
        const correlation = turnoutCorrelation([
          { turnoutDelta: 1, shareDelta: 2 },
          { turnoutDelta: 2, shareDelta: 4 },
          { turnoutDelta: 3, shareDelta: 6 },
          { turnoutDelta: null, shareDelta: 0 },
        ]);
        const before = {
          eligible: 1000,
          participation: 0.6,
          validity: 0.95,
          partyShare: 0.2,
        };
        const after = {
          eligible: 1100,
          participation: 0.7,
          validity: 0.97,
          partyShare: 0.3,
        };
        const d = decomposeVotes(before, after)!;
        const reverse = decomposeVotes(after, before)!;
        const rows = turnoutChanges(
          { results: [], turnout: [], state: [], versions: [] },
          {
            beforeYear: 2021,
            afterYear: 2026,
            ballot: "second",
            party: "CDU",
            allowUnknownBoundaries: false,
            allowMixedStatus: false,
          },
        );
        const checks = {
          correlation:
            correlation.value === 1 &&
            correlation.pairs === 3 &&
            correlation.excluded === 1,
          constantUndefined:
            turnoutCorrelation([
              { turnoutDelta: 1, shareDelta: 1 },
              { turnoutDelta: 1, shareDelta: 2 },
              { turnoutDelta: 1, shareDelta: 3 },
            ]).value === null,
          decompositionSum:
            Math.abs(
              d.eligible +
                d.participation +
                d.validity +
                d.partyShare -
                d.total,
            ) < 1e-9,
          reverse: Math.abs(d.total + reverse.total) < 1e-9,
          missingRemainsUnknown:
            rows.length === 70 &&
            rows.every((r) => r.turnoutDelta === null && r.votesDelta === null),
          zeroDenominator: decomposeVotes(null, after) === null,
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message:
            "Deskriptive Korrelation, fehlende Paare und vorbereitete Shapley-Zerlegung.",
          details: checks,
        };
      },
    },
    {
      id: "election-quality",
      label: "Fehlende Werte, Stimmenarten, Beteiligung und Grenzen",
      kind: "logic",
      run: async () => {
        const r: DistrictResult = {
          year: 2026,
          ballot: "first",
          district_number: 1,
          district_name: "Beispiel",
          party: "CDU",
          votes: 100,
          share: 20,
          preliminary: false,
          notes: null,
          data_release: "same",
        };
        const t: Turnout = {
          year: 2026,
          ballot: "first",
          district_number: 1,
          district_name: "Beispiel",
          eligible: 1000,
          voters: 600,
          valid_votes: 500,
          turnout: 60,
          preliminary: false,
          notes: null,
          data_release: "same",
        };
        const version = (
          year: number,
          identity_key: string | null = "same",
        ) => ({
          year,
          district_number: 1,
          district_name: "Beispiel",
          geography_id: "verified",
          identity_key,
          historical_district_id: null,
          history_link_verified: false,
          notes: null,
        });
        const before = {
          ...r,
          year: 2021,
          ballot: "single" as const,
          share: 10,
          votes: 50,
          data_release: "final-2021",
        };
        const after = {
          ...r,
          ballot: "second" as const,
          data_release: "final-2026",
        };
        const states = (year: number, share: number) => ({
          year,
          ballot: year === 2021 ? ("single" as const) : ("second" as const),
          party: "CDU",
          votes: 100,
          share,
          seats: null,
          valid_votes: 1000,
          notes: null,
          data_release: `final-${year}`,
        });
        const comparison = compareDistrict({
          before,
          after,
          versionBefore: version(2021),
          versionAfter: version(2026),
          stateBefore: states(2021, 10),
          stateAfter: states(2026, 15),
        });
        const checks = {
          swing:
            comparison.swing === 10 &&
            comparison.voteDelta === 50 &&
            comparison.relativeSwing === 5,
          unknownExcluded: compareDistrict({ before, after }).swing === null,
          changedExcluded:
            compareDistrict({
              before,
              after,
              versionBefore: version(2021),
              versionAfter: version(2026, "changed"),
              allowUnknownBoundaries: true,
            }).swing === null,
          mixedExcluded:
            compareDistrict({
              before,
              after: { ...after, preliminary: true },
              versionBefore: version(2021),
              versionAfter: version(2026),
            }).swing === null,
          unknown: subtract(null, 0) === null,
          zero: subtract(0, 0) === 0,
          turnout: turnoutRate(1000, 600) === 60,
          deduplicate:
            uniqueTurnout([t, { ...t, ballot: "second" }]).length === 1,
          split:
            firstSecondDifference(r, { ...r, ballot: "second", share: 25 })
              .pp === -5,
          boundaries:
            boundaryCompatibility(undefined, undefined).status === "unknown",
          residual: residualVotes(100, [40, 30]) === 30,
          invalidAfD: validateElectionData(
            [{ ...r, year: 2011, party: "AfD", votes: 0, share: 0 }],
            [],
          ).some((i) => i.code === "afd-before-foundation"),
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Gemeinsame fachliche Regeln der Wahlanalyse.",
          details: checks,
        };
      },
    },
  ],
};
