import type { CalendarEvent } from "./types";

/** Ziel für "Vorbereitung anlegen" inkl. vorbelegter Terminparameter. */
export function planningCreatePath(appointment: CalendarEvent): string {
  const params = new URLSearchParams({
    appointmentId: appointment.id,
    title: appointment.title,
    date: appointment.date.toISOString(),
    time: appointment.time,
    location: appointment.location || "",
  });
  return `/appointment-preparation?${params.toString()}`;
}

/** Ziel für Ankündigung/Rückblick: 1 Tag vor bzw. nach dem Termin, 09:00. */
export function socialPostPath(
  appointment: CalendarEvent,
  mode: "announcement" | "recap",
): string {
  const base = new Date(appointment.date);
  base.setDate(base.getDate() + (mode === "announcement" ? -1 : 1));
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");

  const titlePrefix = mode === "announcement" ? "Ankündigung" : "Rückblick";
  const params = new URLSearchParams({
    tab: "redaktion",
    socialAppointmentId: appointment.id,
    socialTopic: `${titlePrefix}: ${appointment.title}`,
    socialScheduledDate: `${yyyy}-${mm}-${dd}`,
    socialMode: mode,
  });
  return `/mywork?${params.toString()}`;
}
