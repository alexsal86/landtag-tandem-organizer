export interface Question { id: string }
/** History is chronological. Start a new cycle only after every active question appeared. */
export function pickNextQuestion<T extends Question>(questions: readonly T[], history: readonly string[]): T | null {
  const active = [...questions].sort((a, b) => a.id.localeCompare(b.id));
  const lastSeen = (id: string) => history.lastIndexOf(id);
  return active.reduce<T | null>((best, question) => !best || lastSeen(question.id) < lastSeen(best.id) ? question : best, null);
}

export function berlinDay(today: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(today);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function berlinWeek(today: Date): string {
  const date = new Date(`${berlinDay(today)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
export interface TeamProfile {
  user_id: string; display_name: string; opted_in: boolean; show_events: boolean;
  birthday: string | null; birth_year: number | null; joined_on: string | null;
}
export interface TeamEvent { userId: string; name: string; kind: 'birthday' | 'anniversary'; date: string; years: number | null }
/** Current Berlin calendar week; February 29 is celebrated February 28 in common years. */
export function upcomingTeamEvents(profiles: readonly TeamProfile[], today: Date): TeamEvent[] {
  const start = berlinWeek(today);
  const end = new Date(`${start}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const endDay = end.toISOString().slice(0, 10);
  const years = [...new Set([Number(start.slice(0, 4)), Number(endDay.slice(0, 4))])];
  const events: TeamEvent[] = [];
  for (const profile of profiles.filter(p => p.opted_in && p.show_events)) {
    for (const year of years) {
      for (const kind of ['birthday', 'anniversary'] as const) {
        const source = kind === 'birthday' ? profile.birthday : profile.joined_on?.slice(5);
        if (!source) continue;
        const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const date = `${year}-${source === '02-29' && !leap ? '02-28' : source}`;
        const baseYear = kind === 'birthday' ? profile.birth_year : Number(profile.joined_on?.slice(0, 4));
        const age = baseYear == null ? null : year - baseYear;
        if (date >= start && date <= endDay && (kind !== 'anniversary' || (age != null && age > 0)) && (age == null || age >= 0)) {
          events.push({ userId: profile.user_id, name: profile.display_name, kind, date, years: age });
        }
      }
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export function isValidWeeklyAnswer(answer: string): boolean {
  const length = Array.from(answer.trim()).length;
  return length > 0 && length <= 280;
}

export interface EmploymentProfile { user_id: string; display_name: string; joined_on: string }
/** Employment anniversaries use canonical personnel data, independently of game/birthday consent. */
export function upcomingAnniversaries(profiles: readonly EmploymentProfile[], today: Date): TeamEvent[] {
  return upcomingTeamEvents(profiles.map(p => ({ ...p, opted_in: true, show_events: true, birthday: null, birth_year: null })), today);
}
export function canManageTeamRituals(role: string | null): boolean {
  return role === 'abgeordneter' || role === 'bueroleitung';
}
