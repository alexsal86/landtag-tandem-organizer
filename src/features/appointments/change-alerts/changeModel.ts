/**
 * Reine Regeln für Eil-Teminänderungen: Zeitverschiebung, neuer Ort und freie
 * Hinweise. UI, Abgeordneten-Ansicht und Selbsttest nutzen dieselben Regeln.
 */

export type AppointmentChangeKind = "time" | "location" | "note";

export interface AppointmentChangeAlertLike {
  id: string;
  appointment_id: string | null;
  title: string;
  message: string;
  /** Datenbankwert; wird über normalizeChangeKind abgesichert. */
  kind: string;
  new_start_time: string | null;
  new_location: string | null;
  created_at: string;
  acknowledged_at: string | null;
  created_by_name: string | null;
}

export interface MinimalChangeAlert {
  appointment_id: string | null;
  kind: string;
  new_start_time: string | null;
  new_location: string | null;
  message: string;
  created_at: string;
}

export interface ReportedChangeSummary {
  newStartTime: string | null;
  newLocation: string | null;
  notes: string[];
}

export interface AppointmentChanges {
  time: AppointmentChangeAlertLike | null;
  location: AppointmentChangeAlertLike | null;
  notes: AppointmentChangeAlertLike[];
}

export const CHANGE_QUICK_MINUTES = [15, 30, 60] as const;

export const BERLIN_TIME_ZONE = "Europe/Berlin";

const KIND_LABEL: Record<AppointmentChangeKind, string> = {
  time: "Zeit",
  location: "Ort",
  note: "Hinweis",
};

export function normalizeChangeKind(value: string | null | undefined): AppointmentChangeKind {
  return value === "time" || value === "location" ? value : "note";
}

export function changeKindLabel(value: string | null | undefined): string {
  return KIND_LABEL[normalizeChangeKind(value)];
}

function berlinParts(date: Date): Record<string, string> {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BERLIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
}

