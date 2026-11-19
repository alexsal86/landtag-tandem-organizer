import { useMemo, useState } from "react";
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
import { SeatDistributionTable } from "./SeatDistributionTable";
import {
  DISTRICT_RELEASE,
  DISTRICT_PARTY_RELEASE,
  officialDistrictFile,
  useOfficialDistricts,
} from "./useOfficialDistricts";
import { SeatDistricts } from "./SeatDistricts";
import { DistrictModelPanel } from "./DistrictModelPanel";
import { DISTRICT_MODEL_VERSION, readDistrictModel } from "./districtModel";
import {
  parseElectionFile,
  shiftElection,
  electionMandates,
  transferDistrict,
} from "./electionFile";
import { BW_RULES_VERSION, type SeatInput } from "./types";
import {
  directTransferThreshold,
  officialStateParties,
  parsePartyArray,
  referenceComparison,
  secondVoteScenario,
  STATE_RELEASE,
  STATE_SOURCE,
} from "./model";
const MAX_SECOND_VOTE_DELTA = 20;
const secondVotePartyOrder = ["GRÜNE", "CDU", "AfD", "SPD", "Die Linke", "FDP"];
const highlightedPartyIndex = (id: string) =>
  secondVotePartyOrder.findIndex(
    (party) => party.toLowerCase() === id.toLowerCase(),
  );

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
  const savedInput = saved.data?.input_snapshot;
  const savedModel =
    isRecord(savedInput) &&
    isRecord(savedInput.districtModel) &&
    savedInput.districtModel.version === DISTRICT_MODEL_VERSION
      ? savedInput.districtModel.stage
      : undefined;
  const districtModel = readDistrictModel(
    params.get("seatDistrictModel") ?? savedModel,
  );
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
        ["seatBalancing", "seatDistrictModel"].includes(key) ||
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
    setTab("seats");
    setDistrictsRequested(false);
    setParams((old) => {
      const next = new URLSearchParams(old);
      for (const key of new Set(next.keys())) {
        if (
          [
            "savedScenario",
            "seatDistrictModel",
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
  const hasManualDirect = state.data?.some(
    (row) =>
      labNumber(params, `seatDirect_${row.party}`, row.direct_seats ?? 0) !==
      (row.direct_seats ?? 0),
  );
  const districtData = useOfficialDistricts(
    (districtModel !== "manual" ||
      districtsRequested ||
      Object.keys(flips).length > 0) &&
      !params.get("savedScenario") &&
      (!hasManualDirect || districtModel !== "manual"),
    districtModel === "manual",
  );
  const districtHistory = districtData.history;
  const districtFactions = districtData.factions;
  const districtVotes = districtData.data;
  const official = useMemo(() => {
    if (!districtVotes || !state.data) return null;
    return attempt(() =>
      officialDistrictFile(
        districtVotes,
        officialStateParties(state.data!),
        districtHistory,
        districtFactions,
      ),
    );
  }, [districtHistory, districtFactions, districtVotes, state.data]);
  const officialFile =
    (!hasManualDirect || districtModel !== "manual") &&
    (districtModel !== "manual" ||
      districtsRequested ||
      Object.keys(flips).length > 0)
      ? official?.value
      : undefined;
  const basis = useMemo(
    () =>
      attempt(() => {
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
    [officialFile, saved.data, state.data, params.get("savedScenario")],
  );
  const parties = basis.value?.parties || [];
  const manualDirectOverrides =
    districtModel === "manual" &&
    parties.some(
      (party) =>
        labNumber(params, `seatDirect_${party.id}`, party.direct) !==
        party.direct,
    );
  const visibleParties = parties
    .filter((party) => party.hasList && highlightedPartyIndex(party.id) >= 0)
    .sort((a, b) => highlightedPartyIndex(a.id) - highlightedPartyIndex(b.id));
  const balancing = useMemo(
    () =>
      basis.value?.parties
        .filter((party) => party.hasList && highlightedPartyIndex(party.id) < 0)
        .map((party) => party.id) ?? [],
    [basis.value],
  );
  const first = Object.fromEntries(
    parties.map((p) => [p.id, labNumber(params, `seatFirst_${p.id}`, 0)]),
  );
  const second = Object.fromEntries(
    visibleParties.map((p) => [
      p.id,
      labNumber(params, `seatSecond_${p.id}`, 0),
    ]),
  );
  const otherBaseline = basis.value
    ? (parties
        .filter((party) => balancing.includes(party.id))
        .reduce((sum, party) => sum + party.votes, 0) /
        basis.value.valid) *
      100
    : 0;
  const otherShare =
    otherBaseline -
    Object.values(second).reduce((sum, delta) => sum + delta, 0);
  const projection = useMemo(() => {
    const base = basis.value?.file;
    if (!base || manualDirectOverrides) return null;
    return attempt(() => {
      const shifted = shiftElection(
          base,
          districtModel === "manual" ? first : {},
          second,
          balancing,
          districtModel,
        ),
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
        excludedSecondVotes: Object.keys(flips).length
          ? undefined
          : shifted.file.excludedSecondVotes,
      };
      return { actual, adjusted: shifted.adjusted };
    });
  }, [
    basis.value,
    districtModel,
    manualDirectOverrides,
    JSON.stringify(first),
    JSON.stringify(second),
    balancing,
    params.toString(),
  ]);
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
        if (b.file && !manualDirectOverrides) {
          if (!projection?.value)
            throw new Error(
              projection?.error ||
                "Wahlkreismodell konnte nicht berechnet werden.",
            );
          const { actual: projected, adjusted } = projection.value;
          const actual = {
            ...projected,
            baseSeatLots: lotOrder.length ? lotOrder : projected.baseSeatLots,
            excludedSecondVotes: correction || projected.excludedSecondVotes,
          };
          const result = electionMandates(actual);
          return {
            seats: result.seats,
            people: result.people,
            winners: result.winners,
            unfilled: result.unfilled,
            adjusted,
            input: result.input,
            actual,
          };
        }
        if (districtModel !== "manual")
          throw new Error(
            official?.error ||
              (districtData.isFetching
                ? "Amtliche Erststimmenergebnisse werden geladen …"
                : "Die amtlichen Erststimmenergebnisse sind derzeit nicht verfügbar."),
          );
        if (!manualDirectOverrides && Object.keys(flips).length)
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
      projection,
      districtModel,
      manualDirectOverrides,
      official?.error,
      districtData.isFetching,
      JSON.stringify(first),
      JSON.stringify(second),
      balancing,
      params.toString(),
    ],
  );
  const reference = useMemo(
    () =>
      basis.value &&
      [STATE_RELEASE, DISTRICT_RELEASE, DISTRICT_PARTY_RELEASE].includes(
        basis.value.release,
      )
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
    (districtModel !== "manual" ||
      Object.values(first).every((delta) => delta === 0)) &&
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
  const target =
    visibleParties.find((p) => p.id === params.get("seatThresholdParty"))?.id ??
    visibleParties[0]?.id ??
    "";
  const sensitivity = useMemo(() => {
    if (tab !== "threshold" || !computed.value || !basis.value || !target)
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
    districtModel: { stage: districtModel, version: DISTRICT_MODEL_VERSION },
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
      {(state.isLoading || saved.isLoading) && (
        <p role="status">Landesdaten / Schnappschuss laden …</p>
      )}
      {(state.error || saved.error) && (
        <p role="alert">
          Daten nicht verfügbar. Bitte den Zugriff auf die Wahldaten oder das
          Szenario prüfen.
        </p>
      )}
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
                className="min-w-0 space-y-4 px-1 py-3"
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
                  <div className="space-y-2">
                    {visibleParties.map((p) => {
                      const key = `seatSecond_${p.id}`;
                      const min = Math.max(
                        -MAX_SECOND_VOTE_DELTA,
                        (-p.votes / basis.value!.valid) * 100,
                      );
                      const remaining =
                        otherBaseline -
                        Object.entries(second)
                          .filter(([id]) => id !== p.id)
                          .reduce((sum, [, delta]) => sum + delta, 0);
                      const max = Math.max(
                        min,
                        Math.min(MAX_SECOND_VOTE_DELTA, remaining),
                      );
                      const clamp = (value: number) =>
                        Math.max(min, Math.min(max, value));
                      const delta = second[p.id] ?? 0;
                      return (
                        <div
                          key={p.id}
                          className="grid grid-cols-[4.25rem_minmax(0,1fr)_3.25rem] items-center gap-2 text-sm text-muted-foreground"
                        >
                          <span title={p.name} className="truncate">
                            <span
                              aria-hidden="true"
                              className="mr-1 inline-block size-2 rounded-full"
                              style={{ backgroundColor: getPartyColor(p.id) }}
                            />
                            {p.name}
                          </span>
                          <input
                            type="range"
                            min={-MAX_SECOND_VOTE_DELTA}
                            max={MAX_SECOND_VOTE_DELTA}
                            step="any"
                            aria-label={`${p.name} Zweitstimmenregler`}
                            aria-valuetext={`${format(delta, 2)} Prozentpunkte`}
                            value={delta}
                            onChange={(e) => {
                              const next = clamp(e.currentTarget.valueAsNumber);
                              if (next !== delta) set(key, String(next));
                            }}
                            className="w-full min-w-0 accent-cyan-800 dark:accent-cyan-400"
                          />
                          <input
                            type="number"
                            min={min}
                            max={max}
                            step="any"
                            aria-label={`${p.name} Zweitstimmenänderung in Prozentpunkten`}
                            key={delta}
                            defaultValue={Number(delta.toFixed(2))}
                            onBlur={(e) => {
                              const input = e.currentTarget;
                              const value = input.valueAsNumber;
                              if (
                                Number.isFinite(value) &&
                                value !== Number(delta.toFixed(2))
                              ) {
                                const bounded = clamp(value);
                                input.value = String(
                                  Number(bounded.toFixed(2)),
                                );
                                if (bounded !== delta)
                                  set(key, String(bounded));
                              } else {
                                input.value = String(Number(delta.toFixed(2)));
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            className="w-full min-w-0 bg-transparent text-right tabular-nums [appearance:textfield] focus-visible:outline-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-5 space-y-1 text-muted-foreground">
                    <p id="seat-balancing-label" className="text-xs">
                      Gegenbuchung für 100 % Zweitstimmen
                    </p>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span>Sonstige</span>
                      <output
                        aria-labelledby="seat-balancing-label"
                        className="tabular-nums"
                      >
                        {format(
                          Math.abs(otherShare) < 1e-9 ? 0 : otherShare,
                          2,
                        )}{" "}
                        %
                      </output>
                    </div>
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
                  <div className="mt-2 space-y-2">
                    <Selection
                      id="seat-district-model"
                      label="Wahlkreismodell"
                      value={districtModel}
                      onChange={(value) => set("seatDistrictModel", value)}
                    >
                      <option value="manual">Manuell</option>
                      <option value="swing">Swing in Prozentpunkten</option>
                      <option value="logratio">Log-Ratio</option>
                    </Selection>
                    <p className="text-xs text-muted-foreground">
                      {districtModel === "manual"
                        ? "Direktmandate je Partei eingeben. Zusammen müssen es 70 sein."
                        : districtModel === "swing"
                          ? "Überträgt die Zweitstimmenänderung in Prozentpunkten auf das Erststimmenprofil jedes Wahlkreises."
                          : "Gewichtet die Erststimmen je Wahlkreis mit der relativen Zweitstimmenänderung."}
                    </p>
                  </div>
                  {basis.value.file && (
                    <p className="text-xs text-muted-foreground">
                      {computed.value?.seats.rows
                        .filter((party) => party.direct > 0)
                        .map((party) => `${party.name} ${party.direct}`)
                        .join(" · ")}
                    </p>
                  )}
                  {districtModel === "manual" && (
                    <>
                      {(basis.value.file
                        ? ["direct", "first"]
                        : ["direct"]
                      ).map((kind) => {
                        const firstVotes = kind === "first";
                        return (
                          <details key={kind} className="mt-2">
                            <summary className="cursor-pointer text-sm">
                              {firstVotes
                                ? "Erststimmen verschieben"
                                : "Direktmandate bearbeiten"}
                            </summary>
                            {firstVotes && manualDirectOverrides && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Die manuell vergebenen Direktmandate haben
                                Vorrang.
                              </p>
                            )}
                            <div className="mt-2 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
                              {parties.map((p) => {
                                const key = firstVotes
                                  ? `seatFirst_${p.id}`
                                  : `seatDirect_${p.id}`;
                                return (
                                  <label key={p.id} className="text-xs">
                                    {p.name}
                                    <Input
                                      type="number"
                                      step={firstVotes ? "0.1" : "1"}
                                      aria-label={`${p.name} ${firstVotes ? "Erststimmenänderung in Prozentpunkten" : "Direktmandate"}`}
                                      min={firstVotes ? undefined : 0}
                                      max={firstVotes ? undefined : 70}
                                      value={
                                        params.get(key) ??
                                        String(firstVotes ? 0 : p.direct)
                                      }
                                      onChange={(e) => set(key, e.target.value)}
                                      className="mt-1 h-8"
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          </details>
                        );
                      })}
                    </>
                  )}
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
                  {projection?.value?.actual.districts
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
                  {(!basis.value.file || manualDirectOverrides) && (
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
                    ["districts", "Wahlkreise und Modell"],
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
                {tab === "districts" && (
                  <DistrictModelPanel
                    baseline={basis.value.file}
                    scenario={
                      referenceBlocked ? undefined : projection?.value?.actual
                    }
                    seats={computed.value?.seats}
                  />
                )}
                {(tab === "districts" || districtModel !== "manual") &&
                  !basis.value.file && (
                    <div
                      className="mt-3 rounded-lg border bg-card p-4 text-sm"
                      role="status"
                    >
                      {hasManualDirect && districtModel === "manual" ? (
                        <>
                          Für die amtliche Wahlkreisgrundlage müssen die
                          manuellen Direktmandatsannahmen zurückgesetzt werden.
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
                        "Amtliche Erststimmenergebnisse werden geladen …"
                      ) : (
                        official?.error ||
                        (districtData.error instanceof Error
                          ? districtData.error.message
                          : "Vollständige amtliche Wahlkreisdaten sind derzeit nicht verfügbar.")
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
                        <SeatDistributionTable
                          seats={computed.value.seats}
                          validVotes={computed.value.input.validSecond}
                          featuredIds={visibleParties.map((party) => party.id)}
                        />
                        <p className="text-xs text-muted-foreground">
                          {districtModel === "manual" &&
                            `${computed.value.adjusted} Wahlkreise mit korrigierten Erststimmenanteilen. `}
                          {computed.value.unfilled == null
                            ? "Listenbesetzung unbekannt, solange vollständige Landeslisten fehlen."
                            : `${computed.value.unfilled} unbesetzte Sitze bei erschöpften Listen / nicht verteilbaren Ansprüchen.`}
                        </p>
                        {computed.value.people.length > 0 &&
                          basis.value.release !== DISTRICT_PARTY_RELEASE && (
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
                            {visibleParties.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </Selection>
                          <p className="my-2 text-xs text-muted-foreground">
                            Raster −2 bis +2 % um das aktuelle Szenario,
                            Auflösung 0,1 %; Gegenbuchung bei Sonstigen.
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
      <StatusNote>
        Hypothetische Modellrechnung, keine Wahlprognose. Rechtsstand: § 2 LWG,
        Zweistimmenwahl 2026. Alle Parteien einzeln, mindestens 5 % der
        ursprünglichen gültigen Zweitstimmen, 120 Grundsitze, Überhang/Ausgleich
        und Mehrheitsklausel. Sonderdirektmandate benötigen zusätzlich
        bereinigte Zweitstimmen.
      </StatusNote>
    </div>
  );
}
