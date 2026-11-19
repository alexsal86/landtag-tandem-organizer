import { getPartyColor } from "@/features/election-districts/partyColors";
import { format } from "../lab/shared";
import type { SeatResult } from "./types";

export function SeatDistributionTable({
  seats,
  validVotes,
  featuredIds,
}: {
  seats: SeatResult;
  validVotes: number;
  featuredIds: string[];
}) {
  const parties = featuredIds.flatMap((id) =>
    seats.rows.filter((row) => row.id === id),
  );
  const others = seats.rows.filter((row) => !featuredIds.includes(row.id));
  const otherTotal = (
    key:
      | "votes"
      | "direct"
      | "base"
      | "overhang"
      | "balance"
      | "majorityBonus"
      | "total",
  ) => others.reduce((sum, row) => sum + row[key], 0);

  const rows = [
    ...parties.map((row) => ({
      ...row,
      color: getPartyColor(row.id),
      belowThreshold: row.votes * 20 < validVotes,
    })),
    ...(others.length
      ? [
          {
            id: "other-parties",
            name: "Sonstige",
            color: "#98a39d",
            votes: otherTotal("votes"),
            direct: otherTotal("direct"),
            base: otherTotal("base"),
            overhang: otherTotal("overhang"),
            balance: otherTotal("balance"),
            majorityBonus: otherTotal("majorityBonus"),
            total: otherTotal("total"),
            belowThreshold: false,
          },
        ]
      : []),
    ...(seats.specialDirect
      ? [
          {
            id: "independent-seats",
            name: "Einzelbewerbungen",
            color: "#64748b",
            votes: 0,
            direct: seats.specialDirect,
            base: 0,
            overhang: 0,
            balance: 0,
            majorityBonus: 0,
            total: seats.specialDirect,
            belowThreshold: false,
          },
        ]
      : []),
  ];
  const headers = [
    "Partei",
    "Zweitstimmen",
    "Anteil",
    "Direkt",
    "Basis",
    "Überhang",
    "Ausgleich",
    ...(seats.majorityBonus ? ["Mehrheitszusatz"] : []),
    "Gesamt",
    "Verteilung",
  ];
  const width = (count: number) =>
    seats.total ? `${(count / seats.total) * 100}%` : "0%";

  return (
    <section
      aria-label="Sitzverteilung nach Parteien"
      className="rounded-lg border border-stone-200 bg-white p-3 text-slate-950 sm:p-4"
    >
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-right text-sm tabular-nums">
          <thead className="text-slate-600">
            <tr className="border-b border-stone-300">
              {headers.map((header, index) => (
                <th
                  key={header}
                  scope="col"
                  className={index === 0 ? "px-2 py-3 text-left" : "px-2 py-3"}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-stone-300">
                <th scope="row" className="px-2 py-3 text-left font-medium">
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-3 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    {row.name}
                    {row.belowThreshold && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-900">
                        unter 5 %
                      </span>
                    )}
                  </span>
                </th>
                <td className="px-2 py-3">{format(row.votes, 0)}</td>
                <td className="px-2 py-3">
                  {format((row.votes / validVotes) * 100, 1)} %
                </td>
                <td className="px-2 py-3">{row.direct}</td>
                <td className="px-2 py-3">{row.base}</td>
                <td className="px-2 py-3">{row.overhang}</td>
                <td className="px-2 py-3">{row.balance}</td>
                {seats.majorityBonus > 0 && (
                  <td className="px-2 py-3">{row.majorityBonus}</td>
                )}
                <td className="px-2 py-3 font-bold">{row.total}</td>
                <td className="w-1/5 min-w-24 px-2 py-3">
                  <div
                    aria-hidden="true"
                    className="flex h-2.5 overflow-hidden rounded-full bg-stone-100"
                  >
                    <span
                      className="opacity-50"
                      style={{
                        width: width(row.base),
                        backgroundColor: row.color,
                      }}
                    />
                    <span
                      style={{
                        width: width(row.overhang),
                        backgroundColor: row.color,
                        backgroundImage:
                          "repeating-linear-gradient(135deg, transparent 0 3px, rgb(255 255 255 / 65%) 3px 5px)",
                      }}
                    />
                    <span
                      style={{
                        width: width(row.total - row.base - row.overhang),
                        backgroundColor: row.color,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        Blass sind die Basissitze, schraffiert die Überhangmandate. Weitere
        Sitze erscheinen in voller Farbe.
        {others.length > 0 &&
          " Unter „Sonstige“ sind die übrigen Parteien zusammengefasst."}
      </p>
    </section>
  );
}
