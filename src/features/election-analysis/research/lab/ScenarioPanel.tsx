import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataState, DataTable, Selection, StatusNote } from "../../shared";
import { exportAnalysisCsv } from "../../model";
import type { Ballot } from "../../types";
import { useLabDistrictData } from "./hooks";
import { AnalysisMap } from "../AnalysisMap";
import { researchDataset } from "./data";
import { simulateShares } from "./scenarios";
import { attempt, format, labNumber, useLabParams } from "./shared";
export default function ScenarioPanel({
  year,
  ballot,
  onOpenDistrict,
}: {
  year: number;
  ballot: Ballot;
  onOpenDistrict: (n: number) => void;
}) {
  const { params, set } = useLabParams();
  const query = useLabDistrictData(year, ballot);
  const data = useMemo(
    () => researchDataset(query.data, year, ballot),
    [query.data, year, ballot],
  );
  const deltas = Object.fromEntries(
    data.parties.map((p) => [p, labNumber(params, `scenarioDelta_${p}`, 0)]),
  );
  const localNumber = labNumber(params, "scenarioDistrict", 0),
    localParty = data.parties.includes(params.get("scenarioLocalParty") || "")
      ? params.get("scenarioLocalParty")!
      : data.parties[0];
  const localDelta = labNumber(params, "scenarioLocalDelta", 0);
  const simulated = useMemo(
    () =>
      attempt(() =>
        simulateShares(
          data.rows,
          data.parties,
          deltas,
          localNumber
            ? { district: localNumber, party: localParty, delta: localDelta }
            : undefined,
        ),
      ),
    [data, JSON.stringify(deltas), localNumber, localParty, localDelta],
  );
  const mapParty = data.parties.includes(params.get("scenarioMapParty") || "")
    ? params.get("scenarioMapParty")!
    : data.parties[0];
  const values = useMemo(
    () =>
      new Map(
        (simulated.value?.rows || []).map((r) => [
          r.number,
          r.shares[mapParty] -
            (data.rows.find((d) => d.number === r.number)?.shares[mapParty] ||
              0),
        ]),
      ),
    [simulated.value, mapParty, data],
  );
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Hypothetisches Szenariolabor</h3>
      <StatusNote>
        Keine Wahlprognose. Ausgangspunkt sind die 70 Wahlkreise der gewählten
        Wahl und Stimmenart im selben gespeicherten Datenstand. Die Landesbasis
        wird daraus mit gültigen Stimmen gewichtet berechnet; ein möglicherweise
        anders datiertes Landesergebnis wird nicht beigemischt. Angenommene
        Änderungen gelten in Prozentpunkten für jeden Wahlkreis. Die
        Restkategorie umfasst alle weiteren Parteien. Anteile außerhalb 0–100
        werden durch eine dokumentierte Projektion korrigiert; dadurch kann die
        erreichte Landesveränderung von der Annahme abweichen. Gültige Stimmen
        und Beteiligung bleiben rechnerisch konstant.
      </StatusNote>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {data.parties.map((p) => (
          <label key={p} className="text-sm">
            {p}: Änderung PP
            <Input
              type="number"
              step="0.1"
              value={params.get(`scenarioDelta_${p}`) ?? "0"}
              onChange={(e) => set(`scenarioDelta_${p}`, e.target.value)}
            />
          </label>
        ))}
      </div>
      <details className="rounded border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Zusätzliche regionale Annahme
        </summary>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Selection
            id="scenario-local-district"
            label="Wahlkreis"
            value={String(localNumber)}
            onChange={(v) => set("scenarioDistrict", v)}
          >
            <option value="0">Keine regionale Abweichung</option>
            {data.rows.map((r) => (
              <option key={r.number} value={r.number}>
                {r.number}: {r.name}
              </option>
            ))}
          </Selection>
          <Selection
            id="scenario-local-party"
            label="Partei"
            value={localParty}
            onChange={(v) => set("scenarioLocalParty", v)}
          >
            {data.parties.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Selection>
          <label className="text-sm">
            Zusätzliche Änderung PP
            <Input
              type="number"
              step="0.1"
              value={params.get("scenarioLocalDelta") ?? "0"}
              onChange={(e) => set("scenarioLocalDelta", e.target.value)}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Eine ausdrücklich gewählte regionale Abweichung; Gegenbuchung in der
          Restkategorie. Keine automatischen regionalen Wählerbewegungen.
        </p>
      </details>
      <DataState
        loading={query.isLoading}
        error={query.error}
        empty={!query.data}
        retry={() => void query.refetch()}
      >
        {simulated.error ? (
          <p role="status" className="rounded border p-3">
            {simulated.error}{" "}
            {data.excluded.length > 0 &&
              `${data.excluded.length} Wahlkreise ohne vollständige Grundlage.`}
          </p>
        ) : (
          simulated.value && (
            <>
              <p className="text-sm">
                {simulated.value.adjusted} Wahlkreise mit korrigierten Anteilen
                · {data.rows.filter((r) => r.preliminary).length} vorläufige
                Ausgangswerte.
              </p>
              <DataTable
                headers={[
                  "Kategorie",
                  "Landesbasis %",
                  "Angenommener Anteil %",
                  "Rechnerisch erreicht %",
                  "Erreichte Änderung PP",
                ]}
                rows={[...data.parties, "REST"].map((p) => [
                  p === "REST" ? "Weitere Parteien" : p,
                  format(simulated.value!.baseline[p]),
                  format(simulated.value!.target[p]),
                  format(simulated.value!.achieved[p]),
                  format(
                    simulated.value!.achieved[p] - simulated.value!.baseline[p],
                  ),
                ])}
              />
              <StatusNote>
                Die Projektion minimiert die quadrierten Abstände zu den
                angenommenen Anteilen unter den Bedingungen Anteil ≥ 0 und Summe
                = 100. Keine Partei wird stillschweigend aus der Restkategorie
                entfernt. Aus Anteilen allein werden keine tatsächlichen
                Direktmandate oder Sitze berechnet: vollständige Kandidaturen
                und ein geprüftes Wahlrechtsmodell je Periode fehlen. Auch
                theoretische Sitzprognosen bleiben deshalb deaktiviert.
              </StatusNote>
              <Button
                variant="outline"
                onClick={() =>
                  exportAnalysisCsv(
                    simulated.value!.rows.map((r) => ({
                      Nummer: r.number,
                      Wahlkreis: r.name,
                      Wahljahr: year,
                      Stimmenart: ballot,
                      Methode:
                        "Hypothetischer uniformer Swing mit Simplex-Projektion",
                      Annahmen_PP: JSON.stringify(deltas),
                      Regionale_Annahme: localNumber
                        ? JSON.stringify({
                            district: localNumber,
                            party: localParty,
                            delta: localDelta,
                          })
                        : "",
                      Ausgangshinweis: r.notes,
                      Vorlaeufig: r.preliminary,
                      Datenstand: r.release,
                      Korrigiert: r.adjusted,
                      ...Object.fromEntries(
                        [...data.parties, "REST"].flatMap((p) => [
                          [
                            `${p}_Basis`,
                            data.rows.find((d) => d.number === r.number)
                              ?.shares[p],
                          ],
                          [`${p}_Szenario`, r.shares[p]],
                        ]),
                      ),
                    })),
                    `Hypothetisches-Szenario-${year}.csv`,
                  )
                }
              >
                Szenario und Annahmen exportieren
              </Button>
              <Selection
                id="scenario-map-party"
                label="Veränderung in der Karte"
                value={mapParty}
                onChange={(v) => set("scenarioMapParty", v)}
              >
                {data.parties.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Selection>
              <AnalysisMap
                versions={query.data?.versions || []}
                values={values}
                label="PP (hypothetisch)"
                onOpenDistrict={onOpenDistrict}
              />
              <DataTable
                headers={[
                  "Nr.",
                  "Wahlkreis",
                  ...data.parties,
                  "Rest",
                  "Korrigiert",
                ]}
                sortableColumns={[
                  0,
                  1,
                  ...data.parties.map((_, i) => i + 2),
                  data.parties.length + 2,
                ]}
                sortValues={simulated.value.rows.map((r) => [
                  r.number,
                  r.name,
                  ...data.parties.map((p) => r.shares[p]),
                  r.shares.REST,
                ])}
                rows={simulated.value.rows.map((r) => [
                  r.number,
                  r.name,
                  ...data.parties.map((p) => format(r.shares[p])),
                  format(r.shares.REST),
                  r.adjusted ? "Ja" : "Nein",
                ])}
              />
            </>
          )
        )}
      </DataState>
    </div>
  );
}
