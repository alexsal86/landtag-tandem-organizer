import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, Selection, StatusNote } from "../../shared";
import { exportAnalysisCsv } from "../../model";
import { isRecord } from "@/utils/typeSafety";
import { useFullState, useSavedScenario } from "../workspaceHooks";
import { SaveScenarioAction } from "../SaveScenarioAction";
import { attempt, format, labNumber, useLabParams } from "../lab/shared";
import { allocateBw2026 } from "./seats";
import {
  parseElectionFile,
  shiftElection,
  electionMandates,
} from "./electionFile";
import { BW_RULES_VERSION, type ElectionFile, type SeatInput } from "./types";
import {
  directTransferThreshold,
  officialStateParties,
  parsePartyArray,
  referenceComparison,
  secondVoteScenario,
  STATE_RELEASE,
  STATE_SOURCE,
} from "./model";
export default function SeatSimulator({ year }: { year: number }) {
  return year === 2026 ? (
    <Seat2026 />
  ) : (
    <StatusNote>
      Das implementierte Zweistimmen-Wahlrecht gilt nur für 2026. Bitte diese
      Wahl auswählen; frühere Wahlrechte werden nicht ersetzt.
    </StatusNote>
  );
}
function Seat2026() {
  const { params } = useLabParams(),
    [, setParams] = useSearchParams();
  const saved = useSavedScenario(params.get("savedScenario")),
    state = useFullState(params.get("savedScenario") ? 0 : 2026);
  const set = (key: string, value: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old);
      next.set(key, value);
      if (
        key === "seatBalancing" ||
        ["seatFirst_", "seatSecond_", "seatDirect_"].some((prefix) =>
          key.startsWith(prefix),
        )
      ) {
        next.delete("seatCorrections");
        next.delete("seatSpecialFirst");
      }
      return next;
    });
  const fileRequest = useRef(0);
  const [file, setFile] = useState<ElectionFile | null>(null),
    [fileError, setFileError] = useState("");
  const basis = useMemo(
    () =>
      attempt(() => {
        if (file)
          return {
            parties: file.parties,
            valid: file.validSecond,
            release: file.data_release,
            source: file.source_url,
            file,
          };
        if (params.get("savedScenario")) {
          if (!saved.data)
            throw new Error("Schnappschuss lädt oder ist nicht zugänglich.");
          if (
            saved.data.model_version !== BW_RULES_VERSION ||
            saved.data.year !== 2026 ||
            !isRecord(saved.data.input_snapshot)
          )
            throw new Error("Gespeichertes Modell passt nicht.");
          const snap = saved.data.input_snapshot;
          if (snap.file) {
            const input = parseElectionFile(snap.file);
            return {
              parties: input.parties,
              valid: input.validSecond,
              release: input.data_release,
              source: input.source_url,
              file: input,
            };
          }
          if (
            typeof snap.valid !== "number" ||
            !Number.isSafeInteger(snap.valid) ||
            snap.valid <= 0 ||
            typeof snap.source !== "string"
          )
            throw new Error("Schnappschuss unvollständig.");
          return {
            parties: parsePartyArray(snap.parties),
            valid: snap.valid,
            source: snap.source,
            release: saved.data.data_release,
            file: null,
          };
        }
        return {
          parties: officialStateParties(state.data || []),
          valid: 5375109,
          release: STATE_RELEASE,
          source: STATE_SOURCE,
          file: null,
        };
      }),
    [file, saved.data, state.data, params.get("savedScenario")],
  );
  const parties = basis.value?.parties || [];
  const balancing = parties.some(
    (p) => p.id === params.get("seatBalancing") && p.hasList,
  )
    ? params.get("seatBalancing")!
    : parties
        .filter((p) => p.hasList)
        .slice()
        .sort((a, b) => b.votes - a.votes)[0]?.id || "";
  const first = Object.fromEntries(
    parties.map((p) => [p.id, labNumber(params, `seatFirst_${p.id}`, 0)]),
  );
  const second = Object.fromEntries(
    parties
      .filter((p) => p.hasList && p.id !== balancing)
      .map((p) => [p.id, labNumber(params, `seatSecond_${p.id}`, 0)]),
  );
  const computed = useMemo(
    () =>
      attempt(() => {
        if (!basis.value) throw new Error(basis.error || "Grundlage fehlt.");
        const b = basis.value;
        const correctionText = params.get("seatCorrections");
        let correction: Record<string, number> | undefined;
        if (correctionText?.trim()) {
          const raw: unknown = JSON.parse(correctionText);
          if (
            !isRecord(raw) ||
            Object.values(raw).some(
              (v) => typeof v !== "number" || !Number.isSafeInteger(v) || v < 0,
            )
          )
            throw new Error(
              "Bereinigung muss eine JSON-Zuordnung Partei-ID → nichtnegative ganze Zweitstimmenzahl sein.",
            );
          correction = Object.fromEntries(
            Object.entries(raw).map(([k, v]) => [k, Number(v)]),
          );
        }
        const lotOrder = (params.get("seatLotOrder") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (b.file) {
          const shifted = shiftElection(b.file, first, second, balancing),
            lots = { ...shifted.file.districtLots };
          for (const [key, value] of params)
            if (key.startsWith("seatDistrictLot_"))
              lots[key.slice("seatDistrictLot_".length)] = value;
          const actual = {
            ...shifted.file,
            districtLots: lots,
            baseSeatLots: lotOrder.length
              ? lotOrder
              : shifted.file.baseSeatLots,
            excludedSecondVotes: correction || shifted.file.excludedSecondVotes,
          };
          const result = electionMandates(actual);
          return {
            seats: result.seats,
            people: result.people,
            winners: result.winners,
            unfilled: result.unfilled,
            adjusted: shifted.adjusted,
            input: {
              parties: result.parties,
              validSecond: actual.validSecond,
              specialDirect: result.winners.filter((w) => w.partyId === null)
                .length,
              specialFirstVotes: result.winners
                .filter(
                  (w) =>
                    w.partyId === null ||
                    !result.parties.some(
                      (p) =>
                        p.id === w.partyId &&
                        p.hasList &&
                        p.votes * 20 >= actual.validSecond,
                    ),
                )
                .reduce((s, w) => s + w.votes, 0),
              excludedSecondVotes: actual.excludedSecondVotes,
              baseSeatLots: actual.baseSeatLots,
            } satisfies SeatInput,
            actual,
          };
        }
        const changed = secondVoteScenario(
          b.parties,
          b.valid,
          second,
          balancing,
        );
        const direct = changed.parties.map((p) => ({
          ...p,
          direct: labNumber(params, `seatDirect_${p.id}`, p.direct),
        }));
        const specialFirst = correction
          ? labNumber(params, "seatSpecialFirst", NaN)
          : undefined;
        const input: SeatInput = {
          parties: direct,
          validSecond: b.valid,
          excludedSecondVotes: correction,
          specialFirstVotes: specialFirst,
          baseSeatLots: lotOrder,
        };
        return {
          seats: allocateBw2026(input),
          people: [],
          winners: [],
          unfilled: null,
          adjusted: 0,
          input,
          actual: null,
        };
      }),
    [
      basis,
      JSON.stringify(first),
      JSON.stringify(second),
      balancing,
      params.toString(),
    ],
  );
  const firstPreview = useMemo(
    () =>
      basis.value?.file
        ? attempt(() =>
            shiftElection(basis.value!.file!, first, second, balancing),
          )
        : null,
    [basis.value, JSON.stringify(first), JSON.stringify(second), balancing],
  );
  const reference = useMemo(
    () =>
      basis.value?.release === STATE_RELEASE
        ? attempt(() =>
            referenceComparison(
              basis.value!.file
                ? electionMandates(basis.value!.file).parties
                : basis.value!.parties,
            ),
          )
        : null,
    [basis.value],
  );
  const referenceBlocked =
    reference?.value?.matches === false || !!reference?.error;
  const target = parties.some((p) => p.id === params.get("seatThresholdParty"))
    ? params.get("seatThresholdParty")!
    : parties.find((p) => p.hasList && p.id !== balancing)?.id || "";
  const sensitivity = useMemo(() => {
    if (!computed.value || !basis.value || target === balancing) return [];
    const input = computed.value.input;
    return Array.from({ length: 41 }, (_, i) => {
      const delta = (i - 20) / 10;
      const scenario = attempt(() => {
        const next = secondVoteScenario(
          input.parties,
          input.validSecond,
          { [target]: delta },
          balancing,
        );
        return allocateBw2026({
          ...input,
          parties: next.parties,
          excludedSecondVotes:
            delta === 0 ? input.excludedSecondVotes : undefined,
        });
      });
      return {
        delta,
        total: scenario.value?.total ?? null,
        seats: scenario.value?.rows.find((r) => r.id === target)?.total ?? null,
        error: scenario.error,
      };
    });
  }, [computed.value, basis.value, target, balancing]);
  const snapshot = () => ({
    parties: basis.value?.parties,
    valid: basis.value?.valid,
    source: basis.value?.source,
    file: basis.value?.file || undefined,
  });
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">
        BW-Sitz- und Mandatssimulator 2026
      </h3>
      <StatusNote>
        Hypothetische Modellrechnung, keine Wahlprognose. Rechtsstand: § 2 LWG,
        Zweistimmenwahl 2026. Alle Parteien einzeln, mindestens 5 % der
        ursprünglichen gültigen Zweitstimmen, 120 Grundsitze, Überhang/Ausgleich
        und Mehrheitsklausel. Sonderdirektmandate benötigen zusätzlich
        bereinigte Zweitstimmen. Automatisierte Tests wurden nicht ausgeführt;
        ein Referenzabgleich wird hier separat angezeigt.
      </StatusNote>
      {(state.isLoading || saved.isLoading) && (
        <p role="status">Landesdaten / Schnappschuss laden …</p>
      )}
      {(state.error || saved.error) && (
        <p role="alert">
          Daten nicht verfügbar. Migrationen und Szenariozugriff prüfen oder
          vollständige Quelldatei einlesen.
        </p>
      )}
      <details className="rounded border p-3">
        <summary className="cursor-pointer font-medium">
          Vollständige Erststimmen, Kandidaturen und Landeslisten einlesen
        </summary>
        <p className="my-2 text-sm">
          JSON bis 2 MB, Format bw-lwg-2026-v1; alle 70 Wahlkreise mit
          sämtlichen Kandidaturen, gültige Erststimmen, alle Landesparteien und
          eindeutige Personen-IDs. Gleiche Namen begründen keine Identität. Ohne
          vollständige Listen bleiben Listenpersonen unbekannt.
        </p>
        <Input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const request = ++fileRequest.current;
            const source = e.target.files?.[0];
            if (!source) return;
            try {
              if (source.size > 2_000_000)
                throw new Error("Datei größer als 2 MB.");
              const content = await source.text();
              if (request !== fileRequest.current) return;
              const raw: unknown = JSON.parse(content);
              setFile(parseElectionFile(raw));
              setParams((old) => {
                const next = new URLSearchParams(old);
                next.delete("seatCorrections");
                next.delete("seatSpecialFirst");
                return next;
              });
              setFileError("");
            } catch (err) {
              if (request !== fileRequest.current) return;
              setFileError(
                err instanceof Error ? err.message : "Quelldatei ungültig.",
              );
            }
          }}
        />
        <Button
          className="mt-2"
          variant="outline"
          onClick={() => {
            const template = {
              version: BW_RULES_VERSION,
              year: 2026,
              source_url: basis.value?.source || STATE_SOURCE,
              data_release: basis.value?.release || "einzutragen",
              validSecond: basis.value?.valid || 5375109,
              parties,
              districtFormat: {
                number: "1–70",
                validFirst: "Summe aller Kandidatenstimmen",
                candidates: [
                  {
                    id: "explizite Personen-ID",
                    name: "amtlicher Name",
                    partyId: "Partei-ID oder null",
                    votes: "ganze Stimmenzahl",
                  },
                ],
              },
              districts: [],
              lists: {},
              listsComplete: false,
            };
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(template, null, 2)], {
                type: "application/json",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "BW-2026-Datenvorlage.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Datenvorlage herunterladen
        </Button>
        {fileError && <p role="alert">{fileError}</p>}
        {file && (
          <Button variant="outline" onClick={() => setFile(null)}>
            Lokale Datei schließen
          </Button>
        )}
      </details>
      {params.get("savedScenario") && (
        <Button
          variant="outline"
          onClick={() =>
            setParams((old) => {
              const next = new URLSearchParams(old);
              next.delete("savedScenario");
              return next;
            })
          }
        >
          Gespeicherte Grundlage lösen / aktuelle Daten laden
        </Button>
      )}
      {basis.error ? (
        <p role="status">{basis.error}</p>
      ) : (
        basis.value && (
          <>
            <p className="text-sm">
              Grundlage: {basis.value.release} ·{" "}
              <a
                className="underline"
                href={basis.value.source}
                target="_blank"
                rel="noreferrer"
              >
                Quelle
              </a>{" "}
              · {parties.length} einzeln erfasste Parteien.{" "}
              {basis.value.file
                ? "Erststimmen werden aus vollständiger Datei simuliert."
                : "Direktmandate sind getrennte Annahmen; vollständige Wahlkreiskandidaturen fehlen."}
            </p>
            {reference && (
              <p className="rounded border p-3 text-sm">
                Amtlicher Referenzabgleich ohne Änderungen:{" "}
                {reference.value?.matches
                  ? "157 Sitze und Parteiverteilung stimmen mit der Endfeststellung überein."
                  : reference.error ||
                    "Abweichung: Simulatorausgabe bleibt gesperrt."}
              </p>
            )}
            <Selection
              id="seat-balancing"
              label="Ausgleichspartei für Zweitstimmenänderungen"
              value={balancing}
              onChange={(v) => set("seatBalancing", v)}
            >
              {parties
                .filter((p) => p.hasList)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Selection>
            <p className="text-xs text-muted-foreground">
              Änderungen in Prozentpunkten. Die Ausgleichspartei erhält die
              Gegenbuchung, damit die Summe 100 % bleibt. Nach Anteilsänderung
              werden ganze Stimmen summenerhaltend gerundet. Im
              Erststimmenmodell bleiben Nominierungen unverändert; lokale
              Grenzkorrekturen werden ausgewiesen.
            </p>
            <DataTable
              headers={[
                "Partei",
                "Zweitstimmenbasis %",
                "Änderung Zweitstimmen PP",
                basis.value.file
                  ? "Änderung Erststimmen PP"
                  : "Angenommene Direktmandate",
              ]}
              rows={parties.map((p) => [
                p.name,
                format((p.votes / basis.value!.valid) * 100, 3),
                p.id === balancing ? (
                  "Gegenbuchung"
                ) : p.hasList ? (
                  <Input
                    aria-label={`${p.name} Zweitstimmenänderung`}
                    type="number"
                    step="0.1"
                    value={params.get(`seatSecond_${p.id}`) ?? "0"}
                    onChange={(e) => set(`seatSecond_${p.id}`, e.target.value)}
                  />
                ) : (
                  <span>Keine zugelassene Landesliste</span>
                ),
                basis.value!.file ? (
                  <Input
                    aria-label={`${p.name} Erststimmenänderung`}
                    type="number"
                    step="0.1"
                    value={params.get(`seatFirst_${p.id}`) ?? "0"}
                    onChange={(e) => set(`seatFirst_${p.id}`, e.target.value)}
                  />
                ) : (
                  <Input
                    aria-label={`${p.name} Direktmandate`}
                    type="number"
                    min={0}
                    max={70}
                    step={1}
                    value={params.get(`seatDirect_${p.id}`) ?? String(p.direct)}
                    onChange={(e) => set(`seatDirect_${p.id}`, e.target.value)}
                  />
                ),
              ])}
            />
            <details className="rounded border p-3">
              <summary className="cursor-pointer text-sm">
                Sonderfälle und Losannahmen
              </summary>
              {firstPreview?.value?.file.districts
                .filter(
                  (d) =>
                    d.candidates.filter(
                      (c) =>
                        c.votes ===
                        Math.max(...d.candidates.map((p) => p.votes)),
                    ).length > 1,
                )
                .map((d) => (
                  <Selection
                    key={d.number}
                    id={`district-lot-${d.number}`}
                    label={`Losannahme Wahlkreis ${d.number}`}
                    value={params.get(`seatDistrictLot_${d.number}`) || ""}
                    onChange={(v) => set(`seatDistrictLot_${d.number}`, v)}
                  >
                    <option value="">Bitte ausdrücklich auswählen</option>
                    {d.candidates
                      .filter(
                        (c) =>
                          c.votes ===
                          Math.max(...d.candidates.map((p) => p.votes)),
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </Selection>
                ))}
              <label className="my-2 block text-sm">
                Partei-IDs für einen nötigen Grundsitz-Losentscheid,
                kommasepariert
                <Input
                  value={params.get("seatLotOrder") || ""}
                  onChange={(e) => set("seatLotOrder", e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Bereinigungsabzüge für das aktuelle Szenario (JSON je Partei-ID)
                <Input
                  value={params.get("seatCorrections") || ""}
                  onChange={(e) => set("seatCorrections", e.target.value)}
                  placeholder='{"Partei-ID": 0}'
                />
              </label>
              {!basis.value.file && (
                <label className="my-2 block text-sm">
                  Sitzwirksame Erststimmen aller Sonderdirektgewinner
                  <Input
                    type="number"
                    min={0}
                    value={params.get("seatSpecialFirst") || ""}
                    onChange={(e) => set("seatSpecialFirst", e.target.value)}
                  />
                </label>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Diese Kreuzinformation lässt sich nicht aus aggregierten
                Erst-/Zweitstimmen ableiten. Bei Änderungen wird eine alte
                Bereinigung nicht automatisch fortgeschrieben. Ohne
                erforderliche Angaben erfolgt keine Verteilung.
              </p>
            </details>
            {computed.error ? (
              <p role="status" className="rounded border p-3">
                {computed.error}
              </p>
            ) : (
              computed.value &&
              !referenceBlocked && (
                <>
                  <p className="text-lg font-medium">
                    {computed.value.seats.total} rechnerische Sitze ·{" "}
                    {computed.value.seats.overhang} Überhang ·{" "}
                    {computed.value.seats.balance} Ausgleich ·{" "}
                    {computed.value.seats.majorityBonus} Mehrheitszusatz
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {computed.value.adjusted} Wahlkreise mit korrigierten
                    Erststimmenanteilen.{" "}
                    {computed.value.unfilled == null
                      ? "Listenbesetzung unbekannt, solange vollständige Landeslisten fehlen."
                      : `${computed.value.unfilled} unbesetzte Sitze bei erschöpften Listen / nicht verteilbaren Ansprüchen.`}
                  </p>
                  <div className="rounded border bg-white p-3">
                    <h4 className="mb-3 font-medium">
                      Rechnerische Mandatsansprüche vor Listenerschöpfung
                    </h4>
                    <div
                      style={{
                        height: Math.max(
                          260,
                          (computed.value.seats.rows.filter((r) => r.total > 0)
                            .length +
                            (computed.value.seats.specialDirect ? 1 : 0)) *
                            28,
                        ),
                      }}
                      role="img"
                      aria-label="Gestapelte Direkt- und Listenmandate; genaue Werte stehen in der Tabelle"
                    >
                      <ResponsiveContainer>
                        <BarChart
                          layout="vertical"
                          data={[
                            ...computed.value.seats.rows
                              .filter((r) => r.total > 0)
                              .map((r) => ({
                                name: r.name,
                                Direkt: r.direct,
                                Liste: r.list,
                              })),
                            ...(computed.value.seats.specialDirect
                              ? [
                                  {
                                    name: "Einzelbewerbungen",
                                    Direkt: computed.value.seats.specialDirect,
                                    Liste: 0,
                                  },
                                ]
                              : []),
                          ]}
                          margin={{ left: 5, right: 15, top: 5, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            horizontal={false}
                          />
                          <XAxis type="number" allowDecimals={false} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={150}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip />
                          <Legend />
                          <Bar
                            dataKey="Direkt"
                            stackId="seats"
                            fill="#526b42"
                          />
                          <Bar dataKey="Liste" stackId="seats" fill="#a4b28d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <DataTable
                    headers={[
                      "Partei",
                      "Sperrklausel / Liste",
                      "Grundanspruch",
                      "Direkt",
                      "Liste",
                      "Überhang",
                      "Ausgleich",
                      "Mehrheitszusatz",
                      "Gesamt",
                    ]}
                    rows={computed.value.seats.rows.map((r) => [
                      r.name,
                      r.eligible ? "Teilnahme" : "Keine Listenzuteilung",
                      r.base,
                      r.direct,
                      r.list,
                      r.overhang,
                      r.balance,
                      r.majorityBonus,
                      r.total,
                    ])}
                  />
                  <SaveScenarioAction
                    year={2026}
                    ballot="second"
                    model={BW_RULES_VERSION}
                    release={basis.value.release}
                    input={snapshot()}
                    result={computed.value.seats}
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportAnalysisCsv(
                        computed.value!.seats.rows.map((r) => ({
                          ...r,
                          Modell: BW_RULES_VERSION,
                          Datenstand: basis.value!.release,
                          Quelle: basis.value!.source,
                          Hypothetisch: true,
                          Erststimmenannahmen: basis.value!.file
                            ? JSON.stringify(first)
                            : "Direktmandate als getrennte Annahme",
                          Zweitstimmenannahmen: JSON.stringify(second),
                          Ausgleichspartei: balancing,
                        })),
                        `BW-Sitzszenario-2026.csv`,
                      )
                    }
                  >
                    Sitze und Annahmen exportieren
                  </Button>
                  {computed.value.people.length > 0 && (
                    <>
                      <h4 className="font-medium">
                        Einzug über Wahlkreis / Landesliste
                      </h4>
                      <Button
                        variant="outline"
                        onClick={() =>
                          exportAnalysisCsv(
                            computed.value!.people,
                            `Hypothetische-Mandate-2026.csv`,
                          )
                        }
                      >
                        Personenzuordnung exportieren
                      </Button>
                      <DataTable
                        headers={[
                          "Name",
                          "Partei-ID",
                          "Einzug",
                          "Wahlkreis",
                          "Listenplatz",
                        ]}
                        rows={computed.value.people.map((p) => [
                          p.name,
                          p.partyId || "Einzelbewerbung",
                          p.route,
                          p.district || "—",
                          p.listRank ?? "—",
                        ])}
                      />
                    </>
                  )}
                  <details className="rounded border p-3">
                    <summary className="cursor-pointer font-medium">
                      Schwellenanalyse der Parteisitze
                    </summary>
                    <Selection
                      id="seat-threshold-party"
                      label="Partei"
                      value={target}
                      onChange={(v) => set("seatThresholdParty", v)}
                    >
                      {parties
                        .filter((p) => p.hasList && p.id !== balancing)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </Selection>
                    <p className="my-2 text-xs text-muted-foreground">
                      Raster −2 bis +2 PP um das aktuelle Szenario, Auflösung
                      0,1 PP; Gegenbuchung bei {balancing}. Direktmandate
                      bleiben gleich. Gezeigt werden berechnete Rasterpunkte,
                      keine behaupteten exakten Übergangsschwellen.
                      Sonderfall-Bereinigungen werden nicht geschätzt.
                    </p>
                    <DataTable
                      headers={[
                        "Zusätzlich PP",
                        "Parteisitze",
                        "Landtagsgröße",
                        "Hinweis",
                      ]}
                      rows={sensitivity.map((r) => [
                        format(r.delta, 1),
                        r.seats ?? "—",
                        r.total ?? "—",
                        r.error || "Berechnet",
                      ])}
                    />
                    <Button
                      variant="outline"
                      onClick={() =>
                        exportAnalysisCsv(
                          sensitivity,
                          `Sitzschwellen-${target}.csv`,
                        )
                      }
                    >
                      Schwellenraster exportieren
                    </Button>
                  </details>
                  {computed.value.actual && (
                    <details className="rounded border p-3">
                      <summary className="cursor-pointer font-medium">
                        Wahlkreisschwellen bei direkter Stimmenübertragung
                      </summary>
                      <p className="my-2 text-xs text-muted-foreground">
                        Minimale ganze Erststimmen, die vom aktuell stärksten
                        Gegenbewerber zur jeweiligen Kandidatur übertragen
                        werden müssten, um alle Gegenbewerber strikt zu
                        überholen. Andere Stimmen bleiben konstant. Keine
                        beobachtete Wählerbewegung; Gleichstand genügt nicht.
                      </p>
                      <DataTable
                        headers={[
                          "Wahlkreis",
                          "Kandidatur",
                          "Notwendige Übertragung",
                        ]}
                        rows={computed.value.actual.districts.flatMap((d) =>
                          d.candidates.map((c) => [
                            d.number,
                            c.name,
                            directTransferThreshold(d.candidates, c.id) ??
                              "Nicht möglich",
                          ]),
                        )}
                      />
                    </details>
                  )}
                </>
              )
            )}
          </>
        )
      )}
    </div>
  );
}
