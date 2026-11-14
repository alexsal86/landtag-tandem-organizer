import ResearchLab from "./lab/ResearchLab";
import MandateAnalysis from "./MandateAnalysis";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataState,
  DataTable,
  Selection,
  StatusNote,
  chartColor,
  PartyLabel,
} from "../shared";
import {
  ballotLabels,
  exportAnalysisCsv,
  number,
  parties,
  percent,
} from "../model";
import type { Ballot } from "../types";
import {
  useComparison,
  useDistrictHistory,
  useDistrictSeries,
  useDistrictVersions,
  useQualityData,
  useVerifiedCandidates,
} from "./hooks";
import {
  ballotForComparison,
  compareDistrict,
  firstSecondDifference,
  subtract,
  uniqueTurnout,
  validateElectionData,
} from "./calculations";
import type { ComparisonValue, Metric } from "./types";
import TurnoutComparison from "./TurnoutComparison";
import { AnalysisMap } from "./AnalysisMap";

type Props = {
  section: "profile" | "swing" | "split" | "quality" | "turnout-trend" | "mandates" | "research";
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
        const next = new URLSearchParams(previous);
        next.set("analysisSection", "profile");
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
  if (props.section === "profile")
    return <DistrictProfile {...props} district={district} set={set} />;
  if (props.section === "turnout-trend") return <TurnoutComparison {...props} onOpenDistrict={open} />;
  if (props.section === "research") return <ResearchLab {...props} onOpenDistrict={open}/>;
  if (props.section === "mandates") return <MandateAnalysis />;
  if (props.section === "quality") return <QualityPanel year={props.year} />;
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
  const query = useDistrictSeries(district, years);
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useDistrictHistory(district, year, historyOpen);
  const [params] = useSearchParams();
  const requestedBefore = Number(params.get("analysisBefore"));
  const beforeYear =
    years.includes(requestedBefore) && requestedBefore !== year
      ? requestedBefore
      : years.find((y) => y < year) || years.slice().sort((a, b) => a - b).find((y) => y !== year) || year;
  const metric = params.get("profileMetric") || "share";
  const data = query.data;
  const results = data?.results || [];
  const orderedYears = years.slice().sort((a, b) => a - b);
  const selection = orderedYears.map((y, index) => ({
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
  const totals = uniqueTurnout(
    (data?.turnout || []).filter(
      (r) => r.ballot === ballotForComparison(r.year, ballot),
    ),
  ).sort((a, b) => a.year - b.year);
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
    versions.data?.find((v) => v.district_number === district)?.district_name ||
    data?.versions.find((v) => v.year === year)?.district_name ||
    `Wahlkreis ${district}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
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
          <option value="pp">Veränderung zur Vorwahl (PP)</option>
          <option value="deltaVotes">Stimmendifferenz zur Vorwahl</option>
        </Selection>
        <Button
          variant="outline"
          disabled={!results.length}
          onClick={() =>
            exportAnalysisCsv(
              results.map((r) => ({
                Wahljahr: r.year,
                Stimmenart: ballotLabels[r.ballot],
                Nummer: district,
                Wahlkreis: r.district_name,
                Partei: r.party,
                Stimmen: r.votes,
                Anteil: r.share,
                Vorlaeufig: r.preliminary,
                Datenstand: r.data_release,
                Hinweis: r.notes,
              })),
              `Wahlkreis-${district}-Zeitreihe.csv`,
            )
          }
        >
          Zeitreihe exportieren
        </Button>
      </div>
      <h2 className="text-xl font-semibold">
        {district}: {name}
      </h2>
      <StatusNote>
        Die Zeitreihe zeigt vorhandene Messwerte, keine automatisch
        vergleichbaren historischen Gebiete. Grenzänderungen und Datenstände
        stehen im Vergleich unten. Bis 2021 Einzelstimme; ab 2026{" "}
        {ballotLabels[ballotForComparison(2026, ballot)]}. AfD vor 2013 und
        andere fehlende Werte bleiben unbekannt.
      </StatusNote>
      <DataState
        loading={query.isLoading}
        error={query.error}
        empty={!results.length}
        retry={() => void query.refetch()}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Parteientwicklung 2006–2026
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="h-80"
              role="img"
              aria-label="Wahlkreis-Zeitreihe; Messwerte in der Tabelle"
            >
              <ResponsiveContainer>
                <LineChart data={selection}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis
                    unit={
                      metric === "share"
                        ? " %"
                        : metric === "pp"
                          ? " PP"
                          : undefined
                    }
                  />
                  <Tooltip />
                  <Legend />
                  {parties.map((p) => (
                    <Line
                      key={p}
                      dataKey={p}
                      stroke={chartColor(p)}
                      connectNulls={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <DataTable
          headers={["Wahljahr", ...parties, "Stimmenart / Status"]}
          rows={selection.map((row) => [
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
            "Änderung PP",
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
                  `${m.original_mandate || m.mandate_type}${m.entry_type === "succession" ? " · nachgerückt" : ""}`,
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
      </DataState>
    </div>
  );
}
function signed(value: number | null | undefined): string {
  return value == null
    ? "—"
    : `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })}`;
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
    ? 2026
    : years.includes(requested) && requested !== year
      ? requested
      : years.find((y) => y < year) || years.slice().sort((a, b) => a - b).find((y) => y !== year) || year;
  const afterYear = split ? 2026 : year;
  const beforeBallot = split
    ? "first"
    : ballotForComparison(beforeYear, ballot);
  const afterBallot = split ? "second" : ballotForComparison(afterYear, ballot);
  const chosen = (params.get("analysisParties") || party)
    .split(",")
    .filter((p) => parties.includes(p));
  const selectedParties = chosen.length ? [...new Set(chosen)] : [party];
  const [mapParty, setMapParty] = useState(selectedParties[0]);
  const activeMapParty = selectedParties.includes(mapParty)
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
  const candidates = useVerifiedCandidates(2026, split ? selectedParties : []);
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
            return {
              districtNumber: n,
              districtName:
                after?.district_name ||
                before?.district_name ||
                `Wahlkreis ${n}`,
              party: p,
              before,
              after,
              swing: diff.pp,
              voteDelta: diff.votes,
              stateSwing: subtract(
                data.state.find((s) => s.ballot === "first" && s.party === p)
                  ?.share,
                data.state.find((s) => s.ballot === "second" && s.party === p)
                  ?.share,
              ),
              relativeSwing: null,
              comparable: diff.compatible,
              warnings: diff.compatible
                ? before?.preliminary
                  ? ["Vorläufige Ergebnisse."]
                  : []
                : [
                    "Erst-/Zweitstimmen fehlen oder haben unterschiedliche Datenstände.",
                  ],
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
  const unit = metric === "votes" ? "Stimmen" : "PP";
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        {split
          ? "Erst- minus Zweitstimmen 2026"
          : `Veränderungsatlas ${beforeYear} → ${afterYear}`}
      </h2>
      <div className="flex flex-wrap items-end gap-3">
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
          <option value="pp">Prozentpunkte</option>
          <option value="votes">Absolute Stimmendifferenz</option>
          {!split && (
            <option value="relative">Abweichung vom Landestrend (PP)</option>
          )}
        </Selection>
        <Button
          variant="outline"
          disabled={!rows.length}
          onClick={() =>
            exportAnalysisCsv(
              rows.map((r) => ({
                Nummer: r.districtNumber,
                Wahlkreis: r.districtName,
                Partei: r.party,
                Ausgangsjahr: beforeYear,
                Zieljahr: afterYear,
                Ausgangsstimmenart: ballotLabels[beforeBallot],
                Zielstimmenart: ballotLabels[afterBallot],
                Anteil_A: r.before?.share,
                Anteil_B: r.after?.share,
                Stimmen_A: r.before?.votes,
                Stimmen_B: r.after?.votes,
                Prozentpunktdifferenz: r.swing,
                Stimmendifferenz: r.voteDelta,
                Landestrend: r.stateSwing,
                Relativer_Swing: r.relativeSwing,
                Vergleichbar: r.comparable,
                Hinweis: r.warnings.join(" "),
              })),
              split
                ? "Erst-Zweitstimmen-2026.csv"
                : `Swing-${beforeYear}-${afterYear}.csv`,
            )
          }
        >
          CSV exportieren
        </Button>
      </div>
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
      {split ? (
        <StatusNote>
          Erststimmenanteil minus Zweitstimmenanteil: beide Anteile haben ihren
          eigenen Nenner gültiger Stimmen. Die Kennzahl beschreibt eine
          Differenz; sie zählt keine individuellen Stimmensplittings und weist
          keinen kausalen Kandidateneffekt nach. Namen erscheinen nur aus
          verifizierten amtlichen Kandidaturdaten.
        </StatusNote>
      ) : (
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
        empty={!rows.length}
        retry={() => void query.refetch()}
      >
        {split && (
          <DataTable
            headers={[
              "Landesvergleich",
              "Erstanteil",
              "Zweitanteil",
              "Differenz PP",
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
                signed(subtract(a?.share, b?.share)),
                signed(subtract(a?.votes, b?.votes)),
              ];
            })}
          />
        )}
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
        <Selection
          id="map-party"
          label="Partei für die Karte"
          value={activeMapParty}
          onChange={setMapParty}
        >
          {selectedParties.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Selection>
        <AnalysisMap
          versions={versions}
          values={mapValues}
          label={unit}
          onOpenDistrict={open}
        />
        <DataTable
          headers={[
            "Nr.",
            "Wahlkreis",
            "Partei",
            split ? "Erstanteil" : `${beforeYear} Anteil`,
            split ? "Zweitanteil" : `${afterYear} Anteil`,
            split ? "Erststimmen" : `${beforeYear} Stimmen`,
            split ? "Zweitstimmen" : `${afterYear} Stimmen`,
            `${split ? "Erst − Zweit" : "Veränderung"} (${unit})`,
            split ? "Landesdifferenz PP" : "Landes-Swing PP",
            ...(split ? ["Verifizierte Direktkandidatur"] : []),
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
            r.stateSwing,
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
            signed(valueFor(r, metric)),
            signed(r.stateSwing),
            ...(split
              ? [
                  candidates.data?.find(
                    (c) =>
                      c.district_number === r.districtNumber &&
                      c.party === r.party,
                  )?.candidate_name || "Nicht verifiziert verfügbar",
                ]
              : []),
            r.warnings.join(" ") || "Gleicher geprüfter Zuschnitt",
          ])}
        />
      </DataState>
    </div>
  );
}
function QualityPanel({ year }: { year: number }) {
  const query = useQualityData(year);
  const data = query.data;
  const issues = useMemo(
    () =>
      data ? validateElectionData(data.results, data.turnout, data.state) : [],
    [data],
  );
  const unknown = data?.versions.filter((v) => !v.identity_key).length || 0;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Datenprüfung {year}</h2>
      <StatusNote>
        Prüft die ausgewählte Wahl, keine vollständigen Datenbestände anderer
        Jahre. Ein fehlerfreier Zahlenabgleich ersetzt keine Bestätigung von
        Quellen, Grenzen oder Kandidaturvollständigkeit.
      </StatusNote>
      <DataState
        loading={query.isLoading}
        error={query.error}
        empty={!data}
        retry={() => void query.refetch()}
      >
        <p className="text-sm">
          {issues.filter((i) => i.severity === "error").length} Zahlenfehler ·{" "}
          {issues.filter((i) => i.severity === "warning").length} Statushinweise
          · {unknown} nicht verifizierte Zuschnittidentitäten
        </p>
        <Button
          variant="outline"
          onClick={() => {
            if (data) exportAnalysisCsv(issues, `Datenprüfung-${year}.csv`);
          }}
        >
          Prüfbericht exportieren
        </Button>
        {issues.length ? (
          <DataTable
            headers={[
              "Typ",
              "Code",
              "Wahlkreis",
              "Partei",
              "Stimmenart",
              "Meldung",
            ]}
            rows={issues.map((i) => [
              i.severity,
              i.code,
              number(i.district),
              i.party || "—",
              i.ballot ? ballotLabels[i.ballot] : "—",
              i.message,
            ])}
          />
        ) : (
          <p className="rounded-lg border p-4 text-sm">
            Keine Unstimmigkeiten in den geprüften Zahlenregeln gefunden.
          </p>
        )}
      </DataState>
    </div>
  );
}
