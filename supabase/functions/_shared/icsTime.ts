/**
 * Auflösung von ICS-Zeitwerten (DTSTART/DTEND) mit Zeitzonenbezug.
 *
 * Regeln nach RFC 5545:
 * - `...Z` ist UTC.
 * - `TZID=...` wird über die VTIMEZONE des Feeds (Übergänge inkl. RRULE) und
 *   ersatzweise über die IANA-Zeitzone aufgelöst.
 * - `VALUE=DATE` (reine `YYYYMMDD`-Werte) sind ganztägige Kalendertage und
 *   werden als UTC-Mitternacht abgebildet; ein DTEND ist exklusiv.
 * - Werte ohne Z und ohne TZID sind "floating" und gelten in der Zeitzone des
 *   Betrachters (hier Europe/Berlin, die Zeitzone des Büros).
 *
 * Alle Rechnungen laufen in UTC und sind damit unabhängig von der Zeitzone des
 * ausführenden Prozesses (Deno, Browser, CI).
 */

export interface IcsDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface IcsProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

export interface IcsObservance {
  kind: "STANDARD" | "DAYLIGHT";
  offsetFromMinutes: number;
  offsetToMinutes: number;
  startLocal: IcsDateTimeParts;
  rrule?: string;
  rdates?: string[];
}

export interface IcsTimeZone {
  tzid: string;
  observances: IcsObservance[];
}

export interface IcsResolvedDate {
  date: Date;
  /** true bei VALUE=DATE (ganztägig). */
  dateOnly: boolean;
  /** Aufgelöste Zeitzone, sofern der Wert eine hatte. */
  tzid: string | null;
  /** true, wenn keine Zeitzone angegeben war (Wandzeit des Betrachters). */
  floating: boolean;
}

export interface IcsDateTimeParser {
  timeZones: Map<string, IcsTimeZone>;
  resolveDateTime(value: string, params?: Record<string, string>): IcsResolvedDate | null;
  /** LAST-MODIFIED/DTSTAMP sind laut RFC immer UTC. */
  resolveUtc(value: string): Date | null;
}

export const DEFAULT_FLOATING_TIME_ZONE = "Europe/Berlin";

/** Windows-Zeitzonennamen, die Outlook in TZID schreibt. */
const WINDOWS_TIME_ZONES: Record<string, string> = {
  "w. europe standard time": "Europe/Berlin",
  "central europe standard time": "Europe/Budapest",
  "central european standard time": "Europe/Warsaw",
  "romance standard time": "Europe/Paris",
  "gmt standard time": "Europe/London",
  "utc": "UTC",
  "coordinated universal time": "UTC",
  "eastern standard time": "America/New_York",
  "central standard time": "America/Chicago",
  "mountain standard time": "America/Denver",
  "pacific standard time": "America/Los_Angeles",
};

interface IcsTransition {
  atUtc: number;
  offsetFromMinutes: number;
  offsetToMinutes: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const zoneValidity = new Map<string, boolean>();

/**
 * Entfaltet Zeilen nach RFC 5545 (Folgezeilen beginnen mit Leerzeichen/Tab)
 * und entfernt Leerzeilen. Nur das eine Faltungszeichen wird entfernt.
 */
export function parseIcsContentLines(icsContent: string): string[] {
  const rawLines = icsContent.split(/\r?\n/);
  const lines: string[] = [];

  for (const rawLine of rawLines) {
    const isFolded = rawLine.startsWith(" ") || rawLine.startsWith("\t");
    if (isFolded && lines.length > 0) {
      lines[lines.length - 1] += rawLine.slice(1);
      continue;
    }
    if (rawLine.trim() === "") continue;
    lines.push(rawLine.replace(/\s+$/, ""));
  }

  return lines;
}

/** Zerlegt `NAME;PARAM=WERT:INHALT` (Doppelpunkte in Anführungszeichen zählen nicht). */
export function parseIcsProperty(line: string): IcsProperty | null {
  let inQuotes = false;
  let separator = -1;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ":" && !inQuotes) {
      separator = index;
      break;
    }
  }

  if (separator <= 0) return null;

  const head = line.slice(0, separator);
  const value = line.slice(separator + 1);
  const [rawName, ...rawParams] = head.split(";");
  const params: Record<string, string> = {};

  for (const rawParam of rawParams) {
    const equals = rawParam.indexOf("=");
    if (equals <= 0) continue;
    const key = rawParam.slice(0, equals).trim().toUpperCase();
    let paramValue = rawParam.slice(equals + 1).trim();
    if (paramValue.startsWith('"') && paramValue.endsWith('"')) paramValue = paramValue.slice(1, -1);
    params[key] = paramValue;
  }

  return { name: rawName.trim().toUpperCase(), params, value };
}

