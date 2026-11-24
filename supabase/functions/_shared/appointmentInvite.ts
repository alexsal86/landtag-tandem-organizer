/**
 * Gemeinsame Regeln für Termineinladungen.
 *
 * Ein Termin behält über seine gesamte Lebensdauer eine stabile ICS-UID.
 * Jede echte Zeit-/Ortsänderung erhöht die SEQUENCE (Datenbank-Trigger
 * stamp_appointment_calendar_invite); Verschiebungen gehen als Update an
 * dieselbe UID, Absagen als METHOD:CANCEL. Erneut gesendet wird nur auf
 * Knopfdruck oder wenn die SEQUENCE die zuletzt versendete übersteigt, damit
 * RSVP-Status und Antwortlinks erhalten bleiben.
 *
 * Wird von den Edge Functions (Deno) und über
 * src/features/appointments/invitations/invitationRules.ts auch von UI und
 * Selbsttest genutzt.
 */

export type InvitationMethod = "REQUEST" | "CANCEL";

/** manual = Knopfdruck, update = echte Zeit-/Ortsänderung, cancel = Absage. */
export type InvitationReason = "manual" | "update" | "cancel";

export interface InvitationOrganizer {
  name: string;
  email: string;
}

export interface InvitationAttendee {
  name: string;
  email: string;
  /** Standard ist TRUE (Rückmeldung erbeten). */
  rsvp?: boolean;
}

export interface CalendarInviteRequest {
  appointmentId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  organizer: InvitationOrganizer;
  attendees?: InvitationAttendee[];
}

export interface InvitationIcsInput {
  uid: string;
  sequence?: number;
  method?: InvitationMethod;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: string;
  endTime: string;
  organizer: InvitationOrganizer;
  attendees?: InvitationAttendee[];
  /** Zusätzlicher Hinweis im Beschreibungstext, z. B. „Termin geändert“. */
  notice?: string | null;
  now?: Date;
}

export interface InvitationGuestLike {
  id: string;
  email: string;
  name?: string | null;
  status?: string | null;
  invited_at?: string | null;
  /** Bleibt beim Upsert erhalten, damit der Antwortlink gültig bleibt. */
  invitation_token?: string | null;
}

export const INVITATION_UID_DOMAIN = "landtagsos.app";

const RESPONDED_STATUSES = ["confirmed", "declined", "attended"];

/**
 * Stabile Kalender-UID eines Termins. Sie wird aus der Termin-ID abgeleitet und
 * ändert sich nie, damit Kalender Aktualisierungen und Absagen zuordnen können.
 */
export function appointmentInviteUid(appointmentId: string): string {
  const id = String(appointmentId ?? "").trim();
  if (!id) throw new Error("Termin-ID für die Kalender-UID fehlt.");
  return `${id}@${INVITATION_UID_DOMAIN}`;
}

