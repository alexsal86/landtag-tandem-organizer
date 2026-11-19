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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPartyColor } from "@/features/election-districts/partyColors";
import { DataTable, Selection, StatusNote } from "../../shared";

import { isRecord } from "@/utils/typeSafety";
import { useFullState, useSavedScenario } from "../workspaceHooks";
import { SaveScenarioAction } from "../SaveScenarioAction";
import { attempt, format, labNumber, useLabParams } from "../lab/shared";
import { allocateBw2026 } from "./seats";
import { SeatOverview, SeatThreshold } from "./SeatOverview";
import {
  DISTRICT_RELEASE,
  officialDistrictFile,
  useOfficialDistricts,
} from "./useOfficialDistricts";
import { SeatDistricts } from "./SeatDistricts";
import {
  parseElectionFile,
  shiftElection,
  electionMandates,
  transferDistrict,
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
  const [tab, setTab] = useState("seats");
  const [districtsRequested, setDistrictsRequested] = useState(false);
  const flips = Object.fromEntries(
    [...params]
      .filter(([key]) => /^seatFlip_([1-9]|[1-6][0-9]|70)$/.test(key))
      .map(([key, value]) => [key.slice("seatFlip_".length), value]),
  );
  const set = (key: string, value: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old);
      if (key.startsWith("seatFlip_") && !value) next.delete(key);
      else next.set(key, value);
      if (
        key === "seatBalancing" ||
        [
          "seatFirst_",
          "seatSecond_",
          "seatDirect_",
          "seatDistrictLot_",
          "seatFlip_",
        ].some((prefix) => key.startsWith(prefix))
      ) {
        next.delete("seatCorrections");
        next.delete("seatSpecialFirst");
      }
      return next;
    });
  const resetScenario = () => {
    fileRequest.current++;
    setFile(null);
    setFileError("");
    setTab("seats");
    setDistrictsRequested(false);
    setParams((old) => {
      const next = new URLSearchParams(old);
      for (const key of new Set(next.keys())) {
        if (
          [
            "savedScenario",
            "seatBalancing",
            "seatLotOrder",
            "seatCorrections",
            "seatSpecialFirst",
            "seatThresholdParty",
          ].includes(key) ||
          [
            "seatFirst_",
            "seatSecond_",
            "seatDirect_",
            "seatDistrictLot_",
            "seatFlip_",
          ].some((prefix) => key.startsWith(prefix))
        )
          next.delete(key);
      }
      return next;
    });
  };
  const fileRequest = useRef(0);
  const [file, setFile] = useState<ElectionFile | null>(null),
    [fileError, setFileError] = useState("");
  const hasManualDirect = state.data?.some(
    (row) =>
      labNumber(params, `seatDirect_${row.party}`, row.direct_seats ?? 0) !==
      (row.direct_seats ?? 0),
  );
  const districtData = useOfficialDistricts(
    (districtsRequested || Object.keys(flips).length > 0) &&
      !params.get("savedScenario") &&
      !file &&
      !hasManualDirect,
  );
  const districtHistory = districtData.data?.history;
  const districtFactions = districtData.data?.factions;
  const districtVotes = districtData.data?.voteReference;
  const official = useMemo(() => {
    if (!districtHistory || !districtFactions || !districtVotes || !state.data)
      return null;
    return attempt(() =>
      officialDistrictFile(
        {
          history: districtHistory,
          factions: districtFactions,
          voteReference: districtVotes,
        },
        officialStateParties(state.data!),
      ),
    );
  }, [districtHistory, districtFactions, districtVotes, state.data]);
  const officialFile =
    !hasManualDirect && (districtsRequested || Object.keys(flips).length > 0)
      ? official?.value
      : undefined;
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
        if (officialFile)
          return {
            parties: officialFile.parties,
            valid: officialFile.validSecond,
            release: officialFile.data_release,
            source: officialFile.source_url,
            file: officialFile,
          };
        return {
          parties: officialStateParties(state.data || []),
          valid: 5375109,
          release: STATE_RELEASE,
          source: STATE_SOURCE,
          file: null,
        };
      }),
    [file, officialFile, saved.data, state.data, params.get("savedScenario")],
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
            districts: shifted.file.districts.map((district) =>
              flips[district.number]
                ? transferDistrict(
                    district,
                    flips[district.number],
                    lots[district.number],
                  )
                : district,
            ),
            districtLots: lots,
            baseSeatLots: lotOrder.length
              ? lotOrder
              : shifted.file.baseSeatLots,
            excludedSecondVotes:
              correction ||
              (Object.keys(flips).length
                ? undefined
                : shifted.file.excludedSecondVotes),
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
        if (Object.keys(flips).length)
          throw new Error(
            "Für die übernommenen Kippannahmen werden vollständige Wahlkreisdaten benötigt.",
          );
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
      basis.value &&
      [STATE_RELEASE, DISTRICT_RELEASE].includes(basis.value.release)
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
  const officialResult =
    reference?.value?.matches === true &&
    Object.keys(flips).length === 0 &&
    Object.values(first).every((delta) => delta === 0) &&
    Object.values(second).every((delta) => delta === 0) &&
    parties.every(
      (party) =>
        labNumber(params, `seatDirect_${party.id}`, party.direct) ===
        party.direct,
    ) &&
    ![...params].some(
      ([key, value]) =>
        value.trim() &&
        (["seatLotOrder", "seatCorrections", "seatSpecialFirst"].includes(
          key,
        ) ||
          key.startsWith("seatDistrictLot_")),
    );
  const target = parties.some((p) => p.id === params.get("seatThresholdParty"))
    ? params.get("seatThresholdParty")!
    : parties.find((p) => p.hasList && p.id !== balancing)?.id || "";
  const sensitivity = useMemo(() => {
    if (
      tab !== "threshold" ||
      !computed.value ||
      !basis.value ||
      !target ||
      target === balancing
    )
      return [];
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
  }, [tab, computed.value, basis.value, target, balancing]);
  const snapshot = () => ({
    parties: basis.value?.parties,
    valid: basis.value?.valid,
    source: basis.value?.source,
    file: basis.value?.file || undefined,
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-2xl font-semibold">
          BW-Sitz- und Mandatssimulator 2026
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={resetScenario}>
            Auf amtliches Ergebnis zurücksetzen
          </Button>
          {basis.value && computed.value && !referenceBlocked && (
            <SaveScenarioAction
              year={2026}
              ballot="second"
              model={BW_RULES_VERSION}
              release={basis.value.release}
              input={snapshot()}
              result={computed.value.seats}
            />
          )}
        </div>
      </div>
      <StatusNote>
        Hypothetische Modellrechnung, keine Wahlprognose. Rechtsstand: § 2 LWG,
        Zweistimmenwahl 2026. Alle Parteien einzeln, mindestens 5 % der
        ursprünglichen gültigen Zweitstimmen, 120 Grundsitze, Überhang/Ausgleich
        und Mehrheitsklausel. Sonderdirektmandate benötigen zusätzlich
        bereinigte Zweitstimmen.
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
                for (const key of new Set(next.keys()))
                  if (
                    key.startsWith("seatFlip_") ||
                    key.startsWith("seatDistrictLot_")
                  )
                    next.delete(key);
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
          <Button
            variant="outline"
            onClick={() => {
              setFile(null);
              setParams((old) => {
                const next = new URLSearchParams(old);
                for (const key of new Set(next.keys()))
                  if (
                    key.startsWith("seatFlip_") ||
                    key.startsWith("seatDistrictLot_") ||
                    ["seatCorrections", "seatSpecialFirst"].includes(key)
                  )
                    next.delete(key);
                return next;
              });
            }}
          >
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
              for (const key of new Set(next.keys()))
                if (
                  key.startsWith("seatFlip_") ||
                  key.startsWith("seatDistrictLot_") ||
                  ["seatCorrections", "seatSpecialFirst"].includes(key)
                )
                  next.delete(key);
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
              {basis.value.release === DISTRICT_RELEASE
                ? "Kandidaturen aus dem Bestand · amtliche Erststimmen."
                : basis.value.file
                  ? "Erststimmen werden aus vollständigen Wahlkreisdaten simuliert."
                  : "Direktmandate werden als Annahmen eingegeben."}
            </p>
            {reference && (
              <p
                className={
                  officialResult
                    ? "rounded-lg border border-emerald-700/40 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                    : "rounded-lg border border-amber-700/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                }
              >
                {reference.value?.matches
                  ? officialResult
                    ? "Amtlicher Referenzabgleich bestätigt · 157 Sitze gemäß Endfeststellung."
                    : "Hypothetisches Szenario auf Basis des amtlichen Ergebnisses."
                  : reference.error ||
                    "Der Referenzabgleich weicht ab. Die Sitzberechnung ist gesperrt."}
              </p>
            )}
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)]">
              <aside
                className="min-w-0 space-y-4 rounded-lg border bg-card p-4"
                aria-label="Szenario-Eingaben"
              >
                <section aria-labelledby="seat-second-label">
                  <h4
                    id="seat-second-label"
                    className="font-serif text-lg font-semibold"
                  >
                    Zweitstimmen verschieben
                  </h4>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Änderung in Prozentpunkten
                  </p>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {parties
                      .filter((p) => p.hasList)
                      .slice()
                      .sort((a, b) => b.votes - a.votes)
                      .map((p) => {
                        const key = `seatSecond_${p.id}`;
                        const range = Math.max(5, Math.abs(second[p.id] ?? 0));
                        return (
                          <div
                            key={p.id}
                            className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-xs"
                          >
                            <span
                              title={p.name}
                              className="truncate font-medium"
                            >
                              <span
                                aria-hidden="true"
                                className="mr-1 inline-block size-2 rounded-full"
                                style={{ backgroundColor: getPartyColor(p.id) }}
                              />
                              {p.name}
                            </span>
                            {p.id === balancing ? (
                              <span className="col-span-2 text-right text-muted-foreground">
                                Gegenbuchung
                              </span>
                            ) : (
                              <>
                                <input
                                  type="range"
                                  min={-range}
                                  max={range}
                                  step="0.1"
                                  aria-label={`${p.name} Zweitstimmenregler`}
                                  value={second[p.id] ?? 0}
                                  onChange={(e) => set(key, e.target.value)}
                                  className="min-w-0 accent-cyan-800 dark:accent-cyan-400"
                                />
                                <Input
                                  type="number"
                                  step="0.1"
                                  aria-label={`${p.name} Zweitstimmenänderung in Prozentpunkten`}
                                  value={params.get(key) ?? "0"}
                                  onChange={(e) => set(key, e.target.value)}
                                  className="h-8 px-1.5 text-right tabular-nums"
                                />
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  <div className="mt-3">
                    <Selection
                      id="seat-balancing"
                      label="Gegenbuchung für 100 % Zweitstimmen"
                      value={balancing}
                      onChange={(value) => set("seatBalancing", value)}
                    >
                      {parties
                        .filter((p) => p.hasList)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </Selection>
                  </div>
                </section>
                <section
                  className="border-t pt-3"
                  aria-labelledby="seat-direct-label"
                >
                  <h4
                    id="seat-direct-label"
                    className="font-serif text-lg font-semibold"
                  >
                    Direktmandate (70)
                  </h4>
                  {basis.value.file && (
                    <p className="text-xs text-muted-foreground">
                      {computed.value?.seats.rows
                        .filter((party) => party.direct > 0)
                        .map((party) => `${party.name} ${party.direct}`)
                        .join(" · ")}
                    </p>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm">
                      {basis.value.file
                        ? "Erststimmen verschieben"
                        : "Direktmandate bearbeiten"}
                    </summary>
                    <div className="mt-2 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
                      {parties.map((p) => {
                        const fullMode = !!basis.value?.file;
                        const key = fullMode
                          ? `seatFirst_${p.id}`
                          : `seatDirect_${p.id}`;
                        return (
                          <label key={p.id} className="text-xs">
                            {p.name}
                            <Input
                              type="number"
                              step={fullMode ? "0.1" : "1"}
                              aria-label={`${p.name} ${fullMode ? "Erststimmenänderung in Prozentpunkten" : "Direktmandate"}`}
                              min={fullMode ? undefined : 0}
                              max={fullMode ? undefined : 70}
                              value={
                                params.get(key) ??
                                String(fullMode ? 0 : p.direct)
                              }
                              onChange={(e) => set(key, e.target.value)}
                              className="mt-1 h-8"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </details>
                  {Object.entries(flips).map(([number, candidate]) => {
                    const district = basis.value?.file?.districts.find(
                      (d) => d.number === Number(number),
                    );
                    return (
                      <div
                        key={number}
                        className="mt-2 flex items-center justify-between gap-2 rounded border p-2 text-xs"
                      >
                        <span>
                          WK {number} ·{" "}
                          {district?.candidates.find((c) => c.id === candidate)
                            ?.name || candidate}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => set(`seatFlip_${number}`, "")}
                        >
                          Entfernen
                        </Button>
                      </div>
                    );
                  })}
                </section>
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
                    Bereinigungsabzüge für das aktuelle Szenario (JSON je
                    Partei-ID)
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
                        onChange={(e) =>
                          set("seatSpecialFirst", e.target.value)
                        }
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
              </aside>
              <Tabs
                className="min-w-0"
                value={tab}
                onValueChange={(value) => {
                  setTab(value);
                  if (value === "districts") setDistrictsRequested(true);
                }}
              >
                <TabsList
                  aria-label="Simulatoransichten"
                  className="h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0"
                >
                  {[
                    ["seats", "Sitzverteilung"],
                    ["coalitions", "Koalitionen"],
                    ["threshold", "5-%-Hürde"],
                    ["districts", "Wahlkreise"],
                  ].map(([value, label]) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="rounded-none border-b-2 border-transparent py-2.5 data-[state=active]:border-cyan-800 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-cyan-400"
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {tab === "districts" && !basis.value.file && (
                  <div
                    className="mt-3 rounded-lg border bg-card p-4 text-sm"
                    role="status"
                  >
                    {hasManualDirect ? (
                      <>
                        Für die amtliche Wahlkreisgrundlage müssen die manuellen
                        Direktmandatsannahmen zurückgesetzt werden.
                        {!params.get("savedScenario") && (
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-2"
                            onClick={() =>
                              setParams((old) => {
                                const next = new URLSearchParams(old);
                                for (const key of new Set(next.keys()))
                                  if (
                                    key.startsWith("seatDirect_") ||
                                    [
                                      "seatCorrections",
                                      "seatSpecialFirst",
                                    ].includes(key)
                                  )
                                    next.delete(key);
                                return next;
                              })
                            }
                          >
                            Amtliche Direktmandate verwenden
                          </Button>
                        )}
                      </>
                    ) : params.get("savedScenario") ? (
                      "Dieses Szenario wurde mit Landesdaten gespeichert. Über „Gespeicherte Grundlage lösen“ kannst du aktuelle Wahlkreisdaten laden."
                    ) : districtData.isFetching ? (
                      "Wahlkreise und Kandidaturen aus dem Bestand werden geladen …"
                    ) : (
                      <>
                        {official?.error ||
                          (districtData.error instanceof Error
                            ? districtData.error.message
                            : "Vollständige amtliche Wahlkreisdaten sind derzeit nicht verfügbar.")}{" "}
                        Eine vollständige Quelldatei kann oben eingelesen
                        werden.
                      </>
                    )}
                  </div>
                )}
                {computed.error ? (
                  <p role="status" className="mt-3 rounded border p-3">
                    {computed.error}
                  </p>
                ) : (
                  computed.value &&
                  !referenceBlocked && (
                    <>
                      <TabsContent value="seats" className="space-y-3">
                        <SeatOverview
                          view="seats"
                          seats={computed.value.seats}
                          reference={reference?.value?.result}
                          official={officialResult}
                          unfilled={computed.value.unfilled}
                        />
                        <p className="text-xs text-muted-foreground">
                          {computed.value.adjusted} Wahlkreise mit korrigierten
                          Erststimmenanteilen.{" "}
                          {computed.value.unfilled == null
                            ? "Listenbesetzung unbekannt, solange vollständige Landeslisten fehlen."
                            : `${computed.value.unfilled} unbesetzte Sitze bei erschöpften Listen / nicht verteilbaren Ansprüchen.`}
                        </p>
                        <div className="rounded border bg-card p-3">
                          <h4 className="mb-3 font-medium">
                            Rechnerische Mandatsansprüche vor Listenerschöpfung
                          </h4>
                          <div
                            style={{
                              height: Math.max(
                                260,
                                (computed.value.seats.rows.filter(
                                  (r) => r.total > 0,
                                ).length +
                                  (computed.value.seats.specialDirect
                                    ? 1
                                    : 0)) *
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
                                          Direkt:
                                            computed.value.seats.specialDirect,
                                          Liste: 0,
                                        },
                                      ]
                                    : []),
                                ]}
                                margin={{
                                  left: 5,
                                  right: 15,
                                  top: 5,
                                  bottom: 5,
                                }}
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
                                <Bar
                                  dataKey="Liste"
                                  stackId="seats"
                                  fill="#a4b28d"
                                />
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

                        {computed.value.people.length > 0 && (
                          <>
                            <h4 className="font-medium">
                              Einzug über Wahlkreis / Landesliste
                            </h4>

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
                      </TabsContent>
                      <TabsContent value="coalitions">
                        <SeatOverview
                          view="coalitions"
                          seats={computed.value.seats}
                          reference={reference?.value?.result}
                          official={officialResult}
                          unfilled={computed.value.unfilled}
                        />
                      </TabsContent>
                      <TabsContent value="threshold" className="space-y-3">
                        <SeatThreshold
                          seats={computed.value.seats}
                          parties={computed.value.input.parties}
                          valid={computed.value.input.validSecond}
                        />
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
                            Raster −2 bis +2 % um das aktuelle Szenario,
                            Auflösung 0,1 %; Gegenbuchung bei {balancing}.
                            Direktmandate bleiben gleich. Gezeigt werden
                            berechnete Rasterpunkte, keine behaupteten exakten
                            Übergangsschwellen. Sonderfall-Bereinigungen werden
                            nicht geschätzt.
                          </p>
                          <DataTable
                            headers={[
                              "Zusätzlich %",
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
                        </details>
                      </TabsContent>
                      <TabsContent value="districts" className="space-y-3">
                        {computed.value.actual && (
                          <SeatDistricts
                            key={params.toString()}
                            file={computed.value.actual}
                            winners={computed.value.winners}
                            seats={computed.value.seats}
                            assumptions={flips}
                            onApply={(district, candidate) =>
                              set(`seatFlip_${district}`, candidate)
                            }
                          />
                        )}
                        {computed.value.actual && (
                          <details className="rounded border p-3">
                            <summary className="cursor-pointer font-medium">
                              Wahlkreisschwellen bei direkter Stimmenübertragung
                            </summary>
                            <p className="my-2 text-xs text-muted-foreground">
                              Minimale ganze Erststimmen, die vom aktuell
                              stärksten Gegenbewerber zur jeweiligen Kandidatur
                              übertragen werden müssten, um alle Gegenbewerber
                              strikt zu überholen. Andere Stimmen bleiben
                              konstant. Keine beobachtete Wählerbewegung;
                              Gleichstand genügt nicht.
                            </p>
                            <DataTable
                              headers={[
                                "Wahlkreis",
                                "Kandidatur",
                                "Notwendige Übertragung",
                              ]}
                              rows={computed.value.actual.districts.flatMap(
                                (d) =>
                                  d.candidates.map((c) => [
                                    d.number,
                                    c.name,
                                    directTransferThreshold(
                                      d.candidates,
                                      c.id,
                                    ) ?? "Nicht möglich",
                                  ]),
                              )}
                            />
                          </details>
                        )}
                      </TabsContent>
                    </>
                  )
                )}
              </Tabs>
            </div>
          </>
        )
      )}
    </div>
  );
}
