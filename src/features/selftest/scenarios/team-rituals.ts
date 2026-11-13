import type { TestScenario } from '../types';
import { berlinDay, berlinWeek, isValidWeeklyAnswer, pickNextQuestion, upcomingTeamEvents, type TeamProfile } from '@/features/team-rituals/logic';
export const teamRitualsScenario: TestScenario = {
  id: 'team-rituals', title: 'Freiwillige Team-Rituale',
  description: 'Fragenrotation und Team-Ereignisse ohne Datenbankzugriff.',
  features: ['dashboard'], touches: [],
  limitations: ['RLS, Rollen, parallele RPC-Aufrufe, Freigaben und GDPR-Löschung mit Anmeldung separat prüfen.'],
  steps: [
    { id: 'answer-length', label: 'Freiwillige Antworten mit höchstens 280 Zeichen', kind: 'logic', run: async () => ({
      ok: !isValidWeeklyAnswer(' ') && isValidWeeklyAnswer('😀'.repeat(280)) && !isValidWeeklyAnswer('a'.repeat(281)),
      message: 'Leere Antworten und mehr als 280 Unicode-Zeichen werden abgewiesen.',
    }) },
    { id: 'rotation', label: 'Fragen erst nach vollständigem Durchlauf wiederholen', kind: 'logic', run: async () => ({
      ok: pickNextQuestion([{ id: 'a' }, { id: 'b' }], ['a'])?.id === 'b'
        && pickNextQuestion([{ id: 'a' }, { id: 'b' }], ['a', 'b'])?.id === 'a'
        && pickNextQuestion([], []) === null,
      message: 'Fragenrotation berücksichtigt die zuletzt gestellten Fragen und leere Banken.',
    }) },
    { id: 'berlin-week', label: 'Wochenwechsel am Berliner Montag', kind: 'logic', run: async () => ({
      ok: berlinDay(new Date('2026-03-29T22:30:00Z')) === '2026-03-30'
        && berlinWeek(new Date('2026-10-25T23:30:00Z')) === '2026-10-26',
      message: 'Berliner Montag bleibt an beiden Zeitumstellungen korrekt.',
    }) },
    { id: 'team-events', label: 'Datumsfreigabe, Schaltjahr und Jahreswechsel', kind: 'logic', run: async () => {
      const p: TeamProfile = { user_id: 'a', display_name: 'Team', opted_in: true, show_events: true, birthday: '02-29', birth_year: null, joined_on: null };
      const common = upcomingTeamEvents([p], new Date('2025-02-28T12:00Z'));
      const leap = upcomingTeamEvents([p], new Date('2024-02-29T12:00Z'));
      const cross = upcomingTeamEvents([{ ...p, birthday: '01-01', joined_on: '2020-12-31' }], new Date('2025-12-31T12:00Z'));
      return { ok: common[0]?.date === '2025-02-28' && common[0]?.years === null && leap[0]?.date === '2024-02-29'
        && cross.length === 2 && cross[0]?.years === 5 && cross[1]?.date === '2026-01-01'
        && upcomingTeamEvents([{ ...p, show_events: false }, { ...p, opted_in: false }], new Date('2025-02-28T12:00Z')).length === 0,
        message: 'Nur freigegebene Ereignisse erscheinen in der Berliner Kalenderwoche; 29.02. fällt sonst auf 28.02.' };
    } },
  ],
};
