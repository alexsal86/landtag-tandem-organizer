import { extractLinesFromHtml, formatDate, type DaySlipDayData, type ResolveTarget } from "./dayslipTypes";

export type ArchiveLineStatus = "done" | "assigned" | "snoozed" | "open";

export type ArchiveLine = { id: string; text: string; status: ArchiveLineStatus; target?: ResolveTarget };
export type ArchiveCounts = Record<ArchiveLineStatus, number>;
export type ArchiveEntry = { key: string; label: string; completedAt?: string; lines: ArchiveLine[]; counts: ArchiveCounts };

const emptyCounts = (): ArchiveCounts => ({ done: 0, assigned: 0, snoozed: 0, open: 0 });

/** Done state is read from the stored content; the day-level list stays as the legacy fallback. */
function doneIdsFromHtml(html: string): Set<string> {
  if (!html.trim()) return new Set();
  const dom = new DOMParser().parseFromString(html, "text/html");
  return new Set(Array.from(dom.querySelectorAll('p[data-done="true"]'), p => p.getAttribute("data-line-id") ?? "").filter(Boolean));
}

/** Done wins over an assignment: a line can be both checked off and exported. */
export function archiveLineStatus(done: boolean, resolved?: { target: ResolveTarget }): ArchiveLineStatus {
  if (done) return "done";
  if (resolved?.target === "snoozed") return "snoozed";
  if (resolved) return "assigned";
  return "open";
}

export function buildArchiveEntry(dayKey: string, day: DaySlipDayData | undefined): ArchiveEntry {
  const struck = new Set(day?.struckLineIds ?? day?.struckLines ?? []);
  const doneInHtml = doneIdsFromHtml(day?.html ?? "");
  const resolved = new Map((day?.resolved ?? []).map(item => [item.lineId, item]));
  const counts = emptyCounts();
  const lines = extractLinesFromHtml(day?.html ?? "").map(line => {
    const item = resolved.get(line.id);
    const status = archiveLineStatus(struck.has(line.id) || doneInHtml.has(line.id), item);
    counts[status] += 1;
    return { id: line.id, text: line.text, status, ...(item ? { target: item.target } : {}) };
  });
  return { key: dayKey, label: formatDate(dayKey), completedAt: day?.completedAt, lines, counts };
}

const normalizeForSearch = (value: string) =>
  value.toLocaleLowerCase("de-DE").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Every token must match the day or one of its lines, so several words narrow the archive. */
export function matchesArchiveQuery(entry: ArchiveEntry, query: string): boolean {
  const tokens = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = normalizeForSearch([entry.key, entry.label, ...entry.lines.map(line => line.text)].join(" "));
  return tokens.every(token => haystack.includes(token));
}

export function filterArchive(entries: ArchiveEntry[], query: string): ArchiveEntry[] {
  return entries.filter(entry => matchesArchiveQuery(entry, query));
}

/** Entries arrive newest first: previous is the older day, next the newer one. */
export function archiveNeighbours(entries: ArchiveEntry[], key: string): { previousKey?: string; nextKey?: string } {
  const index = entries.findIndex(entry => entry.key === key);
  if (index < 0) return {};
  return {
    previousKey: entries[index + 1]?.key,
    nextKey: entries[index - 1]?.key,
  };
}

export function archiveTargetLabel(target: ResolveTarget | undefined): string {
  switch (target) {
    case "task": return "Aufgabe";
    case "note": return "Notiz";
    case "decision": return "Entscheidung";
    case "archived": return "archiviert";
    case "snoozed": return "Wiedervorlage";
    default: return "zugewiesen";
  }
}

export function archiveStatusLabel(line: ArchiveLine): string {
  if (line.status === "assigned") return `zugewiesen: ${archiveTargetLabel(line.target)}`;
  if (line.status === "snoozed") return "Wiedervorlage";
  if (line.status === "done") return "erledigt";
  return "offen";
}
