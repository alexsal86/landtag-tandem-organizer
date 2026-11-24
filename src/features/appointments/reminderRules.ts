/**
 * Re-Export der Termin-Erinnerungsregeln für UI und Selbsttest. Die Regeln
 * liegen in supabase/functions/_shared/, damit Datenbank, Edge Function und
 * Selbsttest dieselbe Fälligkeit und denselben Versandschlüssel verwenden.
 */
export {
  APPOINTMENT_REMINDER_DEFAULT_MINUTES,
  APPOINTMENT_REMINDER_MAX_MINUTES,
  APPOINTMENT_REMINDER_MIN_MINUTES,
  appointmentReminderDueAt,
  appointmentReminderKey,
  isAppointmentReminderDue,
  normalizeAppointmentReminderMinutes,
} from "../../../supabase/functions/_shared/appointmentReminder";
export type { AppointmentReminderCandidate } from "../../../supabase/functions/_shared/appointmentReminder";
