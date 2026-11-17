import type { ElectionPeriod } from './types';
import { seatBasisLabels } from './periodSeats';
import { formatHistoryDateInput } from './model';

export function PeriodSeatSummary({ period, compact = false }: { period: ElectionPeriod; compact?: boolean }) {
  const rows = period.seat_distribution || [];
  const total = period.seat_total ?? null;
  const sum = rows.reduce((n, row) => n + row.seats, 0);
  const metadata = <div className="space-y-1 text-xs text-muted-foreground">
    <p>{seatBasisLabels[period.seat_basis || 'unknown']}{period.seat_reference_date ? ` · Stand ${formatHistoryDateInput(period.seat_reference_date)}` : ''}</p>
    {(period.seat_basis === 'election_result' || period.seat_basis === 'opening') && <p>Spätere Fraktionswechsel sind nicht enthalten.</p>}
    {period.seat_notes && <p className="whitespace-pre-wrap">{period.seat_notes}</p>}
    {period.seat_source_url && <a href={period.seat_source_url} className="inline-block break-all underline" target="_blank" rel="noopener noreferrer">Quelle der Sitzzahlen</a>}
  </div>;
  return <section aria-label={`Sitzverteilung ${period.name}`} className="min-w-0 space-y-2 [overflow-wrap:anywhere]">
    <p className="font-semibold tabular-nums">{total === null ? 'Gesamtsitze nicht erfasst' : `${total} Sitze`}</p>
    {rows.length > 0 ? <ul className={compact ? 'space-y-1 text-caption' : 'grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3'}>{rows.map(row => <li key={row.faction} className="flex min-w-0 items-start justify-between gap-2"><span>{row.faction}</span><strong className="shrink-0 tabular-nums">{row.seats}</strong></li>)}</ul> : <p className="text-xs text-muted-foreground">Partei-/Fraktionsverteilung noch nicht erfasst.</p>}
    {rows.length > 0 && (total === null || sum !== total) && <p className="text-xs text-muted-foreground">{total === null ? `${sum} Sitze den erfassten Parteien / Fraktionen zugeordnet; Gesamtzahl offen.` : `${sum} von ${total} Sitzen zugeordnet · Verteilung unvollständig.`}</p>}
    {compact ? <details><summary className="cursor-pointer text-xs">Stand & Quelle</summary><div className="mt-1">{metadata}</div></details> : metadata}
  </section>;
}
