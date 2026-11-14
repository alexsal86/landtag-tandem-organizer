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