/** Parst `YYYYMMDD`, `YYYYMMDDTHHMMSS` und `YYYYMMDDTHHMMSSZ`. */
export function parseIcsDateValue(value: string): { parts: IcsDateTimeParts; dateOnly: boolean; utc: boolean } | null {
  const trimmed = value.trim();

  const dateOnlyMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    return {
      parts: {
        year: Number(dateOnlyMatch[1]),
        month: Number(dateOnlyMatch[2]),
        day: Number(dateOnlyMatch[3]),
        hour: 0,
        minute: 0,
        second: 0,
      },
      dateOnly: true,
      utc: true,
    };
  }

  const dateTimeMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(trimmed);
  if (!dateTimeMatch) return null;

  return {
    parts: {
      year: Number(dateTimeMatch[1]),
      month: Number(dateTimeMatch[2]),
      day: Number(dateTimeMatch[3]),
      hour: Number(dateTimeMatch[4]),
      minute: Number(dateTimeMatch[5]),
      second: Number(dateTimeMatch[6] ?? 0),
    },
    dateOnly: false,
    utc: dateTimeMatch[7] === "Z",
  };
}

/** Parst einen UTC-Offset wie `+0200`, `-0130` oder `+02:00` in Minuten. */
export function parseIcsUtcOffset(value: string): number | null {
  const match = /^([+-])(\d{2}):?(\d{2})(?::?(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]) + (match[4] ? Number(match[4]) / 60 : 0));
}

/** Liest alle VTIMEZONE-Blöcke eines Feeds. */
export function parseIcsTimeZones(icsContent: string): Map<string, IcsTimeZone> {
  const zones = new Map<string, IcsTimeZone>();
  let zone: IcsTimeZone | null = null;
  let observance: IcsObservance | null = null;

  for (const line of parseIcsContentLines(icsContent)) {
    const property = parseIcsProperty(line);
    if (!property) continue;

    if (property.name === "BEGIN") {
      const component = property.value.toUpperCase();
      if (component === "VTIMEZONE") {
        zone = { tzid: "", observances: [] };
        observance = null;
        continue;
      }
      if (zone && (component === "STANDARD" || component === "DAYLIGHT")) {
        observance = {
          kind: component,
          offsetFromMinutes: 0,
          offsetToMinutes: 0,
          startLocal: { year: 0, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
        };
        continue;
      }
    }

    if (property.name === "END") {
      const component = property.value.toUpperCase();
      if (component === "VTIMEZONE" && zone) {
        if (zone.tzid && zone.observances.length > 0) zones.set(zone.tzid, zone);
        zone = null;
        observance = null;
        continue;
      }
      if (observance && (component === "STANDARD" || component === "DAYLIGHT")) {
        if (zone && observance.startLocal.year > 0) zone.observances.push(observance);
        observance = null;
        continue;
      }
    }

    if (!zone) continue;

    if (property.name === "TZID" && !observance) {
      zone.tzid = property.value.trim();
      continue;
    }

    if (!observance) continue;

    if (property.name === "TZOFFSETFROM") {
      observance.offsetFromMinutes = parseIcsUtcOffset(property.value) ?? 0;
    } else if (property.name === "TZOFFSETTO") {
      observance.offsetToMinutes = parseIcsUtcOffset(property.value) ?? 0;
    } else if (property.name === "DTSTART") {
      const parsed = parseIcsDateValue(property.value);
      if (parsed) observance.startLocal = parsed.parts;
    } else if (property.name === "RRULE") {
      observance.rrule = property.value;
    } else if (property.name === "RDATE") {
      observance.rdates = property.value.split(",").map((entry) => entry.trim()).filter(Boolean);
    }
  }

  return zones;
}

function wallClockMs(parts: IcsDateTimeParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, ordinal: number): number | null {
  if (ordinal === 0) return null;

  if (ordinal > 0) {
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const day = 1 + ((weekday - firstWeekday + 7) % 7) + (ordinal - 1) * 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day <= daysInMonth ? day : null;
  }

  const last = new Date(Date.UTC(year, month, 0));
  const day = last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7) - (Math.abs(ordinal) - 1) * 7;
  return day >= 1 ? day : null;
}

