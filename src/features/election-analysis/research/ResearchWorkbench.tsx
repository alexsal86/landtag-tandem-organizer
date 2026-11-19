import { formatMandateType } from '@/features/election-history/mandateLabel';
import { DistrictCandidateChronicle, useDistrictCandidacies } from './DistrictCandidateChronicle';
import { ProfileBoundarySection } from "./ProfileBoundarySection";
import { AnalysisControls } from "../AnalysisToolbar";
import ResearchLab from "./lab/ResearchLab";
import MandateAnalysis from "./MandateAnalysis";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getPartyColor } from "@/features/election-districts/partyColors";
import { Portal } from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip as InfoTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataState,
  DataTable,
  Selection,
  StatusNote,
  chartColor,
  PartyLabel,
  PartyVisibilityChips,
} from "../shared";
import { PartyEndLabels } from "../StateShareChart";
import { ballotLabels, compareAnalysisValues, number, parties, percent } from "../model";
import { useStateTotal } from "../useStateHistory";
import type { Ballot } from "../types";
import {
  useComparison,
  useDistrictHistory,
  useDistrictSeries,
  useDistrictVersions,
  useVerifiedCandidates,
} from "./hooks";
import {
  ballotForComparison,
  compareDistrict,
  firstSecondDifference,
  subtract,
  turnoutRate,
  uniqueTurnout,
} from "./calculations";
import type { ComparisonValue, Metric } from "./types";
import TurnoutComparison from "./TurnoutComparison";
import { AnalysisMap } from "./AnalysisMap";
import { SwingAtlas } from "./SwingAtlas";

import { analysisDestination } from "../navigation";

const SeatSimulator = lazy(() => import("./simulator/SeatSimulator"));

