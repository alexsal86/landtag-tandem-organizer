import { atlasRows, atlasRankings, atlasScale } from "@/features/election-analysis/research/atlasModel";
import type { ComparisonValue } from "@/features/election-analysis/research/types";
import { analysisReport } from "@/features/election-analysis/research/reports";
import {
  allocateBw2026,
  sainteLague,
} from "@/features/election-analysis/research/simulator/seats";
import { directTransferThreshold } from "@/features/election-analysis/research/simulator/model";
import { scenarioParams } from "@/features/election-analysis/research/scenarioStorage";
import {
  localMetrics,
  parseLocalCsv,
} from "@/features/election-analysis/research/localModel";
import {
  adjustedRand,
  clusterDistricts,
} from "@/features/election-analysis/research/lab/clustering";
import { linearModel } from "@/features/election-analysis/research/lab/regression";
import {
  flowSensitivity,
  projectShares,
} from "@/features/election-analysis/research/lab/scenarios";
import { parseStructureCsv } from "@/features/election-analysis/research/lab/structureCsv";
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
      id: "swing-atlas-selection",
      label: "Swing-Atlas: exakte Suche, getrennte Ranglisten und feste Skala",
      kind: "logic",
      run: async () => {
        const row = (n: number, swing: number | null): ComparisonValue => ({
          districtNumber: n,
          districtName: `Stuttgart ${n}`,
          party: "GRÜNE",
          before: undefined,
          after: undefined,
          swing,
          voteDelta: swing,
          stateSwing: null,
          relativeSwing: null,
          comparable: swing !== null,
          warnings: [],
        });
        const rows = [row(1, -2), row(11, -1), row(2, 0), row(3, null)];
        const ranked = atlasRankings(rows, "pp");
        return {
          ok:
            atlasRows(rows, "GRÜNE", "1").length === 1 &&
            atlasRows(rows, "GRÜNE", " STUTTGART ").length === 4 &&
            atlasRows(rows, "CDU", "").length === 0 &&
            ranked.gains.length === 0 &&
            ranked.losses[0].districtNumber === 1 &&
            ranked.unknown === 1 &&
            ranked.unchanged === 1 &&
            atlasScale("pp") === atlasScale("relative") &&
            atlasScale("votes") === 10000,
          message:
            "Verluste werden nie als Zugewinne gelistet; unbekannt bleibt getrennt von Null.",
        };
      },
    },
    {
      id: "analysis-reports",
      label: "Bericht: sichtbare Werte einfrieren und aktive Inhalte entfernen",
      kind: "logic",
      run: async () => {
        const root = document.createElement("div");
        root.innerHTML =
          '<h2>Synthetic</h2><input value="old"><script>unsafe()</script><a href="javascript:unsafe()">X</a><span data-report-exclude>omit-me</span>';
        root.querySelector("input")!.value = "current";
        const html = analysisReport(
          root,
          "Synthetic <title>",
          "/daten",
          "synthetic",
        );
        const checks = {
          value: html.includes("current"),
          escapedTitle: html.includes("Synthetic &lt;title&gt;"),
          noScript: !html.includes("<script"),
          noJavascript: !html.includes("javascript:"),
          noForms: !html.includes("omit-me"),
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message:
            "Statischer separater Bericht ohne Druck-/Download-Nebenwirkung.",
          details: checks,
        };
      },
    },
    {
      id: "election-workspaces",
      label:
        "Sitze, Mandatsschwellen, private Szenarien und Gemeinde-Nullwerte",
      kind: "logic",
      run: async () => {
        const seats = allocateBw2026({
          parties: [
            {
              id: "A",
              name: "Synthetic A",
              votes: 501,
              hasList: true,
              direct: 35,
            },
            {
              id: "B",
              name: "Synthetic B",
              votes: 499,
              hasList: true,
              direct: 35,
            },
          ],
          validSecond: 1000,
        });
        const row = parseLocalCsv(
          "unit_key;name;party;eligible;voters;valid_votes;votes\n08111000;Synthetic;A;;;0;0",
          {
            year: 2026,
            ballot: "second",
            district: 1,
            type: "municipality",
            release: "synthetic",
            source: "https://example.org/synthetic",
            boundary: "synthetic-2026",
            preliminary: false,
            verified: true,
          },
        )[0];
        const params = scenarioParams(
          new URLSearchParams(
            "researchTool=scenario&analysisYear=2026&scenarioDelta_CDU=3&redirect=https://example.org",
          ),
        );
        const checks = {
          majority:
            seats.total === 121 &&
            seats.majorityBonus === 1 &&
            seats.rows[0].total === 61,
          exactTie:
            sainteLague(
              [
                { id: "A", votes: 1 },
                { id: "B", votes: 1 },
              ],
              1,
              true,
            ).A === 1,
          threshold:
            directTransferThreshold(
              [
                { id: "A", votes: 60 },
                { id: "B", votes: 40 },
              ],
              "B",
            ) === 11,
          noRedirect: !("redirect" in params),
          zeroUnknown:
            row.votes === 0 &&
            row.eligible === null &&
            localMetrics(row).share === null,
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message:
            "Gemeinsame fachliche Regeln; Datenbank-Tenantrechte werden separat in SQL-Fixtures geprüft.",
          details: checks,
        };
      },
    },
    {
      id: "research-lab",
      label: "Wahlforschung: explorative Gruppen, OLS, Szenarien und Annahmen",
      kind: "logic",
      run: async () => {
        const projected = projectShares([-5, 50, 55]);
        const regression = linearModel(
          Array.from({ length: 12 }, (_, i) => ({
            number: i + 1,
            name: "Synthetic",
            x: i,
            y: 1 + 2 * i,
          })),
        );
        const flow = flowSensitivity(500, 100, 300, 50)!;
        const grouped = clusterDistricts(
          Array.from({ length: 20 }, (_, i) => ({
            number: i + 1,
            name: "Synthetic",
            values: [i < 10 ? -10 : 10, (i % 10) / 100],
            raw: {},
          })),
          2,
        );
        const checks = {
          nonnegative: projected.every((v) => v >= 0),
          total100: Math.abs(projected.reduce((a, b) => a + b, 0) - 100) < 1e-9,
          linearSlope: Math.abs(regression.slope - 2) < 1e-9,
          holdout: regression.looRmse != null && regression.looRmse < 1e-9,
          groupAgreement: grouped.methodAgreement === 1,
          labelInvariant: adjustedRand([0, 0, 1, 1], [4, 4, 7, 7]) === 1,
          balancePreserved: flow.assumedIn - flow.assumedOut === 500,
          missingFlow: flowSensitivity(null, 0, 100, 0) === null,
          missingCsv:
            parseStructureCsv("district_number;year;value\n1;2026;\n", 2026)
              .rows[0].values.value === null,
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message:
            "Gemeinsame Rechenregeln des explorativen Forschungslabors; keine wissenschaftliche Validierung.",
          details: checks,
        };
      },
    },
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
