export type RequestChannel = "email" | "post" | "phone" | "in_person" | "case" | "other";
export type RequestRecommendation = "accept" | "decline" | "delegate" | "question";
export type RequestStatus = "open" | "accepted" | "declined";

export interface AppointmentRequest {
  id: string;
  tenant_id: string;
  created_by: string;
  title: string;
  requester: string | null;
  channel: RequestChannel;
  requested_date: string; // YYYY-MM-DD
  requested_time: string | null; // HH:MM[:SS]
  duration_minutes: number;
  location: string | null;
  response_deadline: string | null;
  notes: string | null;
  recommendation: RequestRecommendation | null;
  recommendation_note: string | null;
  status: RequestStatus;
  appointment_id: string | null;
  created_at: string;
}

export const CHANNEL_LABELS: Record<RequestChannel, string> = {
  email: "E-Mail",
  post: "Post",
  phone: "Telefon",
  in_person: "Persönlich",
  other: "Sonstiges",
};

export const RECOMMENDATION_LABELS: Record<RequestRecommendation, string> = {
  accept: "Zusage empfohlen",
  decline: "Absage empfohlen",
  delegate: "Vertretung schicken",
  question: "Rückfrage nötig",
};

/** Roles allowed to make the final decision. */
export const DECIDER_ROLES = ["abgeordneter", "bueroleitung"] as const;
export function canDecide(role: string | null | undefined): boolean {
  return !!role && (DECIDER_ROLES as readonly string[]).includes(role);
}

/** Local start date/time of a request. Without a time it starts at 09:00. */
export function requestStart(r: Pick<AppointmentRequest, "requested_date" | "requested_time">): Date {
  const [y, m, d] = r.requested_date.split("-").map(Number);
  const [hh, mm] = (r.requested_time ?? "09:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function requestEnd(r: Pick<AppointmentRequest, "requested_date" | "requested_time" | "duration_minutes">): Date {
  return new Date(requestStart(r).getTime() + r.duration_minutes * 60_000);
}

function toDay(value: string): number {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/**
 * A request is urgent when it must be decided before the next Jour fixe:
 * its date or its response deadline is on/before the next Jour fixe day.
 * Without a scheduled Jour fixe, anything within the next 7 days is urgent.
 */
export function isUrgent(
  r: Pick<AppointmentRequest, "requested_date" | "response_deadline" | "status">,
  nextJourFixeDate: string | null,
  today: Date = new Date(),
): boolean {
  if (r.status !== "open") return false;
  const limit = nextJourFixeDate
    ? toDay(nextJourFixeDate)
    : new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).getTime();
  const earliest = Math.min(toDay(r.requested_date), r.response_deadline ? toDay(r.response_deadline) : Infinity);
  return earliest <= limit;
}

export function sortByEarliest<T extends Pick<AppointmentRequest, "requested_date" | "response_deadline">>(list: T[]): T[] {
  const key = (r: T) => Math.min(toDay(r.requested_date), r.response_deadline ? toDay(r.response_deadline) : Infinity);
  return [...list].sort((a, b) => key(a) - key(b));
}

export const REQUEST_EVENT_PREFIX = "blocked-request-";
