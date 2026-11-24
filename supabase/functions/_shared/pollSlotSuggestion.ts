/**
 * Slot-Vorschläge für Terminabstimmungen aus Frei/Gebucht.
 *
 * Eingang sind die belegten Zeiten aller Teilnehmer (interne Termine, externe
 * Kalender, Abwesenheiten — aus public.get_poll_availability) und ein
 * Suchfenster. Vorgeschlagen werden Kandidaten im Raster der Arbeitszeit, die
 * mit keinem belegten Zeitraum kollidieren; jeder belegte Zeitraum wird vorher
 * um den gewünschten Puffer verbreitert (Vor- und Nachlauf).
 *
 * Teilnehmer ohne Frei/Gebucht-Daten (kein Konto im Mandanten, externer
 * Kalender unbekannt) gelten ausdrücklich NICHT als frei: sie erscheinen in
 * `unknownEmails`, und `fullyFree` ist nur true, wenn alle Teilnehmer bekannt
 * und konfliktfrei sind. Wer die Verfügbarkeit ermittelt hat, übergibt die
 * auflösbaren Adressen in `knownParticipants`; ohne diese Angabe gelten alle
 * Teilnehmer als bekannt (rückwärtskompatibel).
 *
 * Alle Rechnungen laufen in UTC; die Arbeitszeit wird als Wandzeit in
 * `timeZone` (Standard Europe/Berlin) aufgelöst, damit Sommer-/Winterzeit
 * keinen Einfluss hat. Wird von der Edge-Function-Schicht, der UI und dem
 * Selbsttest genutzt (Re-Export: src/features/polls/pollRules.ts).
 */

import { localWallToUtc } from "./icsTime.ts";

export const DEFAULT_POLL_TIME_ZONE = "Europe/Berlin";
export const DEFAULT_POLL_WORKDAY_START_HOUR = 9;
export const DEFAULT_POLL_WORKDAY_END_HOUR = 17;
export const DEFAULT_POLL_GRID_MINUTES = 30;
export const DEFAULT_POLL_MAX_PER_DAY = 2;
export const DEFAULT_POLL_SUGGESTION_LIMIT = 8;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export interface PollBusyInterval {
  email: string;
  /** ISO-Zeitpunkt (UTC). */
  start: string;
  /** ISO-Zeitpunkt (UTC). */
  end: string;
  /** Herkunft, z. B. "termin", "externer_kalender", "abwesenheit". */
  source?: string;
}

export interface PollExistingSlot {
  /** ISO-Zeitpunkt (UTC). */
  start: string;
  /** ISO-Zeitpunkt (UTC). */
  end: string;
}

export interface PollSlotSuggestionInput {
  /** E-Mail-Adressen der Teilnehmer; Schreibweise ist unerheblich. */
  participants: string[];
  /**
   * Teilnehmer, für die tatsächlich Frei/Gebucht-Daten vorliegen. Fehlt die
   * Angabe, gelten alle Teilnehmer als bekannt.
   */
  knownParticipants?: string[];
  busy: PollBusyInterval[];
  windowStart: string;
  windowEnd: string;
  durationMinutes: number;
  bufferMinutes: number;
  gridMinutes?: number;
  workdayStartHour?: number;
  workdayEndHour?: number;
  /** Standard true: nur Montag bis Freitag. */
  weekdaysOnly?: boolean;
  /** Höchstens so viele Vorschläge pro Kalendertag (Standard 2). */
  maxPerDay?: number;
  limit?: number;
  /** Zeitzone der Arbeitszeit (Standard Europe/Berlin). */
  timeZone?: string;
  /** Bereits in der Abstimmung vorhandene Slots werden nicht erneut vorgeschlagen. */
  existingSlots?: PollExistingSlot[];
}

export interface PollSlotSuggestion {
  start: string;
  end: string;
  /** Teilnehmer mit bekanntem, konfliktfreiem Kalender (inkl. Puffer). */
  freeEmails: string[];
  /** Teilnehmer mit belegter Zeit im Slot oder Puffer. */
  busyEmails: string[];
  /** Teilnehmer ohne Frei/Gebucht-Daten — ihre Verfügbarkeit ist unbekannt. */
  unknownEmails: string[];
  /** true nur, wenn alle Teilnehmer bekannt und konfliktfrei sind. */
  fullyFree: boolean;
}

interface TimeRange {
  start: number;
  end: number;
}

/** E-Mail-Adressen normalisieren und dublettenfrei halten. */
export function normalizeParticipantEmails(emails: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const email of emails) {
    const normalized = (email ?? "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

/** Überlappende oder aneinanderliegende Zeiträume zusammenfassen. */
export function mergeTimeRanges(ranges: readonly TimeRange[]): TimeRange[] {
  const sorted = ranges
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
    .map((range) => ({ ...range }))
    .sort((left, right) => left.start - right.start);

  const merged: TimeRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
      continue;
    }
    merged.push(range);
  }

  return merged;
}

