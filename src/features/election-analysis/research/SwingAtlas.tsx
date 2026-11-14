import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, Selection, StatusNote } from "../shared";
import { ballotLabels, exportAnalysisCsv, number, percent } from "../model";
import type { Ballot } from "../types";
import { AnalysisMap } from "./AnalysisMap";
import { atlasRankings, atlasRows, atlasScale, atlasValue } from "./atlasModel";
import type { ComparisonValue, DistrictVersion, Metric } from "./types";

const signed = (value: number | null | undefined) =>
  value == null
    ? "—"
    : `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })}`;

export function SwingAtlas({
  rows,
  versions,
  party,
  parties,
  onPartyChange,
  metric,
  beforeYear,
  afterYear,
  beforeBallot,
  afterBallot,
  onOpenDistrict,
}: {
  rows: ComparisonValue[];
  versions: DistrictVersion[];
  party: string;
  parties: string[];
  onPartyChange: (party: string) => void;
  metric: Metric;
  beforeYear: number;
  afterYear: number;
  beforeBallot: Ballot;
  afterBallot: Ballot;
  onOpenDistrict: (district: number) => void;
}) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [automatic, setAutomatic] = useState(false);
  const detail = useRef<HTMLDivElement>(null);
  const requested = Number(params.get("atlasDistrict"));
  const selected =
    Number.isInteger(requested) && requested >= 1 && requested <= 70
      ? requested
      : null;
  const select = useCallback(
    (district: number) => {
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set("atlasDistrict", String(district));
        return next;
      });
      requestAnimationFrame(() => {
        detail.current?.focus({ preventScroll: true });
        if (window.matchMedia("(max-width: 1023px)").matches)
          detail.current?.scrollIntoView({
            behavior: "instant",
            block: "nearest",
          });
      });
    },
    [setParams],
  );
  const partyRows = useMemo(() => atlasRows(rows, party, ""), [rows, party]);
  const filtered = useMemo(
    () => atlasRows(rows, party, search),
    [rows, party, search],
  );
  const visible = useMemo(
    () => new Set(filtered.map((r) => r.districtNumber)),
    [filtered],
  );
  const values = useMemo(
    () =>
      new Map(partyRows.map((r) => [r.districtNumber, atlasValue(r, metric)])),
    [partyRows, metric],
  );
  const rankings = atlasRankings(filtered, metric);
  const current = partyRows.find((r) => r.districtNumber === selected);
  const unit = metric === "votes" ? "Stimmen" : "PP";
  const relative = metric === "relative";
  const land = partyRows[0]?.stateSwing ?? null;
  const scale = automatic
    ? Math.max(1, ...partyRows.map((r) => Math.abs(atlasValue(r, metric) ?? 0)))
    : atlasScale(metric);
  const stateMarker = metric === "pp" ? land : metric === "relative" ? 0 : null;
  const rankingList = (items: ComparisonValue[], empty: string) =>
    items.length ? (
      <ol className="space-y-1">
        {items.map((r) => (
          <li key={r.districtNumber}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded p-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => select(r.districtNumber)}
            >
              <span>
                {r.districtNumber} · {r.districtName}
              </span>
              <strong className="whitespace-nowrap tabular-nums">
                {signed(atlasValue(r, metric))} {unit}
              </strong>
            </button>
          </li>
        ))}
      </ol>
    ) : (
      <p className="text-sm text-muted-foreground">{empty}</p>
    );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <Selection
          id="atlas-map-party"
          label="Partei für Karte und Tabelle"
          value={party}
          onChange={onPartyChange}
        >
          {parties.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Selection>
        <label
          className="flex flex-col gap-1 text-sm font-medium"
          htmlFor="atlas-search"
        >
          Wahlkreis suchen
          <input
            id="atlas-search"
            type="search"
            className="h-10 rounded-md border bg-white px-3 font-normal"
            placeholder="Name oder exakte Nummer …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={automatic}
            onChange={(e) => setAutomatic(e.target.checked)}
          />
          Automatische Farbskala
        </label>
        <Button
          variant="outline"
          disabled={!filtered.length}
          onClick={() =>
            exportAnalysisCsv(
              filtered.map((r) => ({
                Nummer: r.districtNumber,
                Wahlkreis: r.districtName,
                Partei: r.party,
                Ausgangsjahr: beforeYear,
                Zieljahr: afterYear,
                Stimmenart_A: ballotLabels[beforeBallot],
                Stimmenart_B: ballotLabels[afterBallot],
                Anteil_A: r.before?.share,
                Anteil_B: r.after?.share,
                Stimmen_A: r.before?.votes,
                Stimmen_B: r.after?.votes,
                Veraenderung_PP: r.swing,
                Stimmendifferenz: r.voteDelta,
                Landes_Swing_PP: r.stateSwing,
                Abweichung_Land_PP: r.relativeSwing,
                Vorlaeufig_A: r.before?.preliminary,
                Vorlaeufig_B: r.after?.preliminary,
                Datenstand_A: r.before?.data_release,
                Datenstand_B: r.after?.data_release,
                Kennzahl: metric,
                Kartenwert: atlasValue(r, metric),
                Hinweis: r.warnings.join(" "),
              })),
              `Swing-${party}-${beforeYear}-${afterYear}-Auswahl.csv`,
            )
          }
        >
          CSV: gefilterte Wahlkreise
        </Button>
      </div>
      <StatusNote>
        {beforeYear}: {ballotLabels[beforeBallot]} → {afterYear}:{" "}
        {ballotLabels[afterBallot]}.
        {beforeBallot !== afterBallot &&
          " Wahlrechtsänderung: Die Stimmenarten sind fachlich unterschiedlich; die Differenz beschreibt keine individuellen Wählerwechsel."}
        {partyRows.some((r) => r.before?.preliminary || r.after?.preliminary)
          ? " Enthält vorläufige Ergebnisse."
          : " Ergebnisstand je Wahlkreis im Detail."}
        {relative &&
          " Abweichung vom Landestrend wird nur bei gemeinsam bestätigten Landes- und Wahlkreisständen berechnet."}
      </StatusNote>
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-live="polite"
      >
        {[
          [`Landes-Swing ${party}`, `${signed(land)} PP`],
          [
            relative ? "Über / unter Landestrend" : "Zugewinne / Verluste",
            `${rankings.positive} / ${rankings.negative}`,
          ],
          ["Unverändert", rankings.unchanged],
          ["Unbekannt / ausgeschlossen", rankings.unknown],
        ].map(([title, value]) => (
          <Card key={title}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{title}</p>
              <p className="text-xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground" role="status">
        {filtered.length} von {partyRows.length} Wahlkreisen · Kennzahlen und
        Ranglisten beziehen sich auf die Suche; der Landes-Swing auf das gesamte
        Land.
      </p>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <AnalysisMap
          versions={versions}
          values={values}
          label={relative ? "PP gegenüber Landestrend" : unit}
          onOpenDistrict={select}
          scaleMax={scale}
          selectedDistrict={selected}
          visibleDistricts={visible}
          referenceValue={stateMarker}
          referenceLabel={relative ? "Landestrend" : "Landes-Swing"}
        />
        <div className="space-y-4">
          <div
            ref={detail}
            tabIndex={-1}
            className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Ausgewählter Wahlkreis"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {current
                    ? `${current.districtNumber} · ${current.districtName}`
                    : "Wahlkreis auswählen"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {current ? (
                  <>
                    <p className="text-sm">
                      {party} ·{" "}
                      {relative ? "Abweichung vom Landestrend" : "Veränderung"}
                    </p>
                    <p className="text-3xl font-bold tabular-nums">
                      {signed(atlasValue(current, metric))} {unit}
                    </p>
                    <dl className="space-y-2 text-sm">
                      {(
                        [
                          [beforeYear, beforeBallot, current.before],
                          [afterYear, afterBallot, current.after],
                        ] as const
                      ).map(([y, b, result]) => {
                        const r = result;
                        return (
                          <div key={String(y)}>
                            <dt className="font-medium">
                              {String(y)} · {ballotLabels[b]}
                            </dt>
                            <dd>
                              {percent(r?.share)} · {number(r?.votes)} Stimmen
                            </dd>
                            <dd className="text-xs text-muted-foreground">
                              {!r
                                ? "Ergebnis fehlt"
                                : `${r.preliminary ? "Vorläufig" : "Endgültig"} · Datenstand: ${r.data_release || "nicht dokumentiert"}`}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                    <p className="text-sm">
                      Stimmendifferenz: {signed(current.voteDelta)} Stimmen
                      <br />
                      Landes-Swing: {signed(current.stateSwing)} PP
                      <br />
                      Abweichung: {signed(current.relativeSwing)} PP
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {current.warnings.join(" ") ||
                        "Gleicher geprüfter Zuschnitt."}
                    </p>
                    {current.before?.notes && (
                      <p className="text-xs text-muted-foreground">
                        {beforeYear}: {current.before.notes}
                      </p>
                    )}
                    {current.after?.notes && (
                      <p className="text-xs text-muted-foreground">
                        {afterYear}: {current.after.notes}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => onOpenDistrict(current.districtNumber)}
                    >
                      Wahlkreis-Steckbrief öffnen
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Wählen Sie einen Wahlkreis in Karte, Rangliste oder Tabelle.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stärkste Veränderungen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-medium">
                  {relative
                    ? "Am stärksten über Landestrend"
                    : "Größte Zugewinne"}
                </h3>
                {rankingList(
                  rankings.gains,
                  relative
                    ? "Keine positiven Abweichungen."
                    : "Keine Zugewinne in dieser Auswahl.",
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">
                  {relative
                    ? "Am stärksten unter Landestrend"
                    : "Größte Verluste"}
                </h3>
                {rankingList(
                  rankings.losses,
                  relative
                    ? "Keine negativen Abweichungen."
                    : "Keine Verluste in dieser Auswahl.",
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <h3 className="font-medium">Wahlkreise · {party}</h3>
      {filtered.length ? (
        <DataTable
          headers={[
            "Nr.",
            "Wahlkreis",
            `${beforeYear} Anteil`,
            `${afterYear} Anteil`,
            `${beforeYear} Stimmen`,
            `${afterYear} Stimmen`,
            `${relative ? "Abweichung vom Landestrend" : "Veränderung"} (${unit})`,
            "Landes-Swing PP",
            "Hinweise",
          ]}
          sortableColumns={[0, 1, 2, 3, 4, 5, 6, 7]}
          sortValues={filtered.map((r) => [
            r.districtNumber,
            r.districtName,
            r.before?.share ?? null,
            r.after?.share ?? null,
            r.before?.votes ?? null,
            r.after?.votes ?? null,
            atlasValue(r, metric),
            r.stateSwing,
          ])}
          rows={filtered.map((r) => [
            r.districtNumber,
            <button
              type="button"
              aria-pressed={selected === r.districtNumber}
              className={`rounded p-1 text-left underline focus-visible:ring-2 focus-visible:ring-ring ${selected === r.districtNumber ? "bg-muted font-bold" : ""}`}
              onClick={() => select(r.districtNumber)}
            >
              {r.districtName}
            </button>,
            percent(r.before?.share),
            percent(r.after?.share),
            number(r.before?.votes),
            number(r.after?.votes),
            signed(atlasValue(r, metric)),
            signed(r.stateSwing),
            r.warnings.join(" ") || "Gleicher geprüfter Zuschnitt",
          ])}
        />
      ) : (
        <p className="rounded-lg border p-4 text-sm">
          Kein Wahlkreis gefunden. Prüfen Sie Name oder Nummer.
        </p>
      )}
      <p className="text-xs">
        <a
          className="underline"
          href="https://www.statistik-bw.de/staat-und-gesellschaft/wahlen/detail/landtagswahl-am-8-maerz-2026-informationsangebot-des-statistischen-landesamtes-baden-wuerttemberg/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Amtliches Informationsangebot zur Landtagswahl 2026
        </a>
      </p>
      <StatusNote>
        Quelle: amtliche Wahlergebnisse des Statistischen Landesamts
        Baden-Württemberg, importierte Ergebnisstände. Stimmenveränderung =
        tatsächliche Parteistimmen der Zielwahl minus Parteistimmen der
        Ausgangswahl. Fehlende Zahlen bleiben unbekannt.{" "}
        {automatic
          ? "Die Farbskala passt sich der ausgewählten Partei an."
          : `Feste Farbskala: −${number(scale)} bis +${number(scale)} ${unit}; Werte außerhalb sind farblich gesättigt, die genauen Zahlen bleiben sichtbar.`}
      </StatusNote>
    </div>
  );
}