type Props = {
  section:
    | "profile"
    | "swing"
    | "split"
    | "turnout-trend"
    | "mandates"
    | "research"
    | "seats";
  year: number;
  ballot: Ballot;
  party: string;
  gender: string;
  years: number[];
};
export default function ResearchWorkbench(props: Props) {
  const [params, setParams] = useSearchParams();
  const set = useCallback(
    (key: string, value: string) =>
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set(key, value);
        return next;
      }),
    [setParams],
  );
  const open = useCallback(
    (district: number) =>
      setParams((previous) => {
        const next = analysisDestination(previous, "profile");
        next.set("analysisDistrict", String(district));
        next.set("analysisYear", String(props.year));
        return next;
      }),
    [setParams, props.year],
  );
  const requested = Number(params.get("analysisDistrict"));
  const district =
    Number.isInteger(requested) && requested >= 1 && requested <= 70
      ? requested
      : 1;
  if (props.section === "seats")
    return <Suspense fallback={<p role="status">Sitzrechner lädt …</p>}><SeatSimulator year={props.year} /></Suspense>;
  if (props.section === "profile")
    return <DistrictProfile {...props} district={district} set={set} />;
  if (props.section === "turnout-trend")
    return <TurnoutComparison {...props} onOpenDistrict={open} />;
  if (props.section === "research")
    return <ResearchLab {...props} onOpenDistrict={open} />;
  if (props.section === "mandates") return <MandateAnalysis />;
  return (
    <AtlasPanel
      {...props}
      set={set}
      open={open}
      split={props.section === "split"}
    />
  );
}
type SetParam = (key: string, value: string) => void;
function DistrictProfile({
  district,
  year,
  ballot,
  years,
  set,
}: Props & { district: number; set: SetParam }) {
  const versions = useDistrictVersions(year);
  const selectedVersion = versions.data?.find(
    (version) => version.year === year && version.district_number === district,
  );
  const query = useDistrictSeries(district, years);
  const candidacies = useDistrictCandidacies(district);
  const selectedBallot = ballotForComparison(year, ballot);
  const turnoutBallot = ballotForComparison(year, "second");
  const stateTotal = useStateTotal(year, turnoutBallot);
  const [hiddenParties, setHiddenParties] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useDistrictHistory(district, year, historyOpen);
  const [params] = useSearchParams();
  const requestedBefore = Number(params.get("analysisBefore"));
  const beforeYear =
    years.includes(requestedBefore) && requestedBefore !== year
      ? requestedBefore
      : years.find((y) => y < year) ||
        years
          .slice()
          .sort((a, b) => a - b)
          .find((y) => y !== year) ||
        year;
  const metric = params.get("profileMetric") || "share";
  const data = query.data;
  const results = data?.results || [];
  const orderedYears = years.slice().sort((a, b) => a - b);
  const selection: ({ year: number } & Record<string, number | null>)[] = orderedYears.map((y, index) => ({
    year: y,
    ...Object.fromEntries(
      parties.map((p) => {
        const current = results.find(
          (r) =>
            r.year === y &&
            r.party === p &&
            r.ballot === ballotForComparison(y, ballot),
        );
        if (metric === "share" || metric === "votes")
          return [p, current?.[metric === "votes" ? "votes" : "share"] ?? null];
        const priorYear = orderedYears[index - 1];
        const prior = results.find(
          (r) =>
            r.year === priorYear &&
            r.party === p &&
            r.ballot === ballotForComparison(priorYear, ballot),
        );
        const comparison = compareDistrict({
          before: prior,
          after: current,
          versionBefore: data?.versions.find((v) => v.year === priorYear),
          versionAfter: data?.versions.find((v) => v.year === y),
        });
        return [p, metric === "pp" ? comparison.swing : comparison.voteDelta];
      }),
    ),
  }));
  const resultRows = selection.slice().reverse();
  const sharesByParty = new Map(results.filter(result => result.year === year && result.ballot === selectedBallot)
    .map(result => [result.party, result.share]));
  const rankedParties = parties.slice().sort((a, b) =>
    compareAnalysisValues(sharesByParty.get(a) ?? null, sharesByParty.get(b) ?? null, "desc"));
  const visibleParties = rankedParties.filter(party => !hiddenParties.includes(party));
  const chartValues = selection.flatMap(row => visibleParties.map(party => row[party] ?? 0));
  const chartMinimum = Math.min(0, ...chartValues);
  const chartMaximum = Math.max(0, ...chartValues);
  const chartPadding = (chartMaximum - chartMinimum) * 0.08 || 1;
  const chartDomain: [number, number] = [chartMinimum < 0 ? chartMinimum - chartPadding : 0, chartMaximum + chartPadding];
  const formatMetric = metric === "share" ? percent : metric === "votes" ? number
    : (value: number) => metric === "pp" ? `${signed(value, 1)} Pp.` : signed(value);
  const totals = uniqueTurnout(
    (data?.turnout || []).filter(
      (r) => r.ballot === ballotForComparison(r.year, ballot),
    ),
  ).sort((a, b) => b.year - a.year);
  const comparisons = parties.map((p) =>
    compareDistrict({
      before: results.find(
        (r) =>
          r.year === beforeYear &&
          r.ballot === ballotForComparison(beforeYear, ballot) &&
          r.party === p,
      ),
      after: results.find(
        (r) =>
          r.year === year &&
          r.ballot === ballotForComparison(year, ballot) &&
          r.party === p,
      ),
      versionBefore: data?.versions.find((v) => v.year === beforeYear),
      versionAfter: data?.versions.find((v) => v.year === year),
    }),
  );
  const name =
    selectedVersion?.district_name ||
    data?.versions.find((v) => v.year === year)?.district_name ||
    results.find((result) => result.year === year)?.district_name;
  const title = `Wahlkreis ${district}${name ? `: ${name}` : ""}`;
  const historicalDistrictId = selectedVersion?.history_link_verified ? selectedVersion.historical_district_id : null;
  const directWinner = historicalDistrictId ? candidacies.data?.find((candidate) =>
    candidate.district?.id === historicalDistrictId &&
    candidate.district?.period?.election_year === year &&
    candidate.outcome === "direct",
  ) : undefined;
  const leadingParty = results.filter((result) =>
    result.year === year && result.ballot === selectedBallot && result.share != null,
  ).sort((a, b) => (b.share ?? -1) - (a.share ?? -1))[0];
  const statePartyShare = leadingParty ? data?.state.find((result) =>
    result.year === year && result.ballot === selectedBallot && result.party === leadingParty.party,
  )?.share : null;
  const turnout = data?.turnout.find((result) => result.year === year && result.ballot === turnoutBallot);
  const districtTurnout = turnout?.turnout ?? turnoutRate(turnout?.eligible ?? null, turnout?.voters ?? null);
  const stateTurnout = turnoutRate(stateTotal.data?.eligible ?? null, stateTotal.data?.voters ?? null);
  const partyDelta = subtract(leadingParty?.share, statePartyShare);
  const turnoutDelta = subtract(districtTurnout, stateTurnout);
  const overview = [
    {
      label: `Direktmandat ${year}`,
      value: directWinner?.person ? `${directWinner.person.name} (${directWinner.party})` : "—",
      detail: directWinner?.vote_share != null ? `${percent(directWinner.vote_share)} · ${ballotLabels[ballotForComparison(year, "first")]}` : null,
    },
    {
      label: leadingParty ? `${leadingParty.party === "GRÜNE" ? "Grüne" : leadingParty.party} ${year} (${ballotLabels[selectedBallot]})` : `Stärkste erfasste Partei ${year}`,
      value: percent(leadingParty?.share),
      detail: partyDelta != null ? `${signed(partyDelta, 1)} Prozentpunkte zum Land (${percent(statePartyShare)})` : null,
    },
    {
      label: `Wahlbeteiligung ${year}`,
      value: percent(districtTurnout),
      detail: turnoutDelta != null ? `Land: ${percent(stateTurnout)} (${signed(turnoutDelta, 1)} Prozentpunkte)` : null,
    },
    {
      label: `Wahlberechtigte ${year}`,
      value: number(turnout?.eligible),
      detail: turnout?.voters != null ? `Wählende: ${number(turnout.voters)}` : null,
    },
  ];
  return (
    <div className="space-y-4">
      <AnalysisControls>
        <Selection
          id="research-district"
          label="Wahlkreis-Steckbrief"
          value={String(district)}
          onChange={(v) => set("analysisDistrict", v)}
        >
          {Array.from({ length: 70 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}:{" "}
              {versions.data?.find((v) => v.district_number === n)
                ?.district_name || `Wahlkreis ${n}`}
            </option>
          ))}
        </Selection>
        <Selection
          id="profile-metric"
          label="Zeitreihe"
          value={metric}
          onChange={(v) => set("profileMetric", v)}
        >
          <option value="share">Stimmenanteil</option>
          <option value="votes">Absolute Stimmen</option>
          <option value="pp">Veränderung zur Vorwahl (%)</option>
          <option value="deltaVotes">Stimmendifferenz zur Vorwahl</option>
        </Selection>
      </AnalysisControls>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <section aria-label="Wahlkreis im Überblick" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview.map(({ label, value, detail }) => (
          <Card key={label} className="min-w-0">
            <CardContent className="space-y-1 p-5">
              <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
              <p className="break-words text-2xl font-semibold tabular-nums">{value}</p>
              {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
            </CardContent>
          </Card>
        ))}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-lg">
              Parteientwicklung {orderedYears[0]}–{orderedYears[orderedYears.length - 1]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataState
              loading={query.isLoading}
              error={query.error}
              empty={!results.length}
              retry={() => void query.refetch()}
            >
              {visibleParties.length ? <div
                className="h-80"
                role="img"
                aria-label="Wahlkreis-Zeitreihe; Messwerte in der Tabelle"
              >
                <ResponsiveContainer>
                  <LineChart data={selection} margin={{ top: 16, right: 120, bottom: 10 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis domain={chartDomain} allowDataOverflow tickFormatter={formatMetric} />
                    <Tooltip formatter={value => typeof value === "number" ? formatMetric(value) : value} />
                    {visibleParties.map((p) => (
                      <Line
                        key={p}
                        dataKey={p}
                        stroke={chartColor(p)}
                        connectNulls={false}
                        strokeWidth={2}
                      />
                    ))}
                    <PartyEndLabels result={selection[selection.length - 1]} visibleParties={visibleParties}
                      minimum={chartDomain[0]} maximum={chartDomain[1]} format={formatMetric} />
                  </LineChart>
                </ResponsiveContainer>
              </div> : <p className="py-12 text-center text-sm text-muted-foreground">Bitte mindestens eine Partei einblenden.</p>}
              <PartyVisibilityChips parties={rankedParties} hidden={hiddenParties} onToggle={party =>
                setHiddenParties(current => current.includes(party) ? current.filter(value => value !== party) : [...current, party])}
              />
            </DataState>
          </CardContent>
        </Card>
        <ProfileBoundarySection
          year={year}
          number={district}
          name={name ?? ""}
          historicalDistrictId={historicalDistrictId}
        />
      </div>
      <DistrictCandidateChronicle
        district={district}
        selectedYear={year}
        linkedDistrictId={historicalDistrictId}
      />
      {!query.isLoading && !query.error && results.length > 0 && <>
        <div className="space-y-4 [&_tbody]:bg-white [&_tbody]:text-slate-900">
          <h3 className="text-lg font-medium">Ergebnisse pro Wahljahr</h3>
          <DataTable
            headers={["Wahljahr", ...parties, "Stimmenart / Status"]}
            sortableColumns={[0]}
            sortValues={resultRows.map((row) => [row.year])}
            rows={resultRows.map((row) => [
              row.year,
              ...parties.map((p) =>
                metric === "votes" || metric === "deltaVotes"
                  ? number((row as Record<string, number | null>)[p])
                  : metric === "pp"
                    ? signed((row as Record<string, number | null>)[p])
                    : percent((row as Record<string, number | null>)[p]),
              ),
              `${ballotLabels[ballotForComparison(row.year, ballot)]}${results.some((r) => r.year === row.year && r.preliminary) ? " · vorläufig" : ""}`,
            ])}
          />
          <h3 className="text-lg font-medium">Grunddaten und Wahlbeteiligung</h3>
          <DataTable
            headers={[
              "Wahljahr",
              "Wahlberechtigte",
              "Wählende",
              "Beteiligung",
              "Gültige Stimmen",
            ]}
            rows={totals.map((t) => [
              t.year,
              number(t.eligible),
              number(t.voters),
              percent(t.turnout),
              number(t.valid_votes),
            ])}
          />
        </div>
        <Selection
          id="profile-before"
          label={`Vergleich mit ${year}`}
          value={String(beforeYear)}
          onChange={(v) => set("analysisBefore", v)}
        >
          {years
            .filter((y) => y !== year)
            .map((y) => (
              <option key={y}>{y}</option>
            ))}
        </Selection>
        <DataTable
          headers={[
            "Partei",
            `${beforeYear} Anteil`,
            `${year} Anteil`,
            "Änderung %",
            "Stimmendifferenz",
            "Vergleichbarkeit",
          ]}
          rows={comparisons.map((r) => [
            <PartyLabel party={r.party} />,
            percent(r.before?.share),
            percent(r.after?.share),
            signed(r.swing),
            signed(r.voteDelta),
            r.warnings.join(" ") || "Gleicher geprüfter Zuschnitt",
          ])}
        />
        <details
          className="rounded-lg border p-4"
          onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer font-medium">
            Verifizierte Mandatshistorie laden
          </summary>
          {history.isLoading && <p role="status">Mandatshistorie lädt …</p>}
          {history.error && (
            <p role="alert">Historie konnte nicht geladen werden.</p>
          )}
          {history.data?.length ? (
            <div className="mt-3">
              <DataTable
                headers={[
                  "Periode",
                  "Name",
                  "Partei",
                  "Mandat",
                  "Amtszeit",
                  "Hinweis",
                ]}
                rows={history.data.map((m) => [
                  m.period_name,
                  m.person_name,
                  m.party,
                  `${formatMandateType(m.mandate_type)}${m.entry_type === "succession" ? " · nachgerückt" : ""}`,
                  `${m.starts_on || "Beginn unbekannt"} – ${m.ends_on || "Ende unbekannt"}${m.end_is_expected ? " (reguläres, noch nicht feststehendes Ende)" : ""}`,
                  m.notes || "—",
                ])}
              />
            </div>
          ) : (
            history.data && (
              <p className="mt-3 text-sm text-muted-foreground">
                Keine freigegebene, verifizierte Verbindung zur Mandatshistorie
                vorhanden. Gleiche Namen oder Nummern allein werden nicht als
                Identität behandelt.
              </p>
            )
          )}
        </details>
      </>}
      <StatusNote>
        Die Zeitreihe zeigt vorhandene Messwerte, keine automatisch
        vergleichbaren historischen Gebiete. Grenzänderungen und Datenstände
        stehen im Wahljahrvergleich. Bis 2021 Einzelstimme; ab 2026{" "}
        {ballotLabels[ballotForComparison(2026, ballot)]}. AfD vor 2013 und
        andere fehlende Werte bleiben unbekannt.
      </StatusNote>
    </div>
  );
}
function signed(value: number | null | undefined, maximumFractionDigits = 2): string {
  return value == null
    ? "—"
    : `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE", { maximumFractionDigits })}`;
}
function differenceCell(value: number | null) {
  if (value === null || value === 0) return signed(value);
  const color = value < 0 ? "text-red-700" : "text-blue-700";
  return <span className={`font-medium ${color}`}>{signed(value)}</span>;
}
function valueFor(row: ComparisonValue, metric: Metric): number | null {
  return metric === "votes"
    ? row.voteDelta
    : metric === "relative"
      ? row.relativeSwing
      : row.swing;
}
function AtlasPanel({
  year,
  ballot,
  party,
  years,
  set,
  open,
  split,
}: Props & {
  set: SetParam;
  open: (district: number) => void;
  split: boolean;
}) {
  const [params] = useSearchParams();
  const requested = Number(params.get("analysisBefore"));
  const beforeYear = split
    ? year
    : years.includes(requested) && requested !== year
      ? requested
      : years.find((y) => y < year) ||
        years
          .slice()
          .sort((a, b) => a - b)
          .find((y) => y !== year) ||
        year;
  const afterYear = year;
  const beforeBallot = split
    ? "first"
    : ballotForComparison(beforeYear, ballot);
  const afterBallot = split ? "second" : ballotForComparison(afterYear, ballot);
  const chosen: string[] = (params.get("analysisParties") || party)
    .split(",")
    .filter((p) => parties.some((knownParty) => knownParty === p));
  const splitParty = parties.find((p) => p === params.get("splitParty")) ?? chosen[0] ?? party;
  const selectedParties = split ? [splitParty] : chosen.length ? [...new Set(chosen)] : [party];
  const [mapParty, setMapParty] = useState(selectedParties[0]);
  const activeMapParty = split ? splitParty : selectedParties.includes(mapParty)
    ? mapParty
    : selectedParties[0];
  const rawMetric = params.get("analysisMetric");
  const metric: Metric =
    rawMetric === "votes" || (!split && rawMetric === "relative")
      ? rawMetric
      : "pp";
  const allowUnknown = params.get("allowUnknownBoundaries") === "1",
    allowMixed = params.get("allowMixedStatus") === "1";
  const query = useComparison(
    beforeYear,
    afterYear,
    beforeBallot,
    afterBallot,
    selectedParties,
  );
  const candidates = useVerifiedCandidates(year, split ? selectedParties : []);
  const data = query.data;
  const rows = useMemo(() => {
    if (!data) return [];
    return selectedParties
      .flatMap((p) =>
        Array.from({ length: 70 }, (_, i) => {
          const n = i + 1;
          const before = data.results.find(
              (r) =>
                r.year === beforeYear &&
                r.ballot === beforeBallot &&
                r.party === p &&
                r.district_number === n,
            ),
            after = data.results.find(
              (r) =>
                r.year === afterYear &&
                r.ballot === afterBallot &&
                r.party === p &&
                r.district_number === n,
            );
          if (split) {
            const diff = firstSecondDifference(before, after);
            const stateFirst = data.state.find((s) => s.ballot === "first" && s.party === p);
            const stateSecond = data.state.find((s) => s.ballot === "second" && s.party === p);
            const stateSwing = subtract(stateFirst?.share, stateSecond?.share);
            const sameRelease =
              !!before?.data_release &&
              before.data_release === stateFirst?.data_release &&
              before.data_release === stateSecond?.data_release;
            const relativeSwing = sameRelease ? subtract(diff.pp, stateSwing) : null;
            const warnings: string[] = [];
            if (!diff.compatible) {
              warnings.push("Erst-/Zweitstimmen fehlen oder haben unterschiedliche Datenstände.");
            } else {
              if (before?.preliminary) warnings.push("Vorläufige Ergebnisse.");
              if (diff.pp !== null && relativeSwing === null)
                warnings.push("Für die Landesdifferenz fehlen vergleichbare Landeswerte.");
            }
            return {
              districtNumber: n,
              districtName: after?.district_name || before?.district_name || `Wahlkreis ${n}`,
              party: p,
              before,
              after,
              swing: diff.pp,
              voteDelta: diff.votes,
              stateSwing,
              relativeSwing,
              comparable: diff.compatible,
              warnings,
            } satisfies ComparisonValue;
          }
          const comparison = compareDistrict({
            before,
            after,
            stateBefore: data.state.find(
              (s) =>
                s.year === beforeYear &&
                s.ballot === beforeBallot &&
                s.party === p,
            ),
            stateAfter: data.state.find(
              (s) =>
                s.year === afterYear &&
                s.ballot === afterBallot &&
                s.party === p,
            ),
            versionBefore: data.versions.find(
              (v) => v.year === beforeYear && v.district_number === n,
            ),
            versionAfter: data.versions.find(
              (v) => v.year === afterYear && v.district_number === n,
            ),
            allowUnknownBoundaries: allowUnknown,
            allowMixedStatus: allowMixed,
          });
          return {
            ...comparison,
            districtNumber: n,
            districtName: comparison.districtName || `Wahlkreis ${n}`,
            party: p,
          };
        }),
      )
      .sort(
        (a, b) =>
          (valueFor(b, metric) ?? -Infinity) -
          (valueFor(a, metric) ?? -Infinity),
      );
  }, [
    data,
    beforeYear,
    afterYear,
    beforeBallot,
    afterBallot,
    selectedParties.join(","),
    split,
    allowUnknown,
    allowMixed,
    metric,
  ]);
  const versions = useMemo(
    () => data?.versions.filter((v) => v.year === afterYear) || [],
    [data, afterYear],
  );
  const mapValues = useMemo(
    () =>
      new Map(
        rows
          .filter((r) => r.party === activeMapParty)
          .map((r) => [r.districtNumber, valueFor(r, metric)]),
      ),
    [rows, activeMapParty, metric],
  );
  const toggleParty = (p: string) => {
    const next = selectedParties.includes(p)
      ? selectedParties.filter((x) => x !== p)
      : [...selectedParties, p];
    if (next.length) set("analysisParties", next.join(","));
  };
  const unit = metric === "votes" ? "Stimmen" : "Prozentpunkte";
  return (
    <div className="space-y-4">
      {!split && (
        <h2 className="text-xl font-semibold">
          Veränderungsatlas {beforeYear} → {afterYear}
        </h2>
      )}
      <AnalysisControls placement={split ? "filters" : "panel"}>
        {!split && (
          <Selection
            id="atlas-before"
            label="Ausgangswahl"
            value={String(beforeYear)}
            onChange={(v) => set("analysisBefore", v)}
          >
            {years
              .filter((y) => y !== year)
              .map((y) => (
                <option key={y}>{y}</option>
              ))}
          </Selection>
        )}
        <Selection
          id="atlas-metric"
          label="Kennzahl"
          value={metric}
          onChange={(v) => set("analysisMetric", v)}
        >
          <option value="pp">{split ? "Anteilsdifferenz (Prozentpunkte)" : "Anteilsänderung (%)"}</option>
          <option value="votes">Absolute Stimmendifferenz</option>
          {!split && (
            <option value="relative">Abweichung vom Landestrend (%)</option>
          )}
        </Selection>
      </AnalysisControls>
      {split && (
        <AnalysisControls>
          <fieldset className="flex min-w-0 flex-wrap gap-2">
            <legend className="mb-1 text-sm font-medium">Partei</legend>
            {parties.map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                className="rounded-full"
                variant={p === splitParty ? "default" : "outline"}
                aria-pressed={p === splitParty}
                onClick={() => set("splitParty", p)}
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full border border-black/15"
                  style={{ backgroundColor: getPartyColor(p) }}
                />
                {p}
              </Button>
            ))}
          </fieldset>
        </AnalysisControls>
      )}
      {!split && (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm font-medium">Parteien</legend>
          {parties.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={selectedParties.includes(p) ? "default" : "outline"}
              aria-pressed={selectedParties.includes(p)}
              onClick={() => toggleParty(p)}
            >
              {p}
            </Button>
          ))}
        </fieldset>
      )}
      {!split && (
        <>
          <StatusNote>
            Swing = neuer minus alter Anteil. Relativer Swing = Wahlkreis-Swing
            minus Landes-Swing. Unbekannte oder geänderte Zuschnitte und
            unterschiedliche Ergebnisstände werden nicht stillschweigend
            gleichgesetzt. Einzelstimme und Zweitstimme sind unterschiedliche
            Wahlsysteme. Waldshut 2006 bleibt ein rekonstruierter
            Vergleichswert.
          </StatusNote>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowUnknown}
                onChange={(e) =>
                  set("allowUnknownBoundaries", e.target.checked ? "1" : "0")
                }
              />
              Ungeprüfte Grenzen ausdrücklich einbeziehen (Warnung)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowMixed}
                onChange={(e) =>
                  set("allowMixedStatus", e.target.checked ? "1" : "0")
                }
              />
              Vorläufige/finale Werte ausdrücklich vergleichen (Warnung)
            </label>
          </div>
        </>
      )}
      <DataState
        loading={query.isLoading}
        error={query.error}
        empty={!data?.results.length}
        retry={() => void query.refetch()}
      >
        {split && (
          <DataTable
            whiteBackground
            headers={[
              "Landesvergleich",
              "Erstanteil",
              "Zweitanteil",
              "Differenz (Prozentpunkte)",
              "Stimmendifferenz",
            ]}
            rows={selectedParties.map((p) => {
              const a = data?.state.find(
                  (s) => s.party === p && s.ballot === "first",
                ),
                b = data?.state.find(
                  (s) => s.party === p && s.ballot === "second",
                );
              return [
                p,
                percent(a?.share),
                percent(b?.share),
                differenceCell(subtract(a?.share, b?.share)),
                differenceCell(subtract(a?.votes, b?.votes)),
              ];
            })}
          />
        )}
        {!split ? (
          <SwingAtlas
            rows={rows}
            versions={versions}
            beforeVersions={data?.versions.filter(v => v.year === beforeYear) ?? []}
            party={activeMapParty}
            parties={selectedParties}
            onPartyChange={setMapParty}
            metric={metric}
            beforeYear={beforeYear}
            afterYear={afterYear}
            beforeBallot={beforeBallot}
            afterBallot={afterBallot}
            onOpenDistrict={open}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [
                  "Positive Veränderungen",
                  rows.filter((r) => (valueFor(r, metric) ?? 0) > 0).length,
                ],
                [
                  "Negative Veränderungen",
                  rows.filter((r) => (valueFor(r, metric) ?? 0) < 0).length,
                ],
                [
                  "Unbekannt / ausgeschlossen",
                  rows.filter((r) => valueFor(r, metric) === null).length,
                ],
              ].map(([title, count]) => (
                <Card key={title}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">{title}</p>
                    <p className="text-xl font-semibold">{count}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="min-w-0">
                <AnalysisMap
                  versions={versions}
                  values={mapValues}
                  hideOfficialGeometryLink
                  label={unit}
                  onOpenDistrict={open}
                />
              </div>
              <SplitDistrictChart rows={rows} metric={metric} />
            </div>
            <StatusNote>
              Erststimmenanteil minus Zweitstimmenanteil: beide Anteile haben ihren
              eigenen Nenner gültiger Stimmen. Die Kennzahl beschreibt eine
              Differenz; sie zählt keine individuellen Stimmensplittings und weist
              keinen kausalen Kandidateneffekt nach. Namen erscheinen nur aus
              verifizierten amtlichen Kandidaturdaten.
            </StatusNote>
            <section aria-labelledby="split-districts" className="min-w-0">
              <h3 id="split-districts" className="mb-2 font-semibold">Wahlkreisergebnisse</h3>
              <p className="mb-3 text-sm text-muted-foreground">
                Die Landesdifferenz ist der Erst- minus Zweitstimmenabstand im Wahlkreis abzüglich desselben Abstands im Land.
              </p>
              {candidates.isLoading && <p role="status" className="mb-2 text-sm">Direktkandidaturen werden geladen …</p>}
              {candidates.error && <p role="status" className="mb-2 text-sm">Direktkandidaturen konnten nicht geladen werden.</p>}
              <TooltipProvider>
                <DataTable
                  whiteBackground
                  headers={[
                    "Nr.",
                    "Wahlkreis",
                    "Partei",
                    "Erstanteil",
                    "Zweitanteil",
                    "Erststimmen",
                    "Zweitstimmen",
                    `Erst − Zweit (${unit})`,
                    "Landesdifferenz (Prozentpunkte)",
                    "Direktkandidatur",
                    "Hinweise",
                  ]}
                  sortableColumns={[0, 1, 2, 3, 4, 5, 6, 7, 8]}
                  sortValues={rows.map((r) => [
                    r.districtNumber,
                    r.districtName,
                    r.party,
                    r.before?.share ?? null,
                    r.after?.share ?? null,
                    r.before?.votes ?? null,
                    r.after?.votes ?? null,
                    valueFor(r, metric),
                    r.relativeSwing,
                  ])}
                  rows={rows.map((r) => [
                    r.districtNumber,
                    <button
                      className="text-left underline"
                      onClick={() => open(r.districtNumber)}
                    >
                      {r.districtName}
                    </button>,
                    r.party,
                    percent(r.before?.share),
                    percent(r.after?.share),
                    number(r.before?.votes),
                    number(r.after?.votes),
                    differenceCell(valueFor(r, metric)),
                    differenceCell(r.relativeSwing),
                    <span className="whitespace-nowrap">
                      {candidates.data?.find(
                        (c) => c.district_number === r.districtNumber && c.party === r.party,
                      )?.candidate_name || "—"}
                    </span>,
                    <InfoTooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label={`Hinweise zu ${r.districtName}`} className="rounded-sm focus-visible:outline focus-visible:outline-ring">
                          <Info aria-hidden="true" className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <Portal>
                        <TooltipContent className="max-w-xs">
                          {r.warnings.join(" ") || "Gleicher geprüfter Zuschnitt."}
                        </TooltipContent>
                      </Portal>
                    </InfoTooltip>,
                  ])}
                />
              </TooltipProvider>
            </section>
          </>
        )}
      </DataState>
    </div>
  );
}

