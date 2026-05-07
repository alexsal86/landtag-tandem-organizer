/**
 * Maps a calendar event type to a semantic Tailwind class string.
 * Tokens are defined in src/index.css and tailwind.config.ts.
 */
export type CalendarEventType =
  | "appointment"
  | "meeting"
  | "task"
  | "personal"
  | "deadline"
  | "session"
  | "blocked"
  | "veranstaltung"
  | "vacation"
  | "vacation_request"
  | "birthday";

const EVENT_STYLES: Record<CalendarEventType, string> = {
  appointment: "bg-event-appointment text-event-foreground",
  meeting: "bg-event-meeting text-event-foreground",
  task: "bg-event-task text-event-foreground",
  personal: "bg-event-personal text-event-foreground",
  deadline: "bg-event-deadline text-event-foreground",
  session: "bg-event-session text-event-foreground",
  blocked: "bg-event-blocked text-event-foreground",
  veranstaltung: "bg-event-veranstaltung text-event-foreground",
  vacation: "bg-event-vacation text-event-foreground",
  vacation_request: "bg-event-vacation-request text-event-foreground-dark",
  birthday: "bg-event-birthday text-event-foreground",
};

export function getEventTypeClass(type: string | undefined | null): string {
  if (!type) return "";
  return EVENT_STYLES[type as CalendarEventType] ?? "";
}
