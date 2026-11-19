import { DataTable } from "../../shared";
import { districtLeader } from "./electionFile";
import type { ElectionFile, SeatResult } from "./types";

export function DistrictModelPanel({
  baseline,
  scenario,
  seats,
}: {
  baseline?: ElectionFile | null;
  scenario?: ElectionFile;
  seats?: SeatResult;
}) {
  const winners = new Map(
    baseline?.districts.map((district) => [
      district.number,
      districtLeader(district, baseline.districtLots?.[district.number]).winner,
    ]),
  );
  const rows =
    scenario?.districts.map((district) => {
      const { winner, tied } = districtLeader(
        district,
        scenario.districtLots?.[district.number],
      );
      const previous = winners.get(district.number);
      return {
        district,
        winner,
        tied,
        previous,
        flipped: !!winner && !!previous && winner.id !== previous.id,
      };
    }) ?? [];
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
