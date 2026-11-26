import { shiftDayKey } from "./daySlipNavigation";
import { isDayKey, toDayKey } from "./dayslipTypes";

export type DaySlipShortcutKind = "task" | "note" | "decision";

export type DaySlipAssignee = { id: string; name: string };

export type ParsedDaySlipLine = {
  /** Triage target typed at the line start; undefined keeps the line for manual triage. */
  kind?: DaySlipShortcutKind;
  /** Text without shortcut tokens — used as the title of the created object. */
  text: string;
  person?: DaySlipAssignee;
  /** Due date as YYYY-MM-DD. */
  dueDate?: string;
};

export const SHORTCUT_HELP = [
  { marker: "+ Aufgabe", description: "Beim Abschluss als Aufgabe vormerken" },
  { marker: "~ Notiz", description: "Beim Abschluss als Notiz vormerken" },
  { marker: "? Entscheidung", description: "Beim Abschluss als Entscheidung vormerken" },
  { marker: "@Name", description: "Aufgabe einer Person aus dem Team zuweisen" },
  { marker: ">3.3.", description: "Fälligkeit setzen (auch >morgen, >2026-12-01, >+3)" },
] as const;

const TARGET_MARKERS: Record<string, DaySlipShortcutKind> = {
  "+": "task",
  "~": "note",
  "?": "decision",
};

const RELATIVE_DAYS: Record<string, number> = {
  heute: 0,
  morgen: 1,
  "übermorgen": 2,
  uebermorgen: 2,
};

const normalizeName = (value: string) => value.trim().toLocaleLowerCase("de-DE");

/** Exact name first, then an unambiguous prefix — two people named "Müller" stay unresolved. */
export function matchAssignee(name: string, users: DaySlipAssignee[]): DaySlipAssignee | undefined {
  const needle = normalizeName(name);
  if (!needle) return undefined;
  const exact = users.filter(user => normalizeName(user.name) === needle);
  if (exact.length === 1) return exact[0];
  const prefixed = users.filter(user => normalizeName(user.name).startsWith(needle));
  return prefixed.length === 1 ? prefixed[0] : undefined;
}

function asDayKey(year: number, month: number, day: number): string | undefined {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return toDayKey(date);
}

/**
 * Accepts the compact forms people actually type: heute/morgen/übermorgen, +N days,
 * YYYY-MM-DD and DD.MM. (year inferred as the next occurrence) or DD.MM.YYYY.
 */
export function parseDueDate(token: string, todayKey: string): string | undefined {
  const value = token.trim().toLocaleLowerCase("de-DE");
  if (!value) return undefined;
  if (value in RELATIVE_DAYS) return shiftDayKey(todayKey, RELATIVE_DAYS[value]);
  const relative = value.match(/^\+(\d{1,3})$/);
  if (relative) return shiftDayKey(todayKey, Number(relative[1]));
  if (isDayKey(value)) return asDayKey(Number(value.slice(0, 4)), Number(value.slice(5, 7)), Number(value.slice(8, 10)));

  const german = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/);
  if (!german) return undefined;
  const day = Number(german[1]);
  const month = Number(german[2]);
  if (german[3]) return asDayKey(Number(german[3]), month, day);

  const year = Number(todayKey.slice(0, 4));
  const sameYear = asDayKey(year, month, day) ?? asDayKey(year + 1, month, day);
  if (!sameYear) return undefined;
  return sameYear < todayKey ? asDayKey(year + 1, month, day) ?? asDayKey(year + 2, month, day) : sameYear;
}

/**
 * Reads line shortcuts without changing the sheet: a leading +, ~ or ? names the triage
 * target, @Name and >date refine a task. A marker needs a following space, so phone
 * numbers such as "+49 30 …" keep their meaning.
 */
export function parseDaySlipLine(
  raw: string,
  options: { todayKey: string; users?: DaySlipAssignee[] },
): ParsedDaySlipLine {
  const original = raw.trim();
  let rest = original;
  let kind: DaySlipShortcutKind | undefined;

  const marker = rest.match(/^([+~?])(?:\s+|$)/);
  if (marker) {
    kind = TARGET_MARKERS[marker[1]];
    rest = rest.slice(marker[0].length).trim();
  }

  const kept: string[] = [];
  let person: DaySlipAssignee | undefined;
  let dueDate: string | undefined;
  let consumed = Boolean(kind);
  for (const token of rest ? rest.split(/\s+/) : []) {
    // @Name and >date refine tasks; on notes and decisions they stay part of the text.
    if (kind === "task" && !person && token.length > 1 && token.startsWith("@")) {
      const match = matchAssignee(token.slice(1), options.users ?? []);
      if (match) { person = match; consumed = true; continue; }
    }
    if (kind === "task" && !dueDate && token.length > 1 && token.startsWith(">")) {
      const parsed = parseDueDate(token.slice(1), options.todayKey);
      if (parsed) { dueDate = parsed; consumed = true; continue; }
    }
    kept.push(token);
  }

  // Without a recognised shortcut the line must stay byte-for-byte as typed.
  return consumed
    ? { kind, text: kept.join(" ").trim(), person, dueDate }
    : { text: original, person, dueDate };
}
