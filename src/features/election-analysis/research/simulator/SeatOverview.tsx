import { useSearchParams } from "react-router-dom";
import { getPartyColor } from "@/features/election-districts/partyColors";
import { ParliamentHemicycle } from "../../ParliamentHemicycle";
import { DataTable } from "../../shared";
import { format } from "../lab/shared";
import type { SeatParty, SeatResult } from "./types";

export function seatDifference(value: number) {
  return value > 0 ? `+${format(value, 0)}` : format(value, 0);
}

export function SeatOverview({
  view,
  seats,
  reference,
  official,
  unfilled,
}: {
  view: "seats" | "coalitions";
  seats: SeatResult;
  reference?: SeatResult;
  official: boolean;
  unfilled: number | null;
}) {
  const [params, setParams] = useSearchParams();
  const storedCoalition = params.get("seatCoalition");
  const selected =
    storedCoalition === null
      ? null
      : storedCoalition === "none"
        ? []
        : storedCoalition.split(",").filter(Boolean);
  const parties = seats.rows.filter((row) => row.total > 0);
  const threshold = Math.floor(seats.total / 2) + 1;
  const coalitionParties = [...parties].sort(
    (a, b) => b.votes - a.votes || b.total - a.total,
  );
  const selectedIds =
    selected ?? coalitionParties.slice(0, 1).map((party) => party.id);
  const coalition = coalitionParties.filter((party) =>
    selectedIds.includes(party.id),
  );
  const selectedSeats = coalition.reduce((sum, party) => sum + party.total, 0);
  const groups = [
    ...parties.map((party) => ({
      id: party.id,
      name: party.name,
      count: party.total,
    })),
    ...(seats.specialDirect
      ? [
          {
            id: "independent-seats",
            name: "Einzelbewerbungen",
            count: seats.specialDirect,
          },
        ]
      : []),
  ];

  return view === "seats" ? (
    <section className="min-w-0 rounded-lg border bg-card p-4">
      <h4 className="font-semibold">
        {official ? "Amtliches Ergebnis" : "Szenario"}
      </h4>
      <p className="mt-1 text-sm">
        Absolute Mehrheit ab {threshold} Sitzen
        {reference &&
          !official &&
          ` · ${seatDifference(seats.total - reference.total)} Sitze zur Referenz`}
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-x-6 gap-y-4">
        <dl className="grid w-36 shrink-0 gap-3">
          {[
            ["Sitze insgesamt", seats.total],
            ["Überhangmandate", seats.overhang],
            ["Ausgleichsmandate", seats.balance],
            ["Mehrheitszusatz", seats.majorityBonus],
          ].map(([label, count]) => (
            <div
              key={label}
              className="flex flex-col-reverse border-l-2 border-cyan-800 pl-3 dark:border-cyan-400"
            >
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-serif text-3xl leading-none tabular-nums">
                {count}
              </dd>
            </div>
          ))}
        </dl>
        <div className="min-w-0 flex-1 basis-52 space-y-4">
          <ParliamentHemicycle groups={groups} />
        </div>
      </div>
      {reference && !official && (
        <p className="mt-2 text-sm">
          Gegenüber dem amtlichen Ergebnis{" "}
          {seats.rows
            .map((row) => ({
              name: row.name,
              delta:
                row.total -
                (reference.rows.find((party) => party.id === row.id)?.total ??
                  0),
            }))
            .filter((row) => row.delta !== 0)
            .map((row) => `${row.name} ${seatDifference(row.delta)}`)
            .join(" · ") || "keine Änderung bei den Parteisitzen"}
        </p>
      )}
    </section>
  ) : (
    <section className="min-w-0 rounded-lg border bg-card p-4">
      <h4 className="font-semibold">Mehrheitencheck</h4>
      <p className="mt-1 text-sm text-muted-foreground">
        Rechenbasis sind alle {seats.total} Mandatsansprüche vor
        Listenerschöpfung.
        {unfilled === null
          ? " Die tatsächliche Besetzung ist unbekannt."
          : unfilled > 0
            ? ` ${unfilled} Sitze bleiben unbesetzt.`
            : ""}
      </p>
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {parties.flatMap((party, index) => {
          const combinations = [
            { label: party.name, count: party.total },
            ...parties.slice(index + 1).map((partner) => ({
              label: `${party.name} + ${partner.name}`,
              count: party.total + partner.total,
            })),
          ];
          return combinations
            .filter(({ count }) => count >= threshold)
            .map(({ label, count }) => (
              <li key={label} className="rounded-lg border bg-background p-3">
                <p className="font-serif text-xl tabular-nums">
                  {count}{" "}
                  <span className="font-sans text-xs text-muted-foreground">
                    von {seats.total} Sitzen
                  </span>
                </p>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {count === threshold
                    ? "Knappe Mehrheit"
                    : `${count - threshold} Sitze über der Schwelle`}
                </p>
              </li>
            ));
        })}
      </ul>
      <fieldset className="mt-3">
        <legend className="text-sm font-medium">
          Eigene Kombination prüfen
        </legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {coalitionParties.map((party) => (
            <label key={party.id} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={selectedIds.includes(party.id)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  const ids = checked
                    ? [...selectedIds, party.id]
                    : selectedIds.filter((id) => id !== party.id);
                  setParams((old) => {
                    const next = new URLSearchParams(old);
                    next.set("seatCoalition", ids.length ? ids.join(",") : "none");
                    return next;
                  });
                }}
              />
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: getPartyColor(party.id) }}
              />
              {party.name}{" "}
              <span className="tabular-nums text-muted-foreground">
                {party.total}
              </span>
            </label>
          ))}
        </div>
        {seats.total > 0 && (
          <div
            className="mt-4"
            role="img"
            aria-label={`${selectedSeats} von ${seats.total} Sitzen. Absolute Mehrheit ab ${threshold} Sitzen.`}
          >
            <div className="relative pt-6" aria-hidden="true">
              <div className="flex h-6 overflow-hidden rounded bg-muted">
                {coalition.map((party) => (
                  <div
                    key={party.id}
                    title={`${party.name}: ${party.total} Sitze`}
                    style={{
                      width: `${(party.total / seats.total) * 100}%`,
                      backgroundColor: getPartyColor(party.id),
                    }}
                  />
                ))}
              </div>
              <div
                className="pointer-events-none absolute inset-y-0"
                style={{ left: `${(threshold / seats.total) * 100}%` }}
              >
                <span className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded bg-card px-1 text-xs font-semibold text-red-700 dark:text-red-400">
                  Mehrheit ab {threshold}
                </span>
                <span className="absolute top-5 -bottom-1 -translate-x-1/2 border-l-2 border-red-600 dark:border-red-400" />
              </div>
            </div>
            <div
              aria-hidden="true"
              className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground"
            >
              <span>0</span>
              <span>{seats.total} Sitze</span>
            </div>
          </div>
        )}
        {seats.total > 0 && (
          <p role="status" className="mt-2 text-sm font-medium">
            {selectedSeats} von {seats.total} Sitzen ·{" "}
            {selectedSeats < threshold
              ? `${threshold - selectedSeats} fehlen zur Mehrheit`
              : selectedSeats === threshold
                ? "Mehrheit erreicht · genau an der Schwelle"
                : `Mehrheit erreicht · ${selectedSeats - threshold} Sitze über der Schwelle`}
          </p>
        )}
      </fieldset>
    </section>
  );
}

