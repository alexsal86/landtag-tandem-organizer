import { readSourceFromDataset, writeSourceToDataset } from "@/components/lexical/DaySlipLineNode";
import {
  type CarryLine, type DaySlipStore, type DaySlipDayData, type DaySlipSource,
  type DaySlipLineEntry, type ResolvedItem, extractLinesFromHtml, toParagraphHtml, toRuleHtml, parseRuleLine, toDayKey, normalizeLineText, isDayKey,
} from "./dayslipTypes";

export const emptyDay = (): DaySlipDayData => ({ html: "", plainText: "", struckLineIds: [] });

export function normalizeStore(value: unknown): DaySlipStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const store: DaySlipStore = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isDayKey(key) || !raw || typeof raw !== "object") continue;
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

/**
 * Whether a slip already carries work of its own. Completion flags are not part of this:
 * the automatic start decision needs to look at content, independent of earlier decisions.
 */
export function hasDaySlipContent(day?: DaySlipDayData): boolean {
  if (!day) return false;
  if (day.completedAt) return true;
  if (extractLinesFromHtml(day.html).length > 0 || day.html.includes("labeled-hr")) return true;
  if (Object.keys(day.sources ?? {}).length > 0 || Object.keys(day.lineTimestamps ?? {}).length > 0) return true;
  return (day.resolved ?? []).length > 0;
}

/**
 * Planned lines of a day that its slip does not carry yet, compared by normalized text.
 * Used for the manual adoption offered on a slip that was already started, where the automatic
 * start decision deliberately inserts nothing.
 */
export function missingDaySlipLines(day: DaySlipDayData | undefined, lines: string[]): string[] {
  if (!day) return lines.filter(line => line.trim());
  const present = new Set(extractLinesFromHtml(day.html).map(line => normalizeLineText(line.text)));
  return lines.filter(line => line.trim() && !present.has(normalizeLineText(line)));
}

export type DayStartInput = {
  templateLines: string[];
  recurringLines: string[];
  weekPlanLines: string[];
};

export type DayStartDecision = {
  day: DaySlipDayData;
  templateApplied: boolean;
  weekPlanApplied: boolean;
  recurringApplied: boolean;
};

/**
 * The one automatic start decision per day for every source: weekday template, week plan and
 * recurring routines. The slip is judged once, before any source inserts, so the template and
 * the day's planned lines only go into a slip that has not begun; a slip that is already in use
 * never receives them later. Recurring routines are daily to-dos and still join a started slip,
 * but only once. Every flag is recorded, including a deliberate “nothing”, so a slip that is
 * emptied later never receives the template or the plan afterwards.
 */
export function decideDayStart(day: DaySlipDayData | undefined, input: DayStartInput): DayStartDecision {
  const base = day ?? emptyDay();
  const unstarted = !hasDaySlipContent(base);
  let next = base;
  const templateApplied = input.templateLines.length > 0 && unstarted && !base.dayTemplateInjected;
  if (templateApplied) next = appendStructuredLines(next, input.templateLines);
  const weekPlanApplied = input.weekPlanLines.length > 0 && unstarted && !base.weekPlanInjected;
  if (weekPlanApplied) next = appendEntries(next, input.weekPlanLines.map(text => ({ id: crypto.randomUUID(), text })));
  const recurringApplied = input.recurringLines.length > 0 && !base.recurringInjected;
  if (recurringApplied) next = appendEntries(next, input.recurringLines.map(text => ({ id: crypto.randomUUID(), text })));
  return {
    day: {
      ...next,
      dayTemplateInjected: true,
      recurringInjected: true,
      weekPlanInjected: base.weekPlanInjected || input.weekPlanLines.length > 0,
    },
    templateApplied,
    weekPlanApplied,
    recurringApplied,
  };
}

