import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "../../shared";
import { attempt, format } from "../lab/shared";
import { electionMandates, transferDistrict } from "./electionFile";
import { directTransferThreshold } from "./model";
import { seatDifference } from "./SeatOverview";
import type { ElectionFile, SeatResult } from "./types";

export function SeatDistricts({
  file,
  winners,
  seats,
  assumptions,
  onApply,
}: {
  file: ElectionFile;
  winners: ReturnType<typeof electionMandates>["winners"];
  seats: SeatResult;
  assumptions: Record<string, string>;
  onApply: (district: number, target: string) => void;
}) {
  const [activeDistrict, setActiveDistrict] = useState<number | null>(null);
  const rows = file.districts.flatMap((district) => {
    const winner = winners.find(
      (candidate) => candidate.district === district.number,
    );
    const challenger = district.candidates
      .filter((candidate) => candidate.id !== winner?.id)
      .sort((a, b) => b.votes - a.votes)[0];
    if (!winner || !challenger) return [];
    return [
      {
        district,
        winner,
        challenger,
        gap: winner.votes - challenger.votes,
        transfer: directTransferThreshold(district.candidates, challenger.id),
      },
    ];
  });
  const active = rows.find((row) => row.district.number === activeDistrict);
  const preview =
    active && active.transfer !== null
      ? attempt(() => {
          const { district, winner, challenger } = active;
          return electionMandates({
            ...file,
            excludedSecondVotes: undefined,
            districts: file.districts.map((current) =>
              current.number === district.number
                ? transferDistrict(current, challenger.id, winner.id)
                : current,
            ),
          });
        })
      : null;
  const effects = preview?.value?.seats.rows
    .map((row) => ({
      name: row.name,
      delta:
        row.total -
        (seats.rows.find((party) => party.id === row.id)?.total ?? 0),
    }))
    .filter((row) => row.delta !== 0)
    .map((row) => `${row.name} ${seatDifference(row.delta)}`)
    .join(" · ");
  const specialDelta =
    (preview?.value?.seats.specialDirect ?? seats.specialDirect) -
    seats.specialDirect;

  return (
    <details open className="rounded border p-3">
      <summary className="cursor-pointer font-medium">
        Knappste Wahlkreise
      </summary>
      <p className="my-2 text-sm text-muted-foreground">
        Die Vorschau überträgt so viele Erststimmen vom Wahlkreissieger an die
        stärkste Gegenkandidatur, bis diese allein vorn liegt. Alle anderen
        Stimmen bleiben gleich.
      </p>
      {active && preview && (
        <div
          role="status"
          className="mb-3 rounded border bg-muted/30 p-3 text-sm"
        >
          <strong>
            Wahlkreis {active.district.number} · {active.challenger.name}{" "}
            gewinnt
          </strong>
          {preview.value ? (
            <>
              <p>
                Landtagsgröße {seats.total} → {preview.value.seats.total} Sitze
                ({seatDifference(preview.value.seats.total - seats.total)})
              </p>
              <p>
                {[
                  effects,
                  specialDelta
                    ? `Einzelbewerbungen ${seatDifference(specialDelta)}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ") ||
                  "Keine Änderung bei den Parteisitzen oder Einzelbewerbungen."}
              </p>
            </>
          ) : (
            <p>{preview.error}</p>
          )}
          {preview.value && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onApply(active.district.number, active.challenger.id);
                setActiveDistrict(null);
              }}
            >
              Ins Szenario übernehmen
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setActiveDistrict(null)}
          >
            Vorschau schließen
          </Button>
        </div>
      )}
      <DataTable
        headers={[
          "Wahlkreis",
          "Gewinner",
          "Stärkste Gegenkandidatur",
          "Abstand",
          "Nötige Übertragung",
          "Sitzwirkung",
        ]}
        initialSort={{ column: 3, direction: "asc" }}
        sortableColumns={[0, 1, 2, 3, 4]}
        sortValues={rows.map((row) => [
          row.district.number,
          row.winner.name,
          row.challenger.name,
          row.gap,
          row.transfer,
        ])}
        rows={rows.map(({ district, winner, challenger, gap, transfer }) => [
          district.name
            ? `${district.number} · ${district.name}`
            : district.number,
          `${winner.name} · ${winner.partyId ?? "Einzelbewerbung"}`,
          `${challenger.name} · ${challenger.partyId ?? "Einzelbewerbung"}`,
          format(gap, 0),
          transfer === null ? "Nicht möglich" : format(transfer, 0),
          <Button
            key={district.number}
            type="button"
            size="sm"
            variant="outline"
            disabled={transfer === null || !!assumptions[district.number]}
            aria-pressed={activeDistrict === district.number}
            onClick={() => setActiveDistrict(district.number)}
          >
            {assumptions[district.number] ? "Übernommen" : "Wahlkreis kippen"}
          </Button>,
        ])}
      />
    </details>
  );
}
