import { berlinClock, berlinDaysSince, berlinWeekdayShortDate } from "@/utils/berlinDate";

export const debriefSources = ["phone", "present", "message", "documents"] as const;
export type DebriefSource = typeof debriefSources[number];

export function debriefSourceLabel(source: DebriefSource, deputy?: string | null) {
  const name = deputy?.trim().split(/\s+/)[0] || "dem Abgeordneten";
  return { phone: `Telefonat mit ${name}`, present: "Vor Ort dabei",
    message: deputy ? `Nachricht von ${name}` : "Nachricht vom Abgeordneten", documents: "Aus Unterlagen" }[source];
}

export interface DebriefEvent {
  id: string;
  title: string;
  starts_at: string;
  deputy_name: string | null;
  is_external: boolean;
}

export interface DebriefReport extends Omit<DebriefEvent, "is_external"> {
  appointment_id: string | null;
  received_at: string | null;
  notes: string;
  entered_by: string | null;
  source: DebriefSource | null;
  confirmed_at: string | null;
  promise: string | null;
  due_on: string | null;
  spoken_seconds: number | null;
  question: string | null;
}

export function sortDebriefReports<T extends Pick<DebriefReport, "promise" | "due_on" | "received_at">>(reports: T[]) {
  return [...reports].sort((a, b) => Number(!!b.promise && !b.due_on) - Number(!!a.promise && !a.due_on)
    || (a.received_at ?? "9999").localeCompare(b.received_at ?? "9999"));
}

export function debriefReceivedAt(value: string, now = new Date()) {
  const days = berlinDaysSince(value, now);
  const elapsed = now.getTime() - Date.parse(value);
  if (elapsed >= 0 && elapsed < 60_000) return "gerade eben";
  const day = days === 0 ? "heute" : days === 1 ? "gestern" : berlinWeekdayShortDate(value);
  return `${day} ${berlinClock(value)}`;
}

export function debriefDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