/** Belegte Zeit je Teilnehmer, inkl. Puffer und zusammengefasst. */
export function buildBlockedRanges(
  busy: readonly PollBusyInterval[],
  bufferMinutes: number,
): Map<string, TimeRange[]> {
  const bufferMs = Math.max(0, Math.round(bufferMinutes)) * MINUTE_MS;
  const grouped = new Map<string, TimeRange[]>();

  for (const entry of busy) {
    const email = (entry.email ?? "").trim().toLowerCase();
    const start = Date.parse(entry.start);
    const end = Date.parse(entry.end);
    if (!email || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    const ranges = grouped.get(email) ?? [];
    ranges.push({ start: start - bufferMs, end: end + bufferMs });
    grouped.set(email, ranges);
  }

  for (const [email, ranges] of grouped) {
    grouped.set(email, mergeTimeRanges(ranges));
  }

  return grouped;
}

function hasOverlap(left: TimeRange, right: TimeRange): boolean {
  return left.start < right.end && right.start < left.end;
}

function clampHour(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function localDateParts(instantMs: number, timeZone: string): { year: number; month: number; day: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(instantMs));
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const year = read("year");
    const month = read("month");
    const day = read("day");
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return { year, month, day };
    }
  } catch {
    // Unbekannte Zeitzone: auf UTC zurückfallen, statt stillschweigend zu raten.
  }

  const fallback = new Date(instantMs);
  return { year: fallback.getUTCFullYear(), month: fallback.getUTCMonth() + 1, day: fallback.getUTCDate() };
}

/**
 * Schlägt Termin-Slots vor, an denen möglichst alle Teilnehmer frei sind.
 * Sortiert nach Anzahl der Konflikte, danach chronologisch.
 */
export function suggestPollSlots(input: PollSlotSuggestionInput): PollSlotSuggestion[] {
  const participants = normalizeParticipantEmails(input.participants);
  if (participants.length === 0) return [];

  const durationMinutes = Math.round(input.durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return [];

  const bufferMinutes = Math.max(0, Math.round(input.bufferMinutes));
  const gridMinutes = Math.max(5, Math.round(input.gridMinutes ?? DEFAULT_POLL_GRID_MINUTES));
  const workdayStartHour = clampHour(input.workdayStartHour ?? DEFAULT_POLL_WORKDAY_START_HOUR, 0, 23);
  const workdayEndHour = clampHour(input.workdayEndHour ?? DEFAULT_POLL_WORKDAY_END_HOUR, 1, 24);
  const timeZone = input.timeZone || DEFAULT_POLL_TIME_ZONE;
  const maxPerDay = Math.max(1, Math.round(input.maxPerDay ?? DEFAULT_POLL_MAX_PER_DAY));
  const limit = Math.max(1, Math.round(input.limit ?? DEFAULT_POLL_SUGGESTION_LIMIT));

  const windowStart = Date.parse(input.windowStart);
  const windowEnd = Date.parse(input.windowEnd);
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart) return [];
  if (workdayEndHour * 60 - workdayStartHour * 60 < durationMinutes) return [];

  const known = input.knownParticipants === undefined
    ? new Set(participants)
    : new Set(normalizeParticipantEmails(input.knownParticipants));
  const unknownEmails = participants.filter((email) => !known.has(email));
  const isUnknown = new Set(unknownEmails);

  const blocked = buildBlockedRanges(input.busy ?? [], bufferMinutes);
  const existing = (input.existingSlots ?? [])
    .map((slot) => ({ start: Date.parse(slot.start), end: Date.parse(slot.end) }))
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start);

  const firstDay = localDateParts(windowStart, timeZone);
  let dayCursor = Date.UTC(firstDay.year, firstDay.month - 1, firstDay.day);
  const lastDayLimit = windowEnd + DAY_MS;
  const collected: PollSlotSuggestion[] = [];

  // Tag für Tag im Kalender der Ziel-Zeitzone; DAY_MS-Schritte auf einem
  // synthetischen UTC-Datum bleiben von Zeitumstellungen unberührt.
  while (dayCursor <= lastDayLimit) {
    const weekday = new Date(dayCursor).getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;

    if (!isWeekend || input.weekdaysOnly === false) {
      const dayCandidates: PollSlotSuggestion[] = [];

      for (
        let minuteOfDay = workdayStartHour * 60;
        minuteOfDay + durationMinutes <= workdayEndHour * 60;
        minuteOfDay += gridMinutes
      ) {
        const wallMs = dayCursor + minuteOfDay * MINUTE_MS;
        const startMs = localWallToUtc(timeZone, wallMs);
        const endMs = startMs + durationMinutes * MINUTE_MS;
        if (startMs < windowStart || endMs > windowEnd) continue;

        const candidate: TimeRange = { start: startMs, end: endMs };
        if (existing.some((range) => hasOverlap(candidate, range))) continue;

        const busyEmails = participants.filter((email) =>
          (blocked.get(email) ?? []).some((range) => hasOverlap(candidate, range)),
        );
        // Unbekannte Kalender zählen nicht als frei — nur nachweislich freie Teilnehmer.
        const freeEmails = participants.filter((email) => !isUnknown.has(email) && !busyEmails.includes(email));

        dayCandidates.push({
          start: new Date(startMs).toISOString(),
          end: new Date(endMs).toISOString(),
          freeEmails,
          busyEmails,
          unknownEmails,
          fullyFree: busyEmails.length === 0 && unknownEmails.length === 0,
        });
      }

      dayCandidates.sort(
        (left, right) =>
          left.busyEmails.length - right.busyEmails.length ||
          left.unknownEmails.length - right.unknownEmails.length ||
          Date.parse(left.start) - Date.parse(right.start),
      );
      collected.push(...dayCandidates.slice(0, maxPerDay));
    }

    dayCursor += DAY_MS;
  }

  return collected
    .sort((left, right) =>
      left.busyEmails.length - right.busyEmails.length ||
      left.unknownEmails.length - right.unknownEmails.length ||
      Date.parse(left.start) - Date.parse(right.start),
    )
    .slice(0, limit)
    .sort((left, right) => Date.parse(left.start) - Date.parse(right.start));
}
