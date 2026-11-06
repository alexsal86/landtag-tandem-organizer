import { readSourceFromDataset, writeSourceToDataset } from "@/components/lexical/DaySlipLineNode";
import {
  type CarryLine, type DaySlipStore, type DaySlipDayData, type DaySlipSource,
  type DaySlipLineEntry, extractLinesFromHtml, toParagraphHtml, normalizeLineText,
} from "./dayslipTypes";

export const emptyDay = (): DaySlipDayData => ({ html: "", plainText: "", struckLineIds: [] });

export function normalizeStore(value: unknown): DaySlipStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const store: DaySlipStore = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !raw || typeof raw !== "object") continue;
    const day = raw as DaySlipDayData;
    if (typeof day.html !== "string") continue;
    const doc = new DOMParser().parseFromString(day.html, "text/html");
    let changed = false;
    const sources = { ...(day.sources ?? {}) };
    doc.querySelectorAll("p").forEach(p => {
      if (!p.dataset.lineId) { p.dataset.lineId = crypto.randomUUID(); changed = true; }
      const own = readSourceFromDataset(p.dataset);
      const listed = sources[p.dataset.lineId];
      // The line itself carries its link; older days only had the separate list.
      if (listed && !own) { writeSourceToDataset(p.dataset, listed); changed = true; }
      else if (own && (!listed || listed.id !== own.id || listed.type !== own.type)) sources[p.dataset.lineId] = own;
    });
    store[key] = { ...day, sources, html: doc.body.innerHTML, plainText: typeof day.plainText === "string" ? day.plainText : "", ...(changed ? { nodes: undefined } : {}) };
  }
  return store;
}

export function collectCarryLines(store: DaySlipStore, today: string): CarryLine[] {
  const result: CarryLine[] = [];
  for (const dayKey of Object.keys(store).filter(key => key < today).sort()) {
    const day = store[dayKey];
    const struck = new Set(day.struckLineIds ?? day.struckLines ?? []);
    const resolved = new Map((day.resolved ?? []).map(item => [item.lineId, item]));
    for (const line of extractLinesFromHtml(day.html)) {
      if (day.carriedTo?.[line.id]) continue;
      const resolution = resolved.get(line.id);
      const due = resolution?.target === "snoozed" && (!resolution.snoozeUntil || resolution.snoozeUntil <= today);
      if (due || (!struck.has(line.id) && !resolution)) result.push({ ...line, sourceDayKey: dayKey, source: day.sources?.[line.id] });
    }
  }
  return result;
}

/** Preserve formatting and separators; deduplicate linked entries by source, free text by text. */
export function appendEntries(day: DaySlipDayData, entries: Array<DaySlipLineEntry & { source?: DaySlipSource }>, deduplicateText = true): DaySlipDayData {
  const existing = extractLinesFromHtml(day.html);
  const sources = { ...day.sources };
  const timestamps = { ...day.lineTimestamps };
  const texts = new Set(existing.filter(line => !sources[line.id]).map(line => normalizeLineText(line.text)));
  const sourceKeys = new Set(Object.values(sources).map(source => `${source.type}:${source.id}`));
  const added = entries.filter(entry => {
    if (!entry.text.trim()) return false;
    if (entry.source) {
      const key = `${entry.source.type}:${entry.source.id}`;
      if (sourceKeys.has(key)) return false;
      sourceKeys.add(key);
      sources[entry.id] = entry.source;
    } else {
      const key = normalizeLineText(entry.text);
      if (deduplicateText && texts.has(key)) return false;
      texts.add(key);
    }
    timestamps[entry.id] = { addedAt: new Date().toISOString() };
    return true;
  });
  if (!added.length) return day;
  return { ...day, html: day.html + added.map(toParagraphHtml).join(""), plainText: [...existing, ...added].map(line => line.text).join("\n"), nodes: undefined, sources, lineTimestamps: timestamps };
}

export function carryLines(store: DaySlipStore, today: string, lines: CarryLine[]): DaySlipStore {
  const next = { ...store };
  let day = next[today] ?? emptyDay();
  for (const line of lines) {
    day = appendEntries(day, [{ id: crypto.randomUUID(), text: line.text, source: line.source }], false);
    const sourceDay = next[line.sourceDayKey];
    next[line.sourceDayKey] = { ...sourceDay, carriedTo: { ...sourceDay.carriedTo, [line.id]: today } };
  }
  next[today] = day;
  return next;
}

export function sourcePath(source: DaySlipSource): string {
  if (source.type === "case") return `/vorgaenge/${encodeURIComponent(source.id)}`;
  const base = { task: "/tasks", note: "/mywork?tab=capture", decision: "/decisions" }[source.type];
  return `${base}${base.includes("?") ? "&" : "?"}highlight=${encodeURIComponent(source.id)}`;
}

/** Same source and destination always use the same primary key, including retries after a lost response. */
export async function exportId(userId: string, dayKey: string, lineId: string, target: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(["dayslip-v3", userId, dayKey, lineId, target]))));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes.slice(0, 16), b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
