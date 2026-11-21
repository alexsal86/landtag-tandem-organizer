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
      : running ? `Gerade läuft „${event.title}“.` : `Heute noch ein Termin um ${clock(event.start_time)}.`;
    if (event.briefing_status === "approved") text += " Das Briefing liegt bereit.";
    return text;
  }
  if (remaining.length > 1) {
    text = `Heute noch ${remaining.length} Termine.`;
    const ready = remaining.filter(event => event.briefing_status === "approved").length;
    if (ready) text += ready === 1 ? " Ein Briefing liegt bereit." : ` ${ready} Briefings liegen bereit.`;
    return text;
  }
  text = dayEvents.length ? "Für heute sind alle Termine erledigt." : "Ruhiger Tag. Heute stehen keine Termine an.";
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
  if (!decisions && !feedback) return "Alle Entscheidungen und Terminrückmeldungen sind erledigt.";
  const parts: string[] = [];
  if (decisions) parts.push(decisions === 1 ? "Eine Entscheidung wartet" : `${decisions} Entscheidungen warten`);
  if (feedback) parts.push(feedback === 1 ? "eine Rückmeldung zu einem vergangenen Termin steht aus" : `${feedback} Rückmeldungen zu vergangenen Terminen stehen aus`);
  const text = parts.join(". ");
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}