/** Liefert Monat/Tag der jährlichen RRULE-Übergänge eines Jahres. */
function yearlyRuleDays(rrule: string, year: number, fallbackMonth: number): Array<{ month: number; day: number }> {
  const parts = new Map<string, string>();
  for (const section of rrule.split(";")) {
    const equals = section.indexOf("=");
    if (equals > 0) parts.set(section.slice(0, equals).trim().toUpperCase(), section.slice(equals + 1).trim());
  }

  const frequency = (parts.get("FREQ") ?? "").toUpperCase();
  const until = parts.get("UNTIL");
  if (until) {
    const parsedUntil = parseIcsDateValue(until);
    if (parsedUntil && parsedUntil.parts.year < year) return [];
  }

  const months = (parts.get("BYMONTH") ?? "")
    .split(",")
    .map((entry) => Number(entry))
    .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12);
  const targetMonths = months.length > 0 ? months : [fallbackMonth];

  const byMonthDay = (parts.get("BYMONTHDAY") ?? "")
    .split(",")
    .map((entry) => Number(entry))
    .filter((day) => Number.isInteger(day) && day !== 0);
  const byDay = (parts.get("BYDAY") ?? "").split(",").map((entry) => entry.trim().toUpperCase()).filter(Boolean);

  const result: Array<{ month: number; day: number }> = [];

  for (const month of targetMonths) {
    if (byDay.length === 0) {
      for (const day of byMonthDay.length > 0 ? byMonthDay : [1]) {
        if (day >= 1 && day <= 31) result.push({ month, day });
      }
      continue;
    }

    for (const token of byDay) {
      const match = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(token);
      if (!match) continue;
      const weekday = WEEKDAYS.indexOf(match[2]);
      const ordinal = match[1] ? Number(match[1]) : 1;
      if (frequency !== "YEARLY") continue;
      const day = nthWeekdayOfMonth(year, month, weekday, ordinal);
      if (day !== null) result.push({ month, day });
    }

    if (frequency !== "YEARLY" && byMonthDay.length > 0) {
      for (const day of byMonthDay) {
        if (day >= 1 && day <= 31) result.push({ month, day });
      }
    }
  }

  return result;
}

function buildTransitions(zone: IcsTimeZone, fromYear: number, toYear: number): IcsTransition[] {
  const transitions: IcsTransition[] = [];

  for (const observance of zone.observances) {
    const pushTransition = (parts: IcsDateTimeParts) => {
      transitions.push({
        atUtc: wallClockMs(parts) - observance.offsetFromMinutes * MINUTE_MS,
        offsetFromMinutes: observance.offsetFromMinutes,
        offsetToMinutes: observance.offsetToMinutes,
      });
    };

    for (const rdate of observance.rdates ?? []) {
      const parsed = parseIcsDateValue(rdate);
      if (parsed) pushTransition(parsed.parts);
    }

    if (!observance.rrule) {
      pushTransition(observance.startLocal);
      continue;
    }

    for (let year = fromYear; year <= toYear; year++) {
      const days = yearlyRuleDays(observance.rrule, year, observance.startLocal.month);
      for (const { month, day } of days) {
        pushTransition({ ...observance.startLocal, year, month, day });
      }
    }
  }

  transitions.sort((left, right) => left.atUtc - right.atUtc);

  const unique: IcsTransition[] = [];
  for (const transition of transitions) {
    const previous = unique[unique.length - 1];
    if (previous && previous.atUtc === transition.atUtc) {
      unique[unique.length - 1] = transition;
      continue;
    }
    unique.push(transition);
  }

  return unique;
}