function SplitDistrictChart({ rows, metric }: { rows: ComparisonValue[]; metric: Metric }) {
  const unit = metric === "votes" ? "Stimmen" : "Prozentpunkte";
  const data = rows
    .flatMap((row) => {
      const difference = valueFor(row, metric);
      return difference === null
        ? []
        : [{ district: row.districtNumber, name: row.districtName, difference }];
    })
    .sort((a, b) => b.difference - a.difference || a.district - b.district)
    .slice(0, 10);
  const maximum = Math.max(1, ...data.map(({ difference }) => Math.abs(difference)));

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Differenz je Wahlkreis</CardTitle>
        <p className="text-sm text-muted-foreground">Höchste Erst- minus Zweitstimmendifferenzen · {unit}</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine vergleichbaren Wahlkreisdifferenzen verfügbar.</p>
        ) : (
          <div className="h-[360px] md:h-[420px]">
            <ResponsiveContainer>
              <BarChart data={data} layout="vertical" margin={{ right: 20 }}>
                <XAxis type="number" domain={[-maximum, maximum]} tickFormatter={(value: number) => signed(value)} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={142} interval={0} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [`${signed(value)} ${unit}`, "Differenz"]} />
                <Bar dataKey="difference" isAnimationActive={false}>
                  {data.map(({ district, difference }) => (
                    <Cell key={district} fill={difference < 0 ? "#b91c1c" : "#2563a6"} />
                  ))}
                </Bar>
                <ReferenceLine x={0} stroke="#334155" strokeWidth={1.5} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
