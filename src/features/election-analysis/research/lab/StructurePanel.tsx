import { useMemo, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataState, DataTable, Selection, StatusNote } from "../../shared";
import { exportAnalysisCsv, parties } from "../../model";
import type { Ballot } from "../../types";
import { useLabDistrictData } from "./hooks";
import { researchDataset } from "./data";
import { linearModel } from "./regression";
import { parseStructureCsv } from "./structureCsv";
import { attempt, format, useLabParams } from "./shared";
export default function StructurePanel({
  year,
  ballot,
  party,
}: {
  year: number;
  ballot: Ballot;
  party: string;
}) {
  const { params, set } = useLabParams(),
    query = useLabDistrictData(year, ballot, party);
  const [source, setSource] = useState(""),
    [definition, setDefinition] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [fileError, setFileError] = useState("");
  const [uploaded, setUploaded] = useState<
    | (ReturnType<typeof parseStructureCsv> & { name: string; sha256: string })
    | null
  >(null);
  const request = useRef(0);
  const variable = uploaded?.fields.includes(
    params.get("structureVariable") || "",
  )
    ? params.get("structureVariable")!
    : uploaded?.fields[0] || "";
  const data = useMemo(
    () => researchDataset(query.data, year, ballot, [party]),
    [query.data, year, ballot, party],
  );
  const points = useMemo(
    () =>
      data.rows.flatMap((r) => {
        const x = uploaded?.rows.find((s) => s.number === r.number)?.values[
            variable
          ],
          y = r.shares[party];
        return x == null || y == null
          ? []
          : [{ number: r.number, name: r.name, x, y }];
      }),
    [data, uploaded, variable, party],
  );
  const sourceValid =
    attempt(() => {
      const u = new URL(source);
      if (u.protocol !== "https:")
        throw new Error("HTTPS-Quelle erforderlich.");
      return true;
    }).value === true;
  const permitted =
    !!uploaded && sourceValid && definition.trim().length > 0 && confirmed;
  const fitted = useMemo(
    () =>
      permitted
        ? attempt(() => linearModel(points))
        : { value: null, error: null },
    [points, permitted],
  );
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Regionale Strukturmodelle</h3>
      <StatusNote>
        Einfaktorielle lineare Regression mit Achsenabschnitt, keine
        Kontrollvariablen und kein Kausalnachweis. Amtliche Strukturdaten müssen
        zusätzlich eingelesen werden; es werden keine Werte geschätzt oder
        ergänzt. Bezirkszuschnitt und Definition müssen zum ausgewählten
        Wahljahr passen. Eingaben bleiben lokal in dieser Ansicht, ohne
        Speicherung in der Wahldatenbank. Ein Wechsel der Ansicht verwirft die
        lokale Datei.
      </StatusNote>
      <p className="text-sm">
        CSV mit district_number, year und ein bis sechs numerischen
        Merkmalsspalten. Eine Zeile je Wahlkreis, maximal 70 Zeilen / 2 MB;
        leere Zellen bleiben unbekannt, Dezimalpunkt oder Dezimalkomma ohne
        Tausendertrennzeichen.
      </p>
      <label className="block text-sm">
        Strukturdaten einlesen
        <Input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const id = ++request.current,
              file = e.target.files?.[0];
            setUploaded(null);
            setConfirmed(false);
            setFileError("");
            if (!file) return;
            try {
              if (file.size > 2_000_000)
                throw new Error("Datei ist größer als 2 MB.");
              const buffer = await file.arrayBuffer(),
                parsed = parseStructureCsv(
                  new TextDecoder("utf-8", { fatal: true }).decode(buffer),
                  year,
                ),
                hash = await crypto.subtle.digest("SHA-256", buffer);
              if (id !== request.current) return;
              setUploaded({
                ...parsed,
                name: file.name,
                sha256: Array.from(new Uint8Array(hash), (v) =>
                  v.toString(16).padStart(2, "0"),
                ).join(""),
              });
            } catch (error) {
              if (id === request.current)
                setFileError(
                  error instanceof Error
                    ? error.message
                    : "Datei konnte nicht gelesen werden.",
                );
            }
          }}
        />
      </label>
      {fileError && <p role="alert">{fileError}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          Amtliche Quellenadresse
          <Input
            type="url"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setConfirmed(false);
            }}
          />
        </label>
        <label className="text-sm">
          Definition und Einheit des gewählten Merkmals
          <Input
            value={definition}
            onChange={(e) => {
              setDefinition(e.target.value);
              setConfirmed(false);
            }}
            placeholder="z. B. Arbeitslosenquote, Prozent"
          />
        </label>
      </div>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Ich habe amtliche Herkunft, Bezugsjahr, Kennzahl und Wahlkreiszuschnitt
        selbst geprüft. Die App hat diese externe Quelle nicht bestätigt.
      </label>
      <div className="flex flex-wrap gap-3">
        <Selection
          id="structure-variable"
          label="Strukturmerkmal X"
          value={variable}
          onChange={(v) => {
            set("structureVariable", v);
            setDefinition("");
            setConfirmed(false);
          }}
        >
          {uploaded?.fields.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </Selection>
        <Selection
          id="structure-party"
          label="Parteianteil Y"
          value={party}
          onChange={(v) => set("analysisParty", v)}
        >
          {parties.map((p) => (
            <option key={p} disabled={p === "AfD" && year < 2013}>
              {p}
              {p === "AfD" && year < 2013
                ? " (vor Parteigründung unbekannt)"
                : ""}
            </option>
          ))}
        </Selection>
      </div>
      <DataState
        loading={query.isLoading}
        error={query.error}
        empty={!query.data}
        retry={() => void query.refetch()}
      >
        {!permitted ? (
          <p className="rounded border p-3 text-sm">
            Bitte Datei, Quelle, Definition und Zuschnittprüfung ergänzen.{" "}
            {points.length} vollständige Datenpaare gefunden.
          </p>
        ) : fitted.error ? (
          <p role="status">{fitted.error}</p>
        ) : (
          fitted.value && (
            <>
              <p className="text-sm">
                n = {fitted.value.n} · {70 - fitted.value.n} ausgeschlossen ·{" "}
                {data.rows.filter((r) => r.preliminary).length} Wahlkreise mit
                vorläufiger Grundlage. Modell: Anteil ={" "}
                {format(fitted.value.intercept)} +{" "}
                {format(fitted.value.slope, 4)} × X. R² ={" "}
                {format(fitted.value.rSquared, 3)} · RMSE ={" "}
                {format(fitted.value.rmse)} PP · Leave-one-out-RMSE ={" "}
                {format(fitted.value.looRmse)} PP ({fitted.value.looPairs}{" "}
                Paare).
              </p>
              <StatusNote>
                Leave-one-out lässt jeweils einen Wahlkreis weg; räumlich
                benachbarte Gebiete sind dadurch nicht unabhängig. Keine
                räumliche/zeitliche Validierung, keine Signifikanz- oder
                Prognoseaussage. Residuen und Cook-Distanzen helfen, auffällige
                Beobachtungen zu erkennen. Bei perfekter Anpassung ist die
                Cook-Distanz unbekannt. Aus Wahlkreisdaten darf nicht auf
                individuelles Wahlverhalten geschlossen werden.
              </StatusNote>
              <div
                className="h-80"
                role="img"
                aria-label="Strukturmerkmal gegen Parteianteil, Punkte je Wahlkreis; genaue Werte in der Tabelle"
              >
                <ResponsiveContainer>
                  <ScatterChart
                    margin={{ top: 15, right: 20, bottom: 25, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="x" name={variable} />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name={`${party}-Anteil`}
                      unit=" %"
                    />
                    <Tooltip />
                    <Scatter data={points} fill="#55794a" name="Wahlkreise" />
                    <ReferenceLine
                      segment={[
                        {
                          x: Math.min(...points.map((p) => p.x)),
                          y:
                            fitted.value.intercept +
                            fitted.value.slope *
                              Math.min(...points.map((p) => p.x)),
                        },
                        {
                          x: Math.max(...points.map((p) => p.x)),
                          y:
                            fitted.value.intercept +
                            fitted.value.slope *
                              Math.max(...points.map((p) => p.x)),
                        },
                      ]}
                      stroke="#946439"
                      ifOverflow="extendDomain"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  exportAnalysisCsv(
                    fitted.value!.residuals.map((r) => ({
                      ...r,
                      Wahljahr: year,
                      Partei: party,
                      Merkmal: variable,
                      Definition: definition,
                      Quelle: source,
                      Datei: uploaded?.name,
                      SHA256: uploaded?.sha256,
                      R_Quadrat: fitted.value?.rSquared,
                      LOO_RMSE: fitted.value?.looRmse,
                      Quellenpruefung:
                        "Vom Nutzer bestätigt; nicht extern verifiziert",
                      Ausgangshinweis: data.rows.find(
                        (d) => d.number === r.number,
                      )?.notes,
                      Vorlaeufig: data.rows.find((d) => d.number === r.number)
                        ?.preliminary,
                    })),
                    `Exploratives-Strukturmodell-${year}.csv`,
                  )
                }
              >
                Modell, Residuen und Quelle exportieren
              </Button>
              <DataTable
                headers={[
                  "Nr.",
                  "Wahlkreis",
                  variable,
                  `${party} %`,
                  "Modellwert",
                  "Residuum PP",
                  "Hebelwert",
                  "Cook-Distanz",
                ]}
                sortableColumns={[0, 1, 2, 3, 4, 5, 6, 7]}
                sortValues={fitted.value.residuals.map((r) => [
                  r.number,
                  r.name,
                  r.x,
                  r.y,
                  r.predicted,
                  r.residual,
                  r.leverage,
                  r.cooksDistance,
                ])}
                rows={fitted.value.residuals.map((r) => [
                  r.number,
                  r.name,
                  format(r.x),
                  format(r.y),
                  format(r.predicted),
                  format(r.residual),
                  format(r.leverage, 3),
                  format(r.cooksDistance, 3),
                ])}
              />
            </>
          )
        )}
      </DataState>
    </div>
  );
}
