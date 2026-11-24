/**
 * Berliner Zeitrechnung für Fristen und Entscheidungen.
 *
 * `new Date('2026-11-25')` ist UTC-Mitternacht und damit in Berlin erst 01:00
 * (Winter) bzw. 02:00 (Sommer); `toISOString().slice(0, 10)` verschiebt
 * Berliner Zeiten zwischen 00:00 und 02:00 auf den Vortag. Für Tagesgrenzen
 * darf daher weder das eine noch das andere verwendet werden, sondern immer
 * der Berliner Kalendertag aus diesen Helfern.
 */

export const BERLIN_TIME_ZONE = "Europe/Berlin";

const toDate = (value: string | Date) => typeof value === "string" ? new Date(value) : value;

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BERLIN_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const clockFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: BERLIN_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const shortDateFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: BERLIN_TIME_ZONE, day: "2-digit", month: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: BERLIN_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric",
});
const shortWeekdayDateFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: BERLIN_TIME_ZONE, weekday: "short", day: "2-digit", month: "2-digit",
});
const weekdayFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: BERLIN_TIME_ZONE, weekday: "long",
});
const weekdayLongDateFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: BERLIN_TIME_ZONE, weekday: "long", day: "numeric", month: "long",
});
const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BERLIN_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  hourCycle: "h23",
});

/** Berliner Kalendertag als YYYY-MM-DD, unabhängig von der Browser-Zeitzone. */
export const berlinDayKey = (value: string | Date): string => dayKeyFormatter.format(toDate(value));

/** Verschiebt einen Berliner Tageschlüssel um Kalendertage (UTC-Mittag nur als Rechenanker). */
export const shiftBerlinDay = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Kalendertage zwischen `day` und `now` in Berliner Zeit; positiv = `day` liegt zurück. */
export function berlinDaysSince(day: string | Date, now: Date = new Date()): number {
  const from = Date.parse(`${berlinDayKey(day)}T12:00:00Z`);
  const to = Date.parse(`${berlinDayKey(now)}T12:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/** Sonntag der Berliner Kalenderwoche (Montag als Wochenstart). */
export function berlinWeekEnd(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sonntag
  return shiftBerlinDay(day, (7 - weekday) % 7);
}

/**
 * Berliner Mitternacht des Kalendertags, in dem `value` liegt.
 * Für timestamptz-Spalten, damit die Anzeige denselben Tag zeigt wie die Eingabe.
 */
export const berlinStartOfDay = (value: string | Date = new Date()): Date =>
  berlinDateTimeToInstant(`${berlinDayKey(value)}T00:00`);

/** Uhrzeit in Berliner Zeit, z. B. „08:00“. */
export const berlinClock = (value: string | Date): string => clockFormatter.format(toDate(value));

/** Datum in Berliner Zeit, z. B. „25.11.“ (de-DE setzt den Punkt selbst). */
export const berlinDateShort = (value: string | Date): string => shortDateFormatter.format(toDate(value));

/** Datum in Berliner Zeit, z. B. „25.11.2026“. */
export const berlinDate = (value: string | Date): string => dateFormatter.format(toDate(value));

/** Wochentag und Datum, z. B. „Mi., 25.11.“. */
export const berlinWeekdayShortDate = (value: string | Date): string => shortWeekdayDateFormatter.format(toDate(value));

/** Wochentag, z. B. „Mittwoch“. */
export const berlinWeekday = (value: string | Date): string => weekdayFormatter.format(toDate(value));

/** Wochentag und ausgeschriebenes Datum, z. B. „Mittwoch, 25. November“. */
export const berlinWeekdayDate = (value: string | Date): string => weekdayLongDateFormatter.format(toDate(value));

/** Wert für <input type="datetime-local"> in Berliner Wandzeit. */
export function berlinDateTimeValue(value: string | Date): string {
  const parts = berlinParts(toDate(value));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Berliner Wandzeit aus <input type="datetime-local"> als Zeitpunkt. */
export function berlinDateTimeToInstant(wall: string): Date {
  const [datePart, timePart = "00:00"] = wall.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour || 0, minute || 0);
  const firstOffset = berlinOffsetMs(wallAsUtc);
  // Zweiter Durchlauf fängt die Stundenverschiebung an den Sommerzeit-Grenzen ab.
  return new Date(wallAsUtc - berlinOffsetMs(wallAsUtc - firstOffset));
}

function berlinParts(date: Date) {
  const parts = partsFormatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return { year: pick("year"), month: pick("month"), day: pick("day"), hour: pick("hour"), minute: pick("minute") };
}

/** Abstand Berliner Wandzeit zu UTC in Millisekunden (Sommerzeit-richtig). */
function berlinOffsetMs(instantMs: number): number {
  const parts = berlinParts(new Date(instantMs));
  const wallAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute),
  );
  return wallAsUtc - Math.floor(instantMs / 60_000) * 60_000;
}
