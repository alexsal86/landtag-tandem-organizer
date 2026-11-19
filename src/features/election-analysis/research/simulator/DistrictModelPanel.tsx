import { useState } from "react";
import { getPartyColor } from "@/features/election-districts/partyColors";
import { format } from "../lab/shared";
import { DataTable } from "../../shared";
import { districtLeader } from "./electionFile";
import type { ElectionFile, SeatResult } from "./types";

const CLOSE_MARGIN = 2;

export function DistrictModelPanel({
  baseline,
  scenario,
  seats,
}: {
  baseline?: ElectionFile | null;
  scenario?: ElectionFile;
  seats?: SeatResult;
}) {
  const [selectedNumber, setSelectedNumber] = useState<number>();
  const winners = new Map(
    baseline?.districts.map((district) => [
      district.number,
      districtLeader(district, baseline.districtLots?.[district.number]).winner,
    ]),
  );
  const rows =
    scenario?.districts
      .map((district) => {
        const { winner, tied } = districtLeader(
          district,
          scenario.districtLots?.[district.number],
        );
        const previous = winners.get(district.number);
        const runnerUp =
          winner &&
          district.candidates
            .filter((candidate) => candidate.id !== winner.id)
            .reduce<
              number | null
            >((highest, candidate) => Math.max(highest ?? 0, candidate.votes), null);
        const margin =
          winner && runnerUp != null
            ? ((winner.votes - runnerUp) / district.validFirst) * 100
            : null;
        return {
          district,
          winner,
          tied,
          previous,
          margin,
          flipped: !!winner && !!previous && winner.id !== previous.id,
        };
      })
      .sort((a, b) => a.district.number - b.district.number) ?? [];
  const selected = rows.find((row) => row.district.number === selectedNumber);
  const winnerLabel = (row: (typeof rows)[number]) =>
    row.winner
      ? (scenario?.parties.find((party) => party.id === row.winner?.partyId)
          ?.name ?? "Einzelbewerbung")
      : "Losentscheid offen";
  const changes = rows.filter((row) => row.flipped);
  const unresolved = rows.filter((row) => !row.winner).length;
  const direct = new Map<string | null, number>();
  for (const { winner } of rows)
    if (winner)
      direct.set(winner.partyId, (direct.get(winner.partyId) ?? 0) + 1);

  if (!scenario) return null;

  return (
    <section className="mt-3 space-y-3 rounded-lg border bg-card p-4">
      {scenario && (
        <>
          <h4 className="font-serif text-lg font-semibold">
            Wahlkreise im Szenario
          </h4>
          <div
            className="grid grid-cols-7 gap-1.5 sm:grid-cols-10"
            aria-label="Wahlkreiskacheln"
          >
            {rows.map((row) => {
              const { district, winner, margin, flipped } = row;
              const label = `Wahlkreis ${district.number}${district.name ? ` · ${district.name}` : ""}: ${winnerLabel(row)}${margin == null ? "" : ` · Abstand ${format(margin, 2)} Prozentpunkte`}${flipped ? " · gekippt" : ""}`;
              const color = getPartyColor(winner?.partyId ?? undefined);
              const pale =
                !winner || (margin != null && margin <= CLOSE_MARGIN);
              return (
                <button
                  key={district.number}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={selectedNumber === district.number}
                  onClick={() => setSelectedNumber(district.number)}
                  className={`aspect-square rounded-md text-xs font-medium tabular-nums outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring sm:text-sm ${flipped ? "ring-2 ring-inset ring-amber-500" : ""}`}
                  style={{
                    backgroundColor: pale
                      ? `color-mix(in srgb, ${color} 30%, white)`
                      : color,
                    color:
                      pale || ["#16a34a", "#ffed00", "#9ca3af"].includes(color)
                        ? "#111827"
                        : "#ffffff",
                  }}
                >
                  {district.number}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Schematische Kacheln. Blass: Abstand höchstens {CLOSE_MARGIN}{" "}
            Prozentpunkte oder offener Losentscheid. Umrandet: gegenüber 2026
            gekippt ({changes.length}).
          </p>
          {selected && (
            <p role="status" className="text-sm">
              <strong>
                Wahlkreis {selected.district.number}
                {selected.district.name ? ` · ${selected.district.name}` : ""}
              </strong>
              {" · "}
              {winnerLabel(selected)}
              {selected.margin != null &&
                ` · Abstand ${format(selected.margin, 2)} Prozentpunkte`}
              {selected.flipped && ` · 2026: ${selected.previous?.name}`}
            </p>
          )}
          <p className="text-sm font-medium">
            {changes.length} Wahlkreise mit anderer siegreicher Kandidatur
            {unresolved > 0 && ` · ${unresolved} mit offenem Losentscheid`}
            {seats && ` · ${seats.total} Sitze insgesamt`}
          </p>
          <ul
            aria-label="Direktmandate nach Partei"
            className="flex flex-wrap gap-x-3 gap-y-1 text-sm"
          >
            {[...direct]
              .sort((a, b) => b[1] - a[1])
              .map(([id, count]) => (
                <li key={id ?? "independent"}>
                  {scenario.parties.find((party) => party.id === id)?.name ??
                    "Einzelbewerbungen"}{" "}
                  <strong>{count}</strong>
                </li>
              ))}
          </ul>
          {(changes.length > 0 || unresolved > 0 || !seats) && (
            <DataTable
              headers={["Wahlkreis", "Ausgangsergebnis", "Szenario"]}
              rows={rows
                .filter((row) => row.flipped || !row.winner || !seats)
                .map(({ district, previous, winner, tied }) => [
                  district.name
                    ? `${district.number} · ${district.name}`
                    : district.number,
                  previous?.name ?? "—",
                  winner?.name ??
                    `Losentscheid offen: ${tied.map((candidate) => candidate.name).join(", ")}`,
                ])}
            />
          )}
        </>
      )}
    </section>
  );
}
