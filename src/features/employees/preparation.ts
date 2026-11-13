import type { MeetingPreparationData, ProtocolData } from "@/components/employees/types";

const berlinDay = (date: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
export function isPreparationAvailable(meetingDate: string, now = new Date()): boolean {
  const meetingDay = Date.parse(`${berlinDay(new Date(meetingDate))}T12:00:00Z`);
  const today = Date.parse(`${berlinDay(now)}T12:00:00Z`);
  return today >= meetingDay - 7 * 86_400_000;
}
export function suggestPreparationFields(protocol: ProtocolData, preparation: MeetingPreparationData): ProtocolData {
  const next = { ...protocol };
  if (!next.review_successes?.trim() && preparation.proud_of?.trim()) next.review_successes = preparation.proud_of;
  if (!next.projects_support?.trim() && preparation.need_support?.trim()) next.projects_support = preparation.need_support;
  if (!next.development_skills?.trim() && preparation.skills_to_deepen?.trim()) next.development_skills = preparation.skills_to_deepen;
  return next;
}
