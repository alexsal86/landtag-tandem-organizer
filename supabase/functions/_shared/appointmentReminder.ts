/**
 * Regeln für Termin-Erinnerungen aus reminder_minutes.
 *
 * Ein Termin erinnert genau einmal je hinterlegter Vorlaufzeit. Die
 * Vorlaufzeit ist nur gültig, wenn sie positiv und höchstens eine Woche ist;
 * 0, negative oder unsinnige Werte bedeuten ausdrücklich "keine Erinnerung".
 * Erinnert wird nur vor Terminbeginn – ein Lauf nach dem Start holt nichts nach.
 *
 * Dieselbe Regel gilt in der Datenbank (dispatch_due_appointment_reminders),
 * in der Edge Function send-appointment-reminders und im Selbsttest. Die
 * Reihenfolge ist dort identisch: Vorlauf normalisieren, Fälligkeit prüfen,
 * dann Versandschlüssel je Termin und Vorlauf.
 */

export const APPOINTMENT_REMINDER_MIN_MINUTES = 1;
export const APPOINTMENT_REMINDER_MAX_MINUTES = 7 * 24 * 60;
export const APPOINTMENT_REMINDER_DEFAULT_MINUTES = 15;

const MINUTE_MS = 60_000;

export interface AppointmentReminderCandidate {
  id: string;
  /** ISO-Zeitpunkt des Terminbeginns. */
  startTime: string;
  reminderMinutes: number | null | undefined;
}

/** Gültige Vorlaufzeit in Minuten oder null (= keine Erinnerung). */
export function normalizeAppointmentReminderMinutes(
  value: number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  const minutes = Math.trunc(value);
  if (minutes < APPOINTMENT_REMINDER_MIN_MINUTES) return null;
  if (minutes > APPOINTMENT_REMINDER_MAX_MINUTES) return null;
  return minutes;
}

/** Zeitpunkt, ab dem die Erinnerung fällig ist (Terminbeginn minus Vorlauf). */
export function appointmentReminderDueAt(
  startTime: string,
  reminderMinutes: number | null | undefined,
): Date | null {
  const minutes = normalizeAppointmentReminderMinutes(reminderMinutes);
  const start = Date.parse(startTime);
  if (minutes === null || !Number.isFinite(start)) return null;
  return new Date(start - minutes * MINUTE_MS);
}

/** Ist die Erinnerung jetzt fällig? Nach Terminbeginn nie. */
export function isAppointmentReminderDue(
  candidate: AppointmentReminderCandidate,
  now: Date = new Date(),
): boolean {
  const dueAt = appointmentReminderDueAt(candidate.startTime, candidate.reminderMinutes);
  const start = Date.parse(candidate.startTime);
  if (!dueAt || !Number.isFinite(start)) return false;
  return start > now.getTime() && dueAt.getTime() <= now.getTime();
}

/** Ein Versand je Termin und Vorlaufzeit (Spiegel des Unique-Index). */
export function appointmentReminderKey(appointmentId: string, reminderMinutes: number): string {
  return `${appointmentId}:${Math.trunc(reminderMinutes)}`;
}
