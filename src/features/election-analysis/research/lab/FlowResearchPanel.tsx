import { AnalysisControls } from "../../AnalysisToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataState, DataTable, Selection, StatusNote } from "../../shared";
import { exportAnalysisCsv, number, parties } from "../../model";
import { useAnalysisRows } from "../../useElectionAnalysis";
import type { Ballot } from "../../types";
import { flowSensitivity } from "./scenarios";
import { format, labNumber, useLabParams } from "./shared";
export default function FlowResearchPanel({
  year,
  ballot,
  party,
}: {
  year: number;
  ballot: Ballot;
  party: string;
}) {
  const { params, set } = useLabParams(),
    query = useAnalysisRows("flows", year, ballot, party, "Insgesamt");
  const selected =
    query.data?.find((r) => r.partner === params.get("flowPartner")) ||
    query.data?.[0];
  const balance =
    selected?.balance ??
    (selected?.inflow != null && selected?.outflow != null
      ? selected.inflow - selected.outflow
      : null);
  const low = labNumber(params, "flowCounterLow", 0),
    high = labNumber(params, "flowCounterHigh", 10000),
    tolerance = labNumber(params, "flowTolerance", 0);
  const sensitivity = flowSensitivity(balance, low, high, tolerance);
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">
        Wählerwanderung: Annahmen und Sensitivität
      </h3>
      <AnalysisControls>
        <Selection
          id="research-flow-party"
          label="Zielpartei"
          value={party}
          onChange={(v) => set("analysisParty", v)}
        >
          {parties.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Selection>
      </AnalysisControls>
      <StatusNote>
        Alle vorhandenen Wanderungsdaten sind landesweite Modellschätzungen,
        keine beobachteten individuellen Wechsel. 2011 und 2021 enthalten
        Bruttoströme; 2016 und 2026 überwiegend beziehungsweise ausschließlich
        Salden. Ein Saldo bestimmt keine eindeutigen Gegenströme. Das Werkzeug
        erzeugt ausdrücklich angenommene Bruttoströme für eine einzelne
        Beziehung; es rekonstruiert keine Wahlkreiswanderung und keine
        konsistente Gesamtmatrix.
      </StatusNote>
      <DataState
        loading={query.isLoading}
        error={query.error}
        empty={!query.data?.length}
        retry={() => void query.refetch()}
      >
        <DataTable
          headers={[
            "Partner",
            "Modellierter Zustrom",
            "Modellierter Abstrom",
            "Modellierter Saldo",
            "Quellenhinweis",
          ]}
          rows={(query.data || []).map((r) => [
            r.partner,
            number(r.inflow),
            number(r.outflow),
            number(r.balance),
            r.notes || "Modellierte Landesdaten",
          ])}
        />
        <Selection
          id="research-flow-partner"
          label="Eine Beziehung auswählen"
          value={selected?.partner || ""}
          onChange={(v) => set("flowPartner", v)}
        >
          {query.data?.map((r) => (
            <option key={r.partner}>{r.partner}</option>
          ))}
        </Selection>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["flowCounterLow", "Angenommener Gegenstrom: Minimum", "0"],
            ["flowCounterHigh", "Angenommener Gegenstrom: Maximum", "10000"],
            ["flowTolerance", "Eigene Saldo-Sensitivität ± Personen", "0"],
          ].map(([key, label, fallback]) => (
            <label key={key} className="text-sm">
              {label}
              <Input
                type="number"
                min={0}
                step={1}
                value={params.get(key) ?? fallback}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <StatusNote>
          „Gegenstrom“ ist hier der kleinere der zwei hypothetischen
          Bruttoströme. Für Saldo s und Gegenstrom c gilt Zustrom = max(s, 0) +
          c, Abstrom = max(−s, 0) + c. Die Bandbreiten stammen ausschließlich
          aus deinen Annahmen. Sie sind keine statistischen Konfidenzintervalle.
          Einzelne Intervallgrenzen bilden keine gemeinsam geschätzte
          Wanderungsmatrix. Bereits vorhandene Bruttoschätzungen bleiben oben
          erhalten.
        </StatusNote>
        {!sensitivity ? (
          <p role="status">
            Saldo fehlt oder Annahmen sind ungültig. Minimum und Maximum müssen
            nichtnegative ganze Zahlen in aufsteigender Reihenfolge sein.
          </p>
        ) : (
          <>
            <DataTable
              headers={[
                "Hypothetische Kennzahl",
                "Minimum",
                "Maximum",
                "Beispiel bei abgerundetem mittleren Gegenstrom",
              ]}
              rows={[
                [
                  `Zustrom zu ${party}`,
                  format(sensitivity.inLow, 0),
                  format(sensitivity.inHigh, 0),
                  format(sensitivity.assumedIn, 0),
                ],
                [
                  `Abstrom von ${party}`,
                  format(sensitivity.outLow, 0),
                  format(sensitivity.outHigh, 0),
                  format(sensitivity.assumedOut, 0),
                ],
                [
                  "Saldo",
                  format(sensitivity.balanceLow, 0),
                  format(sensitivity.balanceHigh, 0),
                  format(balance, 0),
                ],
              ]}
            />
            <Button
              variant="outline"
              onClick={() =>
                exportAnalysisCsv(
                  [
                    {
                      Wahljahr: year,
                      Vorwahl: selected?.previous_year,
                      Zielpartei: party,
                      Partner: selected?.partner,
                      Modellierter_Saldo: balance,
                      Vorhandener_Zustrom: selected?.inflow,
                      Vorhandener_Abstrom: selected?.outflow,
                      Gegenstrom_Minimum: low,
                      Gegenstrom_Maximum: high,
                      Eigene_Saldo_Sensitivitaet: tolerance,
                      ...sensitivity,
                      Methodik:
                        "Hypothetische Einzelbeziehung; keine Konfidenzintervalle, keine lokalen oder individuellen Wechsel",
                      Quellenhinweis: selected?.notes,
                    },
                  ],
                  `Wanderung-Sensitivitaet-${party}-${year}.csv`,
                )
              }
            >
              Annahmen und Bandbreiten exportieren
            </Button>
          </>
        )}
      </DataState>
    </div>
  );
}
