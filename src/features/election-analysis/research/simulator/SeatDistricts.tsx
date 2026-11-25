import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DataTable } from "../../shared";
import { attempt, format } from "../lab/shared";
import { electionMandates, transferDistrict } from "./electionFile";
import {
  districtCandidateLabel,
  districtLabel,
  officialDistrictWinner,
  officialDistrictWinnerLabel,
} from "./districtLabels";
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
  const [params, setParams] = useSearchParams();
  const requestedPreview = Number(params.get("seatDistrictPreview"));
  const activeDistrict =
    Number.isInteger(requestedPreview) && requestedPreview >= 1 && requestedPreview <= 70
      ? requestedPreview
      : null;
  const openPreview = (district: number) =>
    setParams((old) => {
      const next = new URLSearchParams(old);
      next.set("seatDistrictPreview", String(district));
      return next;
    });
  const closePreview = () =>
    setParams((old) => {
      const next = new URLSearchParams(old);
      next.delete("seatDistrictPreview");
      return next;
    });
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
        <strong>Abstand</strong> ist die Differenz der Erststimmen zwischen dem
        Sieger und der stärksten Gegenkandidatur im Szenario.{" "}
        <strong>Nötige Übertragung</strong> ist die kleinste Zahl an
        Erststimmen, die direkt vom Sieger zur Gegenkandidatur wechseln müssen,
        damit sie allein vorn liegt. Jede übertragene Stimme verkleinert den
        Abstand um zwei Stimmen. Ein Gleichstand reicht nicht.
      </p>
      {active && preview && (
        <div
          role="status"
          className="mb-3 rounded border bg-muted/30 p-3 text-sm"
        >
          <strong>
            Wahlkreis {districtLabel(active.district)} ·{" "}
            {districtCandidateLabel(active.challenger)} gewinnt
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
                closePreview();
              }}
            >
              Ins Szenario übernehmen
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => closePreview()}
          >
            Vorschau schließen
          </Button>
        </div>
      )}
      <DataTable
        whiteBackground
        headers={[
          "Wahlkreis",
          "Direkt gewählt 2026",
          "Sieger im Szenario",
          "Stärkste Gegenkandidatur",
          "Abstand (Stimmen)",
          "Nötige Übertragung (Stimmen)",
          "Sitzwirkung",
        ]}
        initialSort={{ column: 4, direction: "asc" }}
        sortableColumns={[0, 1, 2, 3, 4, 5]}
        sortValues={rows.map((row) => [
          row.district.number,
          officialDistrictWinner(row.district.number)?.name ?? null,
          row.winner.name,
          row.challenger.name,
          row.gap,
          row.transfer,
        ])}
        rows={rows.map(({ district, winner, challenger, gap, transfer }) => [
          districtLabel(district),
          officialDistrictWinnerLabel(district.number),
          districtCandidateLabel(winner),
          districtCandidateLabel(challenger),
          format(gap, 0),
          transfer === null ? "Nicht möglich" : format(transfer, 0),
          <Button
            key={district.number}
            type="button"
            size="sm"
            variant="outline"
            className="border-stone-300 bg-white text-slate-950 hover:bg-stone-100 hover:text-slate-950"
            disabled={transfer === null || !!assumptions[district.number]}
            aria-pressed={activeDistrict === district.number}
            onClick={() => openPreview(district.number)}
          >
            {assumptions[district.number] ? "Übernommen" : "Wahlkreis kippen"}
          </Button>,
        ])}
      />
    </details>
  );
}