export function SeatThreshold({
  seats,
  parties,
  valid,
}: {
  seats: SeatResult;
  parties: SeatParty[];
  valid: number;
}) {
  const minimum = Math.ceil(valid / 20);
  const rows = seats.rows
    .filter((row) =>
      parties.some((party) => party.id === row.id && party.hasList),
    )
    .sort((a, b) => Math.abs(a.votes - minimum) - Math.abs(b.votes - minimum));
  return (
    <section className="space-y-2" aria-label="5-%-Hürde">
      <h4 className="font-medium">Abstand zur 5-%-Hürde</h4>
      <p className="text-sm text-muted-foreground">
        Für die Teilnahme am Proporz sind mindestens {format(minimum, 0)} von{" "}
        {format(valid, 0)} gültigen Zweitstimmen erforderlich.
      </p>
      <DataTable
        headers={[
          "Partei",
          "Zweitstimmen",
          "Anteil",
          "Stimmen zur Hürde",
          "Mandatsstatus",
        ]}
        rows={rows.map((row) => [
          row.name,
          format(row.votes, 0),
          `${format((100 * row.votes) / valid)} %`,
          row.votes < minimum
            ? `${format(minimum - row.votes, 0)} fehlen`
            : `${format(row.votes - minimum, 0)} Puffer`,
          row.eligible
            ? "Am Proporz beteiligt"
            : row.direct
              ? "Nur Direktmandate"
              : "Kein Mandat",
        ])}
      />
    </section>
  );
}
