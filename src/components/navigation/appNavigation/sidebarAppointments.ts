import type { UpcomingAppointmentItem } from "./types";

const date = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
const dayKey = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeZone: "Europe/Berlin" });
const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

export function appointmentHref(appointment: UpcomingAppointmentItem) {
  return `/calendar?${new URLSearchParams({ highlight: `${appointment.isExternal ? "external-" : ""}${appointment.id}` })}`;
}

export function appointmentLabel(appointment: UpcomingAppointmentItem, now = new Date()) {
  const start = new Date(appointment.start_time);
  const when = appointment.is_all_day ? "Ganztägig" : time.format(start);
  return dayKey.format(start) === dayKey.format(now) ? when : `${date.format(start)} · ${when}`;
}
