import { useState } from "react";
import { getPartyColor } from "@/features/election-districts/partyColors";
import { DataTable } from "../../shared";
import { format } from "../lab/shared";
import type { SeatResult } from "./types";

export function seatDifference(value: number) {
  return value > 0 ? `+${format(value, 0)}` : format(value, 0);
}

export function SeatOverview({
  seats,
  reference,
  official,
  unfilled,
}: {
  seats: SeatResult;
  reference?: SeatResult;
  official: boolean;
  unfilled: number | null;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const parties = seats.rows.filter((row) => row.total > 0);
  const threshold = Math.floor(seats.total / 2) + 1;
  const selectedSeats = parties
    .filter((party) => selected.includes(party.id))
    .reduce((sum, party) => sum + party.total, 0);
  const groups = [
    ...parties.map((party) => ({
      name: party.name,
      color: getPartyColor(party.id),
      count: party.total,
    })),
    ...(seats.specialDirect
      ? [{ name: "Einzelbewerbungen", color: "#9ca3af", count: seats.specialDirect }]
      : []),
  ];
  const rings = Math.min(6, Math.ceil(Math.sqrt(seats.total / 6)));
  const radii = Array.from({ length: rings }, (_, ring) =>
    45 - (rings - 1 - ring) * (29 / Math.max(1, rings - 1)),
  );
  const circumferences = radii.reduce((sum, radius) => sum + radius, 0);
  let remaining = seats.total;
  const points = radii.flatMap((radius, ring) => {
    const count = ring === rings - 1
      ? remaining
      : Math.min(remaining, Math.round(seats.total * radius / circumferences));
    remaining -= count;
    return Array.from({ length: count }, (_, index) => {
      const angle = count === 1 ? Math.PI / 2 : Math.PI * index / (count - 1);
      return { angle, radius };
    });
  }).sort((a, b) => b.angle - a.angle || a.radius - b.radius);
  const dots = groups.flatMap((group) => Array<string>(group.count).fill(group.color));

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <section className="min-w-0 rounded-lg border bg-card p-4">
        <h4 className="font-semibold">{official ? "Amtliches Ergebnis" : "Szenario"}</h4>
        <p className="mt-1 text-sm">
          <strong>{seats.total} Sitze</strong> · Mehrheit ab {threshold}
          {reference && !official && ` · ${seatDifference(seats.total - reference.total)} Sitze zur Referenz`}
        </p>
        <p className="text-xs text-muted-foreground">
          {seats.base} Grundsitze · {seats.overhang} Überhang · {seats.balance} Ausgleich · {seats.majorityBonus} Mehrheitszusatz
        </p>
        <div aria-hidden="true" className="relative mx-auto mt-3 aspect-[2/1] w-full max-w-sm">
          {points.map(({ angle, radius }, index) => (
            <span
              key={index}
              className="absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-background"
              style={{
                left: `${50 + radius * Math.cos(angle)}%`,
                top: `${94 - 2 * radius * Math.sin(angle)}%`,
                width: `${Math.min(3.1, 78 / Math.sqrt(seats.total) / 2)}%`,
                backgroundColor: dots[index],
              }}
            />
          ))}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {groups.map((group) => (
            <li key={group.name} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: group.color }} />
              {group.name} <strong>{group.count}</strong>
            </li>
          ))}
        </ul>
        {reference && !official && (
          <p className="mt-2 text-sm">
            Gegenüber dem amtlichen Ergebnis{" "}
            {seats.rows
              .map((row) => ({
                name: row.name,
                delta: row.total - (reference.rows.find((party) => party.id === row.id)?.total ?? 0),
              }))
              .filter((row) => row.delta !== 0)
              .map((row) => `${row.name} ${seatDifference(row.delta)}`)
              .join(" · ") || "keine Änderung bei den Parteisitzen"}
          </p>
        )}
      </section>
      <section className="min-w-0 rounded-lg border bg-card p-4">
        <h4 className="font-semibold">Mehrheitencheck</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Rechenbasis sind alle {seats.total} Mandatsansprüche vor Listenerschöpfung.
          {unfilled === null ? " Die tatsächliche Besetzung ist unbekannt." : unfilled > 0 ? ` ${unfilled} Sitze bleiben unbesetzt.` : ""}
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {parties.flatMap((party, index) => {
            const combinations = [
              { label: party.name, count: party.total },
              ...parties.slice(index + 1).map((partner) => ({
                label: `${party.name} + ${partner.name}`,
                count: party.total + partner.total,
              })),
            ];
            return combinations.filter(({ count }) => count >= threshold).map(({ label, count }) => (
              <li key={label} className="flex flex-wrap justify-between gap-x-2">
                <span>{label}</span>
                <span className="font-medium">{count} Sitze · {count - threshold} über der Schwelle</span>
              </li>
            ));
          })}
        </ul>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium">Eigene Kombination prüfen</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {parties.map((party) => (
              <label key={party.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(party.id)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelected((old) => checked ? [...old, party.id] : old.filter((id) => id !== party.id));
                  }}
                />
                {party.name}
              </label>
            ))}
          </div>
          {selectedSeats > 0 && (
            <p role="status" className="mt-2 text-sm font-medium">
              {selectedSeats} von {seats.total} Sitzen ·{" "}
              {selectedSeats < threshold
                ? `${threshold - selectedSeats} fehlen zur Mehrheit`
                : `Mehrheit erreicht (${selectedSeats - threshold} Sitze über der Schwelle)`}
            </p>
          )}
        </fieldset>
      </section>
    </div>
  );
}

export function SeatThreshold({ seats, valid }: { seats: SeatResult; valid: number }) {
  const minimum = Math.ceil(valid / 20);
  const rows = seats.rows
    .slice()
    .sort((a, b) => Math.abs(a.votes - minimum) - Math.abs(b.votes - minimum));
  return (
    <section className="space-y-2" aria-label="5-%-Hürde">
      <h4 className="font-medium">Abstand zur 5-%-Hürde</h4>
      <p className="text-sm text-muted-foreground">
        Für die Teilnahme am Proporz sind mindestens {format(minimum, 0)} von {format(valid, 0)} gültigen Zweitstimmen erforderlich.
      </p>
      <DataTable
        headers={["Partei", "Zweitstimmen", "Anteil", "Stimmen zur Hürde", "Mandatsstatus"]}
        rows={rows.map((row) => [
          row.name,
          format(row.votes, 0),
          `${format(100 * row.votes / valid)} %`,
          row.votes < minimum ? `${format(minimum - row.votes, 0)} fehlen` : `${format(row.votes - minimum, 0)} Puffer`,
          row.eligible ? "Am Proporz beteiligt" : row.direct ? "Nur Direktmandate" : "Kein Mandat",
        ])}
      />
    </section>
  );
}
