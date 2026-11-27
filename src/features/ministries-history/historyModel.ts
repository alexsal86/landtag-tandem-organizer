import type { Tables } from "@/integrations/supabase/types";
import type { LegislativePeriod } from "./data";

export type HistoryEntry = Tables<"ministry_history_entries">;
export type HistoryLine = Tables<"ministry_history_lines">;
export type HistoryLink = Tables<"ministry_history_links">;

type Dates = Pick<HistoryEntry, "starts_on" | "ends_on">;
type DatedEntry = Dates & Pick<HistoryEntry, "id" | "kind">;
const dateFormat = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
});

export function formatHistoryDate(value: string | null) {
  return value ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : "offen";
}

export function dateLabel(from: string, to: string | null) {
  if (!to) return `seit ${formatHistoryDate(from)}`;
  if (from === to) return formatHistoryDate(from);
  return `${formatHistoryDate(from)} – ${formatHistoryDate(to)}`;
}

function shiftDay(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function effectiveEnd(entry: DatedEntry, entries: DatedEntry[]) {
  const end = entry.ends_on;
  // Historische Amtszeiten verwenden teils den Amtsantritt der Nachfolge als Enddatum.
  if (entry.kind === "term" && end && end > entry.starts_on
    && entries.some(other => other.id !== entry.id && other.kind === "term" && other.starts_on === end)) {
    return shiftDay(end, -1);
  }
  return end;
}

export function historySlices(entries: HistoryEntry[], period?: LegislativePeriod) {
  const windows = entries.map(entry => ({ entry, end: effectiveEnd(entry, entries) }))
    .filter(({ entry, end }) => !period || (entry.starts_on <= period.to && (!end || end >= period.from)));
  if (!windows.length) return [];

  const boundaries = new Set(period ? [period.from, shiftDay(period.to, 1)] : []);
  for (const { entry, end } of windows) {
    boundaries.add(period && entry.starts_on < period.from ? period.from : entry.starts_on);
    if (end && (!period || end < period.to)) boundaries.add(shiftDay(end, 1));
  }

  const sorted = [...boundaries].sort();
  return sorted.flatMap((from, index) => {
    const active = windows.filter(({ entry, end }) => entry.starts_on <= from && (!end || end >= from));
    const next = sorted[index + 1];
    if ((period && from > period.to) || (!next && !active.length)) return [];
    return [{
      from,
      to: next ? shiftDay(next, -1) : null,
      phases: active.filter(({ entry }) => entry.kind === "phase").map(({ entry }) => entry),
      terms: active.filter(({ entry }) => entry.kind === "term").map(({ entry }) => entry),
    }];
  });
}

export function dateWarnings(draft: Dates & Pick<HistoryEntry, "kind" | "line_id">, entries: HistoryEntry[], editingId?: string) {
  if (!draft.line_id || !draft.starts_on || (draft.ends_on && draft.ends_on < draft.starts_on)) return [];

  const peers = entries.filter(entry => entry.id !== editingId && entry.line_id === draft.line_id && entry.kind === draft.kind);
  const entry = { ...draft, id: editingId ?? "" };
  const series = [...peers, entry];
  const endOf = (item: DatedEntry) => effectiveEnd(item, series);
  const end = endOf(entry);
  const warnings: string[] = [];
  const overlaps = peers.filter(peer =>
    (!end || peer.starts_on <= end) && (!endOf(peer) || endOf(peer)! >= entry.starts_on));
  if (overlaps.length) warnings.push(`Überschneidung mit ${overlaps.map(peer => peer.name).join(", ")}.`);

  const earlier = peers.map(endOf).filter((date): date is string => Boolean(date && date < entry.starts_on)).sort().at(-1);
  const later = peers.map(peer => peer.starts_on).filter(date => end && date > end).sort()[0];
  const coversStart = overlaps.some(peer => peer.starts_on <= entry.starts_on);
  const coversEnd = overlaps.some(peer => !endOf(peer) || (end && endOf(peer)! >= end));
  if (!coversStart && earlier && shiftDay(earlier, 1) < entry.starts_on) {
    warnings.push(`Lücke davor: ${dateLabel(shiftDay(earlier, 1), shiftDay(entry.starts_on, -1))}.`);
  }
  if (!coversEnd && end && later && shiftDay(end, 1) < later) {
    warnings.push(`Lücke danach: ${dateLabel(shiftDay(end, 1), shiftDay(later, -1))}.`);
  }
  return warnings;
}