/** Liest eine gespeicherte SEQUENCE; fehlende oder unsinnige Werte gelten als 0. */
export function normalizeSequence(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/** Nächste SEQUENCE für eine Absage (RFC 5546 verlangt einen höheren Wert). */
export function nextCalendarSequence(value: number | string | null | undefined): number {
  return normalizeSequence(value) + 1;
}

/**
 * Ein Update an die Gäste ist nur nötig, wenn die SEQUENCE seit dem letzten
 * Versand gestiegen ist. Der Datenbank-Trigger erhöht sie ausschließlich bei
 * echter Zeit- oder Ortsänderung.
 */
export function invitationUpdateRequired(
  calendarSequence: number | string | null | undefined,
  lastInvitationSequence: number | string | null | undefined,
): boolean {
  return normalizeSequence(calendarSequence) > normalizeSequence(lastInvitationSequence);
}

/** Schlüssel für den Abgleich von Gästen unabhängig von Schreibweise und Leerzeichen. */
export function invitationGuestKey(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** E-Mails, die vor dem Speichern noch nicht am Termin hingen. */
export function selectNewGuestEmails(
  knownEmails: Iterable<string>,
  guests: Array<{ email: string }>,
): string[] {
  const known = new Set(Array.from(knownEmails, (email) => invitationGuestKey(email)));
  const result: string[] = [];
  for (const guest of guests) {
    const key = invitationGuestKey(guest.email);
    if (!key || known.has(key) || result.includes(key)) continue;
    result.push(key);
  }
  return result;
}

/** true, sobald ein Gast jemals eine Einladung erhalten hat. */
export function hasBeenInvited(guest: InvitationGuestLike): boolean {
  return Boolean(guest.invited_at) || Boolean(guest.status && guest.status !== "pending");
}

/**
 * Empfänger einer Einladung. Manuell werden alle (oder die gewählten) Gäste
 * angeschrieben; bei Änderung/Absage nur bereits eingeladene Gäste und
 * ausdrücklich genannte neue Gäste.
 */
export function selectInvitationRecipients<T extends InvitationGuestLike>(
  guests: T[],
  options: { reason?: InvitationReason; guestIds?: string[] } = {},
): T[] {
  const reason = options.reason ?? "manual";
  const ids = new Set(options.guestIds ?? []);
  if (reason === "manual" && ids.size === 0) return [...guests];
  return guests.filter((guest) => ids.has(guest.id) || (reason !== "manual" && hasBeenInvited(guest)));
}

/**
 * Status nach einem Versand: eine bereits gegebene Rückmeldung wird nie
 * überschrieben, nur offene Gäste gelten danach als eingeladen.
 */
export function nextGuestStatusAfterSend(status: string | null | undefined): string {
  const current = (status ?? "").trim().toLowerCase();
  return RESPONDED_STATUSES.includes(current) ? current : "invited";
}

export function formatDateToICS(date: string): string {
  return new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function escapeICSValue(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

export function validateInviteDates(startTime: string, endTime: string): string | null {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Ungültiges Datumsformat. Erwartet wird ISO-8601.";
  }

  if (end <= start) {
    return "Endzeit muss nach der Startzeit liegen.";
  }

  const hasStartTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(startTime);
  const hasEndTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(endTime);

  if (hasStartTimezone !== hasEndTimezone) {
    return "Zeitzonen-Konflikt: Start- und Endzeit müssen konsistent angegeben werden.";
  }

  return null;
}

/**
 * Baut die ICS-Datei für eine Einladung, ein Update oder eine Absage.
 * UID bleibt gleich, nur METHOD, STATUS und SEQUENCE ändern sich.
 */
export function buildAppointmentIcs(input: InvitationIcsInput): string {
  const method: InvitationMethod = input.method === "CANCEL" ? "CANCEL" : "REQUEST";
  const sequence = normalizeSequence(input.sequence);
  const description = [input.notice?.trim(), input.description?.trim()].filter(Boolean).join("\n\n");
  const now = formatDateToICS((input.now ?? new Date()).toISOString());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LandtagsOS//Appointment Scheduler//DE",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatDateToICS(input.startTime)}`,
    `DTEND:${formatDateToICS(input.endTime)}`,
    `SUMMARY:${escapeICSValue(input.title)}`,
    `ORGANIZER;CN=${escapeICSValue(input.organizer.name)}:mailto:${input.organizer.email}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeICSValue(description)}`);
  }

  if (input.location) {
    lines.push(`LOCATION:${escapeICSValue(input.location)}`);
  }

  for (const attendee of input.attendees ?? []) {
    lines.push(
      `ATTENDEE;CN=${escapeICSValue(attendee.name)};RSVP=${attendee.rsvp === false ? "FALSE" : "TRUE"}:mailto:${attendee.email}`,
    );
  }

  lines.push(
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    `SEQUENCE:${sequence}`,
    "END:VEVENT",
    "END:VCALENDAR",
  );

  return lines.join("\r\n");
}