/** Wandzeit (in UTC-Millisekunden ausgedrückt) eines VTIMEZONE-Übergangs in UTC. */
function resolveWithTimeZone(transitions: IcsTransition[], wallMs: number): number {
  if (transitions.length === 0) return wallMs;

  const matches: number[] = [];
  for (let index = 0; index < transitions.length; index++) {
    const transition = transitions[index];
    const nextTransitionAt = index + 1 < transitions.length ? transitions[index + 1].atUtc : Number.POSITIVE_INFINITY;
    const candidate = wallMs - transition.offsetToMinutes * MINUTE_MS;
    if (candidate >= transition.atUtc && candidate < nextTransitionAt) matches.push(candidate);
  }

  // Mehrdeutige Wandzeit (Rückstellung): die erste mögliche Occurrence gewinnt.
  if (matches.length > 0) return Math.min(...matches);

  // Nicht existierende Wandzeit (Vorstellung): Offset vor dem Sprung verwenden.
  let fallbackOffset = transitions[0].offsetToMinutes;
  for (const transition of transitions) {
    if (transition.atUtc + transition.offsetFromMinutes * MINUTE_MS <= wallMs) {
      fallbackOffset = transition.offsetFromMinutes;
    }
  }
  return wallMs - fallbackOffset * MINUTE_MS;
}

function formatterFor(zone: string): Intl.DateTimeFormat | null {
  const cached = formatterCache.get(zone);
  if (cached) return cached;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(zone, formatter);
    zoneValidity.set(zone, true);
    return formatter;
  } catch {
    zoneValidity.set(zone, false);
    return null;
  }
}

export function isValidTimeZone(zone: string): boolean {
  const known = zoneValidity.get(zone);
  if (known !== undefined) return known;
  return formatterFor(zone) !== null;
}

function zoneOffsetMinutes(zone: string, instantMs: number): number {
  const formatter = formatterFor(zone);
  if (!formatter) return 0;

  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(instantMs))) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }

  const asUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour % 24,
    values.minute,
    values.second,
  );

  return Math.round((asUtc - instantMs) / MINUTE_MS);
}

/** Wandzeit einer IANA-Zeitzone in UTC (DST-korrekt, ohne lokale Prozesszeit). */
export function localWallToUtc(zone: string, wallMs: number): number {
  const firstGuess = wallMs - zoneOffsetMinutes(zone, wallMs) * MINUTE_MS;
  return wallMs - zoneOffsetMinutes(zone, firstGuess) * MINUTE_MS;
}

/** Ordnet einen TZID einer IANA-Zeitzone zu (Windows-Namen, Pfad-Präfixe). */
export function toIanaTimeZone(tzid: string): string | null {
  const trimmed = (tzid ?? "").trim();
  if (!trimmed) return null;

  const direct = WINDOWS_TIME_ZONES[trimmed.toLowerCase()];
  if (direct) return direct;

  const normalized = trimmed.replace(/^\/+/, "");
  if (isValidTimeZone(normalized)) return normalized;

  // z. B. /freeassociation.sourceforge.net/Tzfile/Europe/Berlin
  const segments = normalized.split("/");
  for (let index = 1; index < segments.length; index++) {
    const candidate = segments.slice(index).join("/");
    if (isValidTimeZone(candidate)) return candidate;
  }

  return null;
}

