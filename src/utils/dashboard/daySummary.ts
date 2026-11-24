export interface SummaryAppointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  briefing_status?: string;
}

export const berlinDay = (date: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);

export function appointmentSummary(events: SummaryAppointment[], now = new Date()): string {
  const today = berlinDay(now);
  const dayEvents = events.filter(event => berlinDay(new Date(event.start_time)) <= today
    && berlinDay(new Date(Date.parse(event.end_time) - 1)) >= today);
  const remaining = dayEvents.filter(event => event.is_all_day || Date.parse(event.end_time) > now.getTime());
  const clock = (value: string) => new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
  let text: string;
  if (remaining.length === 1) {
    const event = remaining[0];
    const running = Date.parse(event.start_time) <= now.getTime();
    text = event.is_all_day ? "Heute ein ganztägiger Termin."
      : running ? `Gerade läuft der Termin „${event.title}“.` : `Heute noch ein Termin um ${clock(event.start_time)}.`;
    if (event.briefing_status === "approved") text += " Das Briefing liegt bereit.";
    return text;
  }
  if (remaining.length > 1) {
    text = `Heute noch ${remaining.length} Termine.`;
    const ready = remaining.filter(event => event.briefing_status === "approved").length;
    if (ready) text += ready === 1 ? " Ein Briefing liegt bereit." : ` ${ready} Briefings liegen bereit.`;
    return text;
  }
  const tomorrowDay = new Date(Date.parse(today + "T12:00:00Z") + 86400_000).toISOString().slice(0, 10);
  const hasTomorrow = events.some(event => berlinDay(new Date(event.start_time)) <= tomorrowDay
    && berlinDay(new Date(Date.parse(event.end_time) - 1)) >= tomorrowDay);
  text = dayEvents.length ? "Für heute sind alle Termine erledigt." : hasTomorrow
    ? "Heute stehen keine weiteren Termine an." : "Heute und morgen stehen keine weiteren Termine an.";
  const next = events.filter(event => berlinDay(new Date(event.start_time)) > today)
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))[0];
  if (!next) return text + " Es ist kein weiterer Termin eingetragen.";
  const tomorrow = new Date(Date.parse(today + "T12:00:00Z") + 86400_000).toISOString().slice(0, 10);
  const date = berlinDay(new Date(next.start_time)) === tomorrow ? "Morgen"
    : new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long" }).format(new Date(next.start_time));
  text += next.is_all_day ? ` ${date} ist „${next.title}“ als ganztägiger Termin eingetragen.`
    : ` ${date} um ${clock(next.start_time)} ist „${next.title}“.`;
  if (next.briefing_status === "approved") text += " Das Briefing liegt bereit.";
  return text;
}

export function pendingSummary(decisions: number, feedback: number): string {
  if (!decisions && !feedback) return "Alle Entscheidungen und Rückmeldungen sind erledigt.";
  const parts: string[] = [];
  if (decisions) parts.push(decisions === 1 ? "Eine Entscheidung" : `${decisions} Entscheidungen`);
  if (feedback) parts.push(feedback === 1 ? "eine Rückmeldung" : `${feedback} Rückmeldungen`);
  const text = parts.join(" und ");
  const verb = decisions + feedback === 1 ? "wartet" : "warten";
  return text.charAt(0).toUpperCase() + text.slice(1) + " " + verb + ".";
}

type TimedAppointment = Pick<SummaryAppointment, "id" | "start_time" | "is_all_day"> & { end_time?: string };

export function hasAppointmentEnded(appointment: TimedAppointment, now = new Date()): boolean {
  if (appointment.end_time) return Date.parse(appointment.end_time) <= now.getTime();
  if (appointment.is_all_day) return berlinDay(new Date(appointment.start_time)) < berlinDay(now);
  return Date.parse(appointment.start_time) + 3600_000 <= now.getTime();
}

export function nextAppointmentId(appointments: TimedAppointment[], now = new Date()): string | undefined {
  return appointments.filter(appointment => !appointment.is_all_day && Date.parse(appointment.start_time) > now.getTime())
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))[0]?.id;
}

/** Place now after started appointments and before the next timed start. */
export function timelineNowIndex(appointments: TimedAppointment[], now = new Date()): number {
  const index = appointments.findIndex(appointment => !appointment.is_all_day && Date.parse(appointment.start_time) > now.getTime());
  return index < 0 ? appointments.length : index;
}

/** Running and next are independent, so both statuses stay visible during a meeting. */
export function dashboardTimelineState(appointments: TimedAppointment[], now = new Date()) {
  const runningIds = new Set(appointments.filter(appointment => !appointment.is_all_day
    && Date.parse(appointment.start_time) <= now.getTime() && !hasAppointmentEnded(appointment, now))
    .map(appointment => appointment.id));
  return { runningIds, nextId: nextAppointmentId(appointments, now), highlightNext: runningIds.size === 0 };
}

export function appointmentCountdown(startTime: string, now = new Date()): string {
  const minutes = Math.max(1, Math.ceil((Date.parse(startTime) - now.getTime()) / 60_000));
  if (minutes >= 24 * 60) {
    const days = Math.floor(minutes / (24 * 60));
    return `in ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `in ${hours} Std.${rest ? ` ${rest} Min.` : ''}` : `in ${minutes} Min.`;
}

export function appointmentProgress(appointment: TimedAppointment, now = new Date()): {
  fraction: number; remainingMinutes: number;
} | null {
  if (appointment.is_all_day) return null;
  const start = Date.parse(appointment.start_time);
  const end = appointment.end_time ? Date.parse(appointment.end_time) : start + 3600_000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return {
    fraction: Math.max(0, Math.min(1, (now.getTime() - start) / (end - start))),
    remainingMinutes: Math.max(0, Math.ceil((end - now.getTime()) / 60_000)),
  };
}

export function showTimelineNowMarker(appointments: TimedAppointment[], now = new Date()): boolean {
  return appointments.some(appointment => !appointment.is_all_day)
    && dashboardTimelineState(appointments, now).runningIds.size === 0;
}
