import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DataState, DataTable, Selection, StatusNote } from "../../shared";
import { ballotForComparison } from "../calculations";
import { useLabDistrictData } from "./hooks";
import { exportAnalysisCsv } from "../../model";
import type { Ballot } from "../../types";
import { researchDataset } from "./data";
import { clusterDistricts, typologyFeatures } from "./clustering";
import { attempt, format, useLabParams } from "./shared";
export default function TypologyPanel({
  year,
  ballot,
  years,
  onOpenDistrict,
}: {
  year: number;
  ballot: Ballot;
  years: number[];
  onOpenDistrict: (n: number) => void;
}) {
  const { params, set } = useLabParams();
  const requested = Number(params.get("typologyBefore")),
    beforeYear =
      years.includes(requested) && requested !== year ? requested : 0;
  const allowMixed = params.get("researchMixedStatus") === "1";
  const method = params.get("typologyMethod") === "ward" ? "ward" : "kmeans";
  const k = Number(params.get("clusterCount")) || 3,
    allowUnknown = params.get("researchUnknownBoundaries") === "1";
  const current = useLabDistrictData(year, ballot),
    before = useLabDistrictData(
      beforeYear,
      ballotForComparison(beforeYear, ballot),
    );
  const data = useMemo(
    () => researchDataset(current.data, year, ballot),
    [current.data, year, ballot],
  );
  const old = useMemo(
    () =>
      beforeYear
        ? researchDataset(
            before.data,
            beforeYear,
            ballotForComparison(beforeYear, ballot),
          )
        : null,
    [before.data, beforeYear, ballot],
  );
  const features = useMemo(
    () => typologyFeatures(data, old, allowUnknown, allowMixed),
    [data, old, allowUnknown, allowMixed],
  );
  const clustered = useMemo(
    () => attempt(() => clusterDistricts(features.rows, k, method)),
    [features, k, method],
  );
  const rows = features.rows.map((r, i) => ({
    ...r,
    group: clustered.value ? clustered.value.labels[i] + 1 : null,
  }));
  const excluded = [...data.excluded, ...features.excluded];
  const groups = Array.from({ length: Math.min(6, Math.max(2, k)) }, (_, i) => {
    const group = rows.filter((r) => r.group === i + 1);
    return {
      group: i + 1,
      count: group.length,
      ...Object.fromEntries(
        [...features.parties, "REST", "Beteiligung"].map((p) => [
          p,
          group.length
            ? group.reduce((s, r) => s + r.raw[p], 0) / group.length
            : null,
        ]),
      ),
    };
  });
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Explorative Wahlkreis-Typologie</h3>
      <div className="flex flex-wrap items-end gap-3">
        <Selection
          id="cluster-before"
          label="Zeitfenster"
          value={String(beforeYear)}
          onChange={(v) => set("typologyBefore", v)}
        >
          <option value="0">Nur die ausgewählte Wahl</option>
          {years
            .filter((y) => y !== year)
            .map((y) => (
              <option key={y} value={y}>
                {y} und {year}
              </option>
            ))}
        </Selection>
        <Selection
          id="cluster-method"
          label="Verfahren"
          value={method}
          onChange={(v) => set("typologyMethod", v)}
        >
          <option value="kmeans">k-means++</option>
          <option value="ward">Hierarchisch (Ward)</option>
        </Selection>
        <Selection
          id="cluster-k"
          label="Gruppen"
          value={String(k)}
          onChange={(v) => set("clusterCount", v)}
        >
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </Selection>
      </div>
      <StatusNote>
        Explorative Gruppen, keine objektiven politischen Gebietstypen.
        k-means++ mit 8 festen Startwerten; ausgewählt wird die kleinste
        Fehlerquadratsumme; alternativ hierarchische Ward-Gruppierung.
        Parteianteile einschließlich Rest werden wurzeltransformiert
        (Hellinger), Beteiligung und gegebenenfalls Swings ergänzen die
        Merkmale; anschließend Standardisierung je Merkmal. Gleiches Gewicht je
        Merkmal ist eine Modellannahme. Rest umfasst alle nicht einzeln
        verwendeten Parteien; AfD vor 2013 ist kein gemessener Nullwert und wird
        aus gemeinsamen Merkmalen ausgeschlossen. Gruppenmittel sind
        ungewichtete Wahlkreismittel, keine Landesergebnisse.
      </StatusNote>
      {(year === 2006 || beforeYear === 2006) && (
        <StatusNote>
          Waldshut 2006 enthält eine Rekonstruktion auf Zuschnitt 2011; dieser
          Sonderfall bleibt auch bei explorativen Vergleichen zu beachten.
        </StatusNote>
      )}
      {beforeYear > 0 && (
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowUnknown}
            onChange={(e) =>
              set("researchUnknownBoundaries", e.target.checked ? "1" : "0")
            }
          />
          Ungeprüfte Grenzen ausdrücklich explorativ einbeziehen; bestätigte
          Unterschiede bleiben ausgeschlossen
        </label>
      )}
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={allowMixed}
          onChange={(e) =>
            set("researchMixedStatus", e.target.checked ? "1" : "0")
          }
        />
        Unterschiedliche Ergebnisstände ausdrücklich explorativ einbeziehen
        (Warnung)
      </label>
      <DataState
        loading={current.isLoading || (!!beforeYear && before.isLoading)}
        error={current.error || before.error}
        empty={!current.data}
        retry={() =>
          void Promise.all([
            current.refetch(),
            ...(beforeYear ? [before.refetch()] : []),
          ])
        }
      >
        <p className="text-sm">
          {features.rows.length} verwendbare Wahlkreise · {excluded.length}{" "}
          ausgeschlossen ·{" "}
          {
            features.rows.filter(
              (r) => data.rows.find((d) => d.number === r.number)?.preliminary,
            ).length
          }{" "}
          vorläufig.{" "}
          {beforeYear > 0
            ? "Unterschiedliche Wahlsysteme und nur zwei Zeitpunkte; keine vollständige Langzeittypologie."
            : "Momentaufnahme der ausgewählten Wahl."}
        </p>
        {clustered.error ? (
          <p role="status" className="rounded border p-3 text-sm">
            {clustered.error}
          </p>
        ) : (
          <>
            <p className="text-sm">
              Silhouette: {format(clustered.value?.silhouette, 3)} · ARI
              k-means/Ward: {format(clustered.value?.methodAgreement, 3)} · ARI
              k-means-Startwerte: {format(clustered.value?.startAgreement, 3)} ·
              ARI über 12 Teilstichproben (80 %):{" "}
              {format(clustered.value?.resampleAgreement, 3)} ·{" "}
              {clustered.value?.failedResamples} nicht berechenbare
              Teilstichproben. Höhere Werte sprechen für klarere Trennung
              beziehungsweise stabilere Zuordnung; sie validieren keine
              politische Bedeutung.
            </p>
            <details className="rounded border p-3 text-xs">
              <summary className="cursor-pointer">
                Verwendete Merkmale und Methode
              </summary>
              <p className="mt-2">{features.features.join(" · ")}</p>
              <p>
                Standardisierung bleibt für alle Teilstichproben gleich. Die
                Teilstichprobenzuordnung wird über alle verwendeten Wahlkreise
                verglichen. Es handelt sich um Sensitivität, keine unabhängige
                Prognosevalidierung.
              </p>
            </details>
            <DataTable
              headers={[
                "Gruppe",
                "Wahlkreise",
                ...features.parties,
                "Rest",
                "Beteiligung",
              ]}
              rows={groups.map((g) => [
                g.group,
                g.count,
                ...[...features.parties, "REST", "Beteiligung"].map((p) =>
                  format((g as Record<string, number | null>)[p]),
                ),
              ])}
            />
            <Button
              variant="outline"
              onClick={() =>
                exportAnalysisCsv(
                  rows.map((r) => ({
                    Nummer: r.number,
                    Wahlkreis: r.name,
                    Gruppe: r.group,
                    Wahljahr: year,
                    Vergleichsjahr: beforeYear || null,
                    Gruppenzahl: k,
                    Methode: `Hellinger + Z-Standardisierung + ${method}`,
                    Merkmale: features.features.join("|"),
                    Silhouette: clustered.value?.silhouette,
                    Resampling_ARI: clustered.value?.resampleAgreement,
                    Ungepruefte_Grenzen: allowUnknown,
                    Gemischte_Staende: allowMixed,
                    Ausgangshinweis: data.rows.find(
                      (d) => d.number === r.number,
                    )?.notes,
                    Vergleichshinweis: old?.rows.find(
                      (d) => d.number === r.number,
                    )?.notes,
                    Vorlaeufig: data.rows.find((d) => d.number === r.number)
                      ?.preliminary,
                    ...r.raw,
                  })),
                  `Explorative-Gruppen-${year}.csv`,
                )
              }
            >
              Gruppen und Methodik exportieren
            </Button>
            <DataTable
              headers={["Nr.", "Wahlkreis", "Gruppe"]}
              sortableColumns={[0, 1, 2]}
              sortValues={rows.map((r) => [r.number, r.name, r.group])}
              rows={rows.map((r) => [
                r.number,
                <button
                  className="underline"
                  onClick={() => onOpenDistrict(r.number)}
                >
                  {r.name}
                </button>,
                r.group,
              ])}
            />
          </>
        )}
        {excluded.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm">
              Ausschlüsse anzeigen
            </summary>
            <DataTable
              headers={["Nr.", "Grund"]}
              rows={excluded.map((r) => [r.number, r.reason])}
            />
          </details>
        )}
      </DataState>
    </div>
  );
}
