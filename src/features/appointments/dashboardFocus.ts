import { berlinDayKey } from "@/utils/berlinDate";

export const focusModes = ["auto", "detailed", "compact", "hint"] as const;
export type FocusMode = typeof focusModes[number];
export const focusModeLabels: Record<FocusMode, string> = {
  auto: "Automatisch", detailed: "Ausführlich", compact: "Kompakt", hint: "Nur Hinweis",
};

export interface FocusAppointment {
  id: string;
  start_time: string;
  end_time?: string;
  is_all_day: boolean;
  category?: string | null;
  status?: string | null;
}

export function appointmentFocusMode(appointment: FocusAppointment, ready: boolean, mode?: string | null) {
  if (mode === "detailed" || mode === "compact" || mode === "hint") return mode;
  if (ready) return "detailed";
  const duration = appointment.end_time ? Date.parse(appointment.end_time) - Date.parse(appointment.start_time) : Infinity;
  return appointment.category === "intern" && duration > 0 && duration <= 30 * 60_000 ? "hint" : "compact";
}

export function pickFocusAppointment<T extends FocusAppointment>(appointments: T[], now: Date) {
  const current = now.getTime();
  const candidates = [...new Map(appointments.map(appointment => [appointment.id, appointment])).values()]
    .filter(appointment => !appointment.is_all_day && appointment.category !== "blocked" && appointment.category !== "birthday"
      && !["cancelled", "canceled"].includes(appointment.status ?? ""))
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
  const next = candidates.filter(appointment => Date.parse(appointment.start_time) > current);
  const running = candidates.filter(appointment => Date.parse(appointment.start_time) <= current
    && Date.parse(appointment.end_time ?? "") > current).at(-1);
  return { appointment: running ?? next[0], running: !!running, after: running ? next[0] : undefined };
}

export function departureTime(start: string, minutes: number | null | undefined, legacy?: string) {
  const parsed = legacy?.trim().match(/^(\d{1,4})(?:\s*(?:min\.?|minuten))?$/i);
  const travel = minutes ?? (parsed ? Number(parsed[1]) : null);
  const startMs = Date.parse(start);
  if (!travel || travel < 1 || travel > 1440 || !Number.isFinite(startMs)) return null;
  return { travel, at: new Date(startMs - (travel + 5) * 60_000) };
}

export function focusCountdown(time: string | Date, now: Date) {
  const minutes = Math.max(0, Math.ceil((new Date(time).getTime() - now.getTime()) / 60_000));
  if (minutes > 0 && berlinDayKey(time) !== berlinDayKey(now)) return null;
  return minutes;
}