function findTimeZone(zones: Map<string, IcsTimeZone>, tzid: string): IcsTimeZone | null {
  const trimmed = (tzid ?? "").trim();
  if (!trimmed) return null;

  const direct = zones.get(trimmed);
  if (direct) return direct;

  const normalized = trimmed.replace(/^\/+/, "");
  const withoutPrefix = zones.get(normalized);
  if (withoutPrefix) return withoutPrefix;

  for (const [key, zone] of zones) {
    if (key.trim().toLowerCase() === normalized.toLowerCase()) return zone;
  }

  return null;
}

/**
 * Baut einen Parser für einen konkreten Feed. Die VTIMEZONE-Blöcke des Feeds
 * haben Vorrang vor der IANA-Zeitzone, damit auch historische oder
 * Outlook-spezifische Definitionen exakt aufgelöst werden.
 */
export function createIcsDateTimeParser(
  icsContent: string,
  floatingTimeZone: string = DEFAULT_FLOATING_TIME_ZONE,
): IcsDateTimeParser {
  const timeZones = parseIcsTimeZones(icsContent);
  const transitionCache = new Map<string, IcsTransition[]>();

  const transitionsFor = (zone: IcsTimeZone, year: number): IcsTransition[] => {
    const key = `${zone.tzid}|${year}`;
    const cached = transitionCache.get(key);
    if (cached) return cached;
    const transitions = buildTransitions(zone, year - 2, year + 2);
    transitionCache.set(key, transitions);
    return transitions;
  };

  const resolveLocal = (tzid: string, parts: IcsDateTimeParts): number => {
    const wallMs = wallClockMs(parts);
    const zone = findTimeZone(timeZones, tzid);
    if (zone) return resolveWithTimeZone(transitionsFor(zone, parts.year), wallMs);

    const iana = toIanaTimeZone(tzid);
    if (iana) return localWallToUtc(iana, wallMs);

    // Unbekannte Zeitzone ohne VTIMEZONE: Wandzeit unverändert übernehmen,
    // statt sie stillschweigend um einen geratenen Offset zu verschieben.
    return wallMs;
  };

  const floatingMs = (parts: IcsDateTimeParts): number => {
    const wallMs = wallClockMs(parts);
    const iana = toIanaTimeZone(floatingTimeZone);
    return iana ? localWallToUtc(iana, wallMs) : wallMs;
  };

  return {
    timeZones,
    resolveDateTime(value, params = {}) {
      const parsed = parseIcsDateValue(value);
      if (!parsed) return null;

      if (parsed.dateOnly || params.VALUE?.toUpperCase() === "DATE") {
        return {
          date: new Date(Date.UTC(parsed.parts.year, parsed.parts.month - 1, parsed.parts.day)),
          dateOnly: true,
          tzid: null,
          floating: false,
        };
      }

      const tzid = params.TZID?.trim() || null;

      if (parsed.utc) {
        return { date: new Date(wallClockMs(parsed.parts)), dateOnly: false, tzid: null, floating: false };
      }

      if (tzid) {
        return { date: new Date(resolveLocal(tzid, parsed.parts)), dateOnly: false, tzid, floating: false };
      }

      return { date: new Date(floatingMs(parsed.parts)), dateOnly: false, tzid: null, floating: true };
    },
    resolveUtc(value) {
      const parsed = parseIcsDateValue(value);
      if (!parsed) return null;
      if (parsed.dateOnly) {
        return new Date(Date.UTC(parsed.parts.year, parsed.parts.month - 1, parsed.parts.day));
      }
      // LAST-MODIFIED/DTSTAMP sind laut RFC 5545 immer UTC.
      return new Date(wallClockMs(parsed.parts));
    },
  };
}

/** Ein ganztägiges DTEND ist exklusiv; fehlt es, gilt ein Kalendertag. */
export function allDayEndDate(start: Date, end: Date | null): Date {
  const fallback = new Date(start.getTime() + DAY_MS);
  if (!end) return fallback;
  return end.getTime() > start.getTime() ? end : fallback;
}