/** Template lines keep their section rules and priorities; they are not plain text entries. */
export function appendStructuredLines(day: DaySlipDayData, lines: string[]): DaySlipDayData {
  const trimmed = lines.map(line => line.trim()).filter(Boolean);
  if (!trimmed.length) return day;
  const html = trimmed.map(text => {
    const rule = parseRuleLine(text);
    return rule.isRule ? toRuleHtml(rule.label) : toParagraphHtml({ id: crypto.randomUUID(), text });
  }).join("");
  const nextHtml = day.html + html;
  return { ...day, html: nextHtml, plainText: extractLinesFromHtml(nextHtml).map(line => line.text).join("\n"), nodes: undefined };
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

/** Everything needed to put a deleted line back exactly where it was. */
export type RemovedDaySlipLine = {
  lineId: string;
  text: string;
  html: string;
  /** Position among the day's block elements, so undo restores the original order. */
  index: number;
  source?: DaySlipSource;
  struck: boolean;
  addedAt?: string;
  checkedAt?: string;
  resolved?: ResolvedItem;
};

/**
 * Deletes one line. Lines whose export already happened stay: the linked object
 * is the destination, not a draft that may disappear.
 */
export function removeLineFromDay(day: DaySlipDayData, lineId: string): { day: DaySlipDayData; removed: RemovedDaySlipLine | null } {
  const resolved = day.resolved?.find(item => item.lineId === lineId);
  if (resolved?.persisted) return { day, removed: null };
  const doc = new DOMParser().parseFromString(day.html, "text/html");
  const element = Array.from(doc.querySelectorAll("p")).find(paragraph => paragraph.dataset.lineId === lineId);
  if (!element) return { day, removed: null };
  const removed: RemovedDaySlipLine = {
    lineId,
    text: (element.textContent ?? "").trim(),
    html: element.outerHTML,
    index: Array.from(doc.body.children).indexOf(element),
    source: day.sources?.[lineId],
    struck: (day.struckLineIds ?? day.struckLines ?? []).includes(lineId),
    addedAt: day.lineTimestamps?.[lineId]?.addedAt,
    checkedAt: day.lineTimestamps?.[lineId]?.checkedAt,
    resolved,
  };
  element.remove();
  const html = doc.body.innerHTML;
  const sources = { ...day.sources };
  delete sources[lineId];
  const lineTimestamps = { ...day.lineTimestamps };
  delete lineTimestamps[lineId];
  return {
    removed,
    day: {
      ...day,
      html,
      plainText: extractLinesFromHtml(html).map(line => line.text).join("\n"),
      nodes: undefined,
      sources,
      lineTimestamps,
      struckLineIds: (day.struckLineIds ?? day.struckLines ?? []).filter(id => id !== lineId),
      resolved: day.resolved?.filter(item => item.lineId !== lineId),
    },
  };
}

/** Undo for a deletion: restoring twice or into a day that already has the line changes nothing. */
export function restoreLineToDay(day: DaySlipDayData, removed: RemovedDaySlipLine): DaySlipDayData {
  const doc = new DOMParser().parseFromString(day.html, "text/html");
  if (Array.from(doc.querySelectorAll("p")).some(paragraph => paragraph.dataset.lineId === removed.lineId)) return day;
  const element = new DOMParser().parseFromString(removed.html, "text/html").body.firstElementChild;
  if (!element) return day;
  const children = Array.from(doc.body.children);
  const position = Math.min(Math.max(removed.index, 0), children.length);
  doc.body.insertBefore(doc.importNode(element, true), children[position] ?? null);
  const html = doc.body.innerHTML;
  const struck = new Set(day.struckLineIds ?? day.struckLines ?? []);
  if (removed.struck) struck.add(removed.lineId); else struck.delete(removed.lineId);
  const lineTimestamps = { ...day.lineTimestamps };
  if (removed.addedAt || removed.checkedAt) {
    lineTimestamps[removed.lineId] = {
      addedAt: removed.addedAt ?? new Date().toISOString(),
      ...(removed.checkedAt ? { checkedAt: removed.checkedAt } : {}),
    };
  }
  return {
    ...day,
    html,
    plainText: extractLinesFromHtml(html).map(line => line.text).join("\n"),
    nodes: undefined,
    sources: removed.source ? { ...day.sources, [removed.lineId]: removed.source } : day.sources,
    lineTimestamps,
    struckLineIds: [...struck],
    resolved: removed.resolved && !day.resolved?.some(item => item.lineId === removed.lineId)
      ? [...(day.resolved ?? []), removed.resolved]
      : day.resolved,
  };
}

export function sourcePath(source: DaySlipSource): string {
  if (source.type === "case") return `/mywork?tab=cases&caseItemId=${encodeURIComponent(source.id)}&highlight=${encodeURIComponent(source.id)}`;
  const base = { task: "/tasks", note: "/notes", decision: "/decisions" }[source.type];
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

export type MoodTrendPoint = {
  dayKey: string;
  weekday: string;
  mood: 1 | 2 | 3 | 4 | 5 | null;
};

/** Last `days` calendar days ending today, oldest first; missing moods stay gaps, never zeros. */
export function moodTrend(store: DaySlipStore, todayKey: string, days = 14): MoodTrendPoint[] {
  const base = new Date(`${todayKey}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() - (days - 1 - index));
    const dayKey = toDayKey(date);
    return { dayKey, weekday: weekday.format(date), mood: store[dayKey]?.dayMood ?? null };
  });
}

/** Saving a working day is not the same as explicitly completing it. */
export function completedArchiveDays(store: DaySlipStore, today: string): string[] {
  return Object.keys(store).filter((key) => key <= today && typeof store[key].completedAt === "string"
    && Number.isFinite(Date.parse(store[key].completedAt!))).sort((a, b) => b.localeCompare(a));
}
