import { AnalysisControls } from "../AnalysisToolbar";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isRecord } from "@/utils/typeSafety";
import {
  DataState,
  DataTable,
  Selection,
  StatusNote,
  chartColor,
} from "../shared";
import { ballotLabels, number, parties, percent } from "../model";
import type { Ballot } from "../types";
import { ballotForComparison } from "./calculations";
import { useTurnoutComparison } from "./hooks";
import { decomposeDistricts, turnoutChanges, turnoutCorrelation } from "./turnoutModel";
import { ChartExport } from "../ChartExport";

const signed = (n: number | null | undefined) =>
  n == null
    ? "—"
    : `${n > 0 ? "+" : ""}${n.toLocaleString("de-DE", { maximumFractionDigits: 2 })}`;
export default function TurnoutComparison({
  year,
  ballot,
  party,
  years,
  onOpenDistrict,
}: {
  year: number;
  ballot: Ballot;
  party: string;
  years: number[];
  onOpenDistrict: (n: number) => void;
}) {
  const [params, setParams] = useSearchParams();
  const set = (key: string, value: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old);
      next.set(key, value);
      return next;
    });
  const requested = Number(params.get("analysisBefore"));
  const beforeYear =
    years.includes(requested) && requested !== year
      ? requested
      : years.find((y) => y < year) ||
        years
          .slice()
          .sort((a, b) => a - b)
          .find((y) => y !== year) ||
        year;
  const beforeBallot = ballotForComparison(beforeYear, ballot),
    afterBallot = ballotForComparison(year, ballot);
  const allowUnknown = params.get("allowUnknownBoundaries") === "1",
    allowMixed = params.get("allowMixedStatus") === "1";
  const search = params.get("analysisSearch") || "",
    table = params.get("turnoutTable") === "values" ? "values" : "changes";
  const query = useTurnoutComparison(
    beforeYear,
    year,
    beforeBallot,
    afterBallot,
    party,
  );
  const rows = useMemo(
    () =>
      query.data
        ? turnoutChanges(query.data, {
            beforeYear,
            afterYear: year,
            ballot,
            party,
            allowUnknownBoundaries: allowUnknown,
            allowMixedStatus: allowMixed,
          }).filter((r) =>
            `${r.districtNumber} ${r.districtName}`
              .toLocaleLowerCase("de-DE")
              .includes(search.toLocaleLowerCase("de-DE")),
          )
        : [],
    [
      query.data,
      beforeYear,
      year,
      ballot,
      party,
      allowUnknown,
      allowMixed,
      search,
    ],
  );
  const points = useMemo(
    () => rows.filter((r) => r.turnoutDelta != null && r.shareDelta != null),
    [rows],
  );
  const correlation = useMemo(() => turnoutCorrelation(rows), [rows]);
  const decomposition = useMemo(() => decomposeDistricts(rows), [rows]);
  const citation = {
    title: `Beteiligung und ${party}-Anteil ${beforeYear} → ${year}`,
    values: rows
      .filter((row) => row.before?.turnout != null && row.after?.turnout != null)
      .slice(0, 8)
      .map((row) => `${row.districtName} ${percent(row.before?.turnout)} → ${percent(row.after?.turnout)}`),
    source: "get_analysis_turnout_comparison",
    release: rows.find((row) => row.after?.data_release)?.after?.data_release ?? null,
    url: typeof window === "undefined" ? null : window.location.href,
  };
  const openPoint = (entry: unknown) => {
    const value =
      isRecord(entry) && isRecord(entry.payload) ? entry.payload : entry;
    if (isRecord(value) && typeof value.districtNumber === "number")
      onOpenDistrict(value.districtNumber);
  };

  if (years.length < 2)
    return (
      <p className="rounded-lg border p-4">
        Für den Vergleich werden mindestens zwei veröffentlichte Wahlen
        benötigt.
      </p>
    );
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        Wahlbeteiligung und Stimmenentwicklung {beforeYear} → {year}
      </h2>
      <AnalysisControls>
        <Selection
          id="turnout-before"
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
        <Selection
          id="turnout-party"
          label="Partei"
          value={party}
          onChange={(v) => set("analysisParty", v)}
        >
          {parties.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Selection>
      </AnalysisControls>
      <StatusNote>
        Verglichen werden {ballotLabels[beforeBallot]} {beforeYear} und{" "}
        {ballotLabels[afterBallot]} {year}. Beteiligung zählt Wählende einmal je
        Wahlkreis; Erst- und Zweitstimmen werden nicht addiert. Unterschiede der
        Beteiligung und Parteianteile werden als Differenz der Prozentwerte (%) angegeben, etwa 25 % − 20 % = +5 %. Ein Zusammenhang
        zwischen Wahlkreisen belegt weder individuelle Wählerbewegungen noch
        eine Ursache. Die rechnerische Zerlegung von Stimmenänderungen ist für
        eine spätere methodische Freigabe vorbereitet.
      </StatusNote>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-2 font-medium">Vergleichbarkeit</legend>
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
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="turnout-search" className="text-sm font-medium">
            Wahlkreis filtern
          </label>
          <Input
            id="turnout-search"
            value={search}
            onChange={(e) => set("analysisSearch", e.target.value)}
            placeholder="Nummer oder Wahlkreisname …"
          />
        </div>
        <Selection
          id="turnout-table"
          label="Tabelle"
          value={table}
          onChange={(v) => set("turnoutTable", v)}
        >
          <option value="changes">Veränderungen</option>
          <option value="values">Grunddaten beider Wahlen</option>
        </Selection>
      </div>
      <DataState
        loading={query.isLoading}
        error={query.error}
        empty={!rows.length}
        retry={() => void query.refetch()}
      >
        <p className="text-sm" role="status">
          {points.length} vollständige Paare im Diagramm ·{" "}
          {correlation.excluded} ohne vollständiges Vergleichspaar ·{" "}
          {
            rows.filter((r) => r.before?.preliminary || r.after?.preliminary)
              .length
          }{" "}
          mit vorläufigen Beteiligungsdaten
        </p>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Beteiligung und {party}-Anteil
            </CardTitle>
          </CardHeader>
          <CardContent>
            {points.length ? (
              <ChartExport title={citation.title} filename={`beteiligung-${party}-${beforeYear}-${year}`} citation={citation}>
              <div
                className="h-80 sm:h-96"
                role="img"
                aria-label="Ein Punkt je Wahlkreis: Änderung der Wahlbeteiligung auf der X-Achse, Änderung des Parteianteils auf der Y-Achse. Dieselben Werte stehen in der Tabelle."
              >
                <ResponsiveContainer>
                  <ScatterChart
                    margin={{ top: 15, right: 25, bottom: 40, left: 15 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="turnoutDelta"
                      name="Änderung Beteiligung"
                      unit=" %"
                      label={{
                        value: "Änderung Wahlbeteiligung (%)",
                        position: "bottom",
                        offset: 20,
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="shareDelta"
                      name="Änderung Parteianteil"
                      unit=" %"
                    />
                    <ReferenceLine x={0} stroke="#7d8175" />
                    <ReferenceLine y={0} stroke="#7d8175" />
                    <Tooltip
                      content={({ active, payload }) => {
                        const value: unknown = payload?.[0]?.payload;
                        if (!active || !isRecord(value)) return null;
                        return (
                          <div className="rounded border bg-popover p-3 text-sm shadow">
                            <p className="font-medium">
                              {String(value.districtNumber)}:{" "}
                              {String(value.districtName)}
                            </p>
                            <p>
                              Beteiligung:{" "}
                              {signed(
                                typeof value.turnoutDelta === "number"
                                  ? value.turnoutDelta
                                  : null,
                              )}{" "}
                              %
                            </p>
                            <p>
                              {party}:{" "}
                              {signed(
                                typeof value.shareDelta === "number"
                                  ? value.shareDelta
                                  : null,
                              )}{" "}
                              %
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Scatter
                      name="Wahlkreise"
                      data={points}
                      fill={chartColor(party)}
                      onClick={openPoint}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              </ChartExport>
            ) : (
              <p className="rounded-lg border p-4 text-sm">
                Keine vollständigen, zugelassenen Vergleichspaare. Ungeprüfte
                Grenzen oder unterschiedliche Datenstände können Vergleiche
                ausschließen; die Gründe stehen in der Tabelle.
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Deskriptiver Zusammenhang (Pearson-r):{" "}
              {correlation.value == null
                ? "nicht berechenbar"
                : correlation.value.toLocaleString("de-DE", {
                    maximumFractionDigits: 3,
                  })}{" "}
              · n = {correlation.pairs}. {correlation.reason} Kein
              Kausalnachweis; Filter und Ausschlüsse verändern die Auswahl.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Stimmenzerlegung {party}: {beforeYear} → {year}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Symmetrische Shapley-Zerlegung über alle 24 Reihenfolgen der vier
              Faktoren Wahlberechtigte × Beteiligungsquote × Gültigkeitsquote ×
              Parteianteil. Die vier Beiträge summieren sich exakt zur Änderung
              der {party}-Stimmen; es gibt keine willkürliche Reihenfolge.
            </p>
            <p className="text-sm" role="status">
              {decomposition.included} Wahlkreise einbezogen · {decomposition.excluded}{" "}
              ohne vollständige, gemeinsam bestätigte Nenner ausgeschlossen.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {([
                ["Wahlberechtigte", decomposition.total.eligible],
                ["Beteiligung", decomposition.total.participation],
                ["Gültigkeitsquote", decomposition.total.validity],
                ["Parteianteil", decomposition.total.partyShare],
                ["Gesamt", decomposition.total.total],
              ] as const).map(([title, value]) => (
                <div key={title} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{title}</p>
                  <p className={`text-xl font-semibold tabular-nums ${value < 0 ? "text-destructive" : ""}`}>
                    {number(Math.round(value))}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Einheit: Parteistimmen. Beiträge sind rechnerische Anteile, keine
              kausalen oder individuellen Effekte; Wahlberechtigte, Beteiligung und
              Gültigkeit wirken gemeinsam. Fehlende Nenner bleiben ausgeschlossen
              und werden nicht als null Stimmen ergänzt.
            </p>
          </CardContent>
        </Card>
        {table === "changes" ? (
          <DataTable
            key="changes"
            headers={[
              "Nr.",
              "Wahlkreis",
              "Beteiligung Δ %",
              "Wahlberechtigte Δ",
              "Wählende Δ",
              "Gültige Stimmen Δ",
              `${party}-Stimmen Δ`,
              `${party}-Anteil Δ %`,
              "Hinweise",
            ]}
            sortableColumns={[0, 1, 2, 3, 4, 5, 6, 7]}
            sortValues={rows.map((r) => [
              r.districtNumber,
              r.districtName,
              r.turnoutDelta,
              r.eligibleDelta,
              r.votersDelta,
              r.validDelta,
              r.votesDelta,
              r.shareDelta,
            ])}
            rows={rows.map((r) => [
              r.districtNumber,
              <button
                className="text-left underline"
                onClick={() => onOpenDistrict(r.districtNumber)}
              >
                {r.districtName}
              </button>,
              signed(r.turnoutDelta),
              signed(r.eligibleDelta),
              signed(r.votersDelta),
              signed(r.validDelta),
              signed(r.votesDelta),
              signed(r.shareDelta),
              r.warnings.join(" ") ||
                "Gleicher geprüfter Zuschnitt und passende Datenstände",
            ])}
          />
        ) : (
          <DataTable
            key="values"
            headers={[
              "Nr.",
              "Wahlkreis",
              `${beforeYear} Beteiligung`,
              `${year} Beteiligung`,
              `${beforeYear} Berechtigte`,
              `${year} Berechtigte`,
              `${beforeYear} Wählende`,
              `${year} Wählende`,
              `${beforeYear} gültige Stimmen`,
              `${year} gültige Stimmen`,
              `${beforeYear} ${party}-Stimmen`,
              `${year} ${party}-Stimmen`,
              `${beforeYear} ${party}-Anteil`,
              `${year} ${party}-Anteil`,
              "Hinweise",
            ]}
            sortableColumns={Array.from({ length: 14 }, (_, i) => i)}
            sortValues={rows.map((r) => [
              r.districtNumber,
              r.districtName,
              r.before?.turnout ?? null,
              r.after?.turnout ?? null,
              r.before?.eligible ?? null,
              r.after?.eligible ?? null,
              r.before?.voters ?? null,
              r.after?.voters ?? null,
              r.before?.valid_votes ?? null,
              r.after?.valid_votes ?? null,
              r.resultBefore?.votes ?? null,
              r.resultAfter?.votes ?? null,
              r.resultBefore?.share ?? null,
              r.resultAfter?.share ?? null,
            ])}
            rows={rows.map((r) => [
              r.districtNumber,
              r.districtName,
              percent(r.before?.turnout),
              percent(r.after?.turnout),
              number(r.before?.eligible),
              number(r.after?.eligible),
              number(r.before?.voters),
              number(r.after?.voters),
              number(r.before?.valid_votes),
              number(r.after?.valid_votes),
              number(r.resultBefore?.votes),
              number(r.resultAfter?.votes),
              percent(r.resultBefore?.share),
              percent(r.resultAfter?.share),
              r.warnings.join(" ") || "Geprüft vergleichbar",
            ])}
          />
        )}
      </DataState>
    </div>
  );
}