function berlinOffsetMs(date: Date): number {
  const parts = berlinParts(date);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/** Berliner Uhrzeit (HH:mm) eines Zeitstempels. */
export function formatChangeClock(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: BERLIN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Berliner Kalendertag kurz, z. B. „24. Nov.“. */
export function formatChangeDay(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: BERLIN_TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(date);
}

export function isValidClockInput(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

/** Verschiebt den Beginn um Minuten und liefert einen ISO-Zeitstempel. */
export function addMinutesToStart(startIso: string, minutes: number): string | null {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime()) || !Number.isFinite(minutes)) return null;
  return new Date(start.getTime() + minutes * 60_000).toISOString();
}

/** Setzt eine Berliner Uhrzeit auf den Kalendertag des bisherigen Beginns. */
export function withBerlinClockTime(startIso: string, clock: string): string | null {
  if (!isValidClockInput(clock)) return null;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  const [hours, minutes] = clock.trim().split(":").map(Number);
  const day = berlinParts(start);
  const wallClockAsUtc = Date.UTC(Number(day.year), Number(day.month) - 1, Number(day.day), hours, minutes, 0);
  const firstOffset = berlinOffsetMs(new Date(wallClockAsUtc));
  let result = new Date(wallClockAsUtc - firstOffset);
  const secondOffset = berlinOffsetMs(result);
  if (secondOffset !== firstOffset) result = new Date(wallClockAsUtc - secondOffset);
  return result.toISOString();
}

/**
 * Verschiebt das Ende um dieselbe Differenz wie den Beginn, damit die Dauer
 * erhalten bleibt und ein Tageswechsel korrekt abgebildet wird.
 */
export function shiftEndWithStart(
  startIso: string,
  endIso: string | null | undefined,
  newStartIso: string | null | undefined,
): string | null {
  if (!endIso || !newStartIso) return null;
  const start = new Date(startIso);
  const end = new Date(endIso);
  const newStart = new Date(newStartIso);
  if ([start, end, newStart].some((date) => Number.isNaN(date.getTime()))) return null;
  return new Date(newStart.getTime() + (end.getTime() - start.getTime())).toISOString();
}

/**
 * Wendet eine gemeldete Startzeit auf einen Termin an und verschiebt das Ende
 * um dieselbe Differenz. Das Original bleibt für die Durchstreichung erhalten.
 */
export function applyReportedStart<T extends { start_time: string; end_time?: string }>(
  appointment: T,
  newStartTime: string | null | undefined,
): T {
  if (!newStartTime) return appointment;
  const newEnd = shiftEndWithStart(appointment.start_time, appointment.end_time, newStartTime);
  return { ...appointment, start_time: newStartTime, end_time: newEnd ?? appointment.end_time };
}

/** Schnellwahl hat Vorrang vor einer selbst eingetragenen Uhrzeit. */
export function nextStartFromChange(
  startIso: string,
  quickMinutes: number | null,
  clock: string,
): string | null {
  if (clock.trim()) return withBerlinClockTime(startIso, clock);
  if (quickMinutes) return addMinutesToStart(startIso, quickMinutes);
  return null;
}

/**
 * Fasst die neuesten Meldungen einer Termin-ID für Kalender und Detailansicht
 * zusammen: letzte Zeit, letzter Ort und die Hinweise als Chips.
 */
export function summarizeReportedChanges(
  alerts: MinimalChangeAlert[],
  appointmentId: string | null,
): ReportedChangeSummary {
  if (!appointmentId) return { newStartTime: null, newLocation: null, notes: [] };
  const relevant = alerts
    .filter((alert) => alert.appointment_id === appointmentId)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const time = relevant.find((alert) => alert.kind === "time" && !!alert.new_start_time);
  const location = relevant.find((alert) => alert.kind === "location" && !!alert.new_location?.trim());
  return {
    newStartTime: time?.new_start_time ?? null,
    newLocation: location?.new_location?.trim() ?? null,
    notes: relevant
      .filter((alert) => alert.kind === "note" || (alert.message?.trim().length ?? 0) > 0)
      .slice(0, 3)
      .map((alert) => alert.message.trim())
      .filter(Boolean),
  };
}

export function changeTitle(kind: AppointmentChangeKind, appointmentTitle: string): string {
  const title = appointmentTitle.trim() || "Termin";
  if (kind === "time") return `Zeit geändert: ${title}`;
  if (kind === "location") return `Ort geändert: ${title}`;
  return `Hinweis: ${title}`;
}

/** Kurztext für Banner, Chip und Lesebestätigung. */
export function changeSummary(alert: AppointmentChangeAlertLike): string {
  const note = alert.message?.trim() ?? "";
  if (alert.kind === "time" && alert.new_start_time) {
    return [`Neue Zeit ${formatChangeClock(alert.new_start_time)}`, note].filter(Boolean).join(" · ");
  }
  if (alert.kind === "location" && alert.new_location?.trim()) {
    return [`Neuer Ort: ${alert.new_location.trim()}`, note].filter(Boolean).join(" · ");
  }
  return note || "Terminänderung";
}

/**
 * Neueste Änderung je Art. Hinweise (auch Zusatzhinweise zu Zeit/Ort)
 * erscheinen als Chips; es reicht, die letzten drei zu zeigen.
 */
export function pickAppointmentChanges(
  alerts: AppointmentChangeAlertLike[],
  appointmentId: string | null,
): AppointmentChanges {
  if (!appointmentId) return { time: null, location: null, notes: [] };
  const relevant = alerts
    .filter((alert) => alert.appointment_id === appointmentId)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return {
    time: relevant.find((alert) => alert.kind === "time" && !!alert.new_start_time) ?? null,
    location: relevant.find((alert) => alert.kind === "location" && !!alert.new_location?.trim()) ?? null,
    notes: relevant
      .filter((alert) => alert.kind === "note" || (alert.message?.trim().length ?? 0) > 0)
      .slice(0, 3),
  };
}
