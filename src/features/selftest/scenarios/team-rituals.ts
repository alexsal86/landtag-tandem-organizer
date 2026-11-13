import { partitionQuestions, ritualMonth } from '@/features/team-rituals/history';
import {visibleWeeklyAnswers, ritualDashboardState} from "@/features/team-rituals/logic";
import { OFFICE_ROUTINE_TEMPLATES, parseRoutineSteps, validateOfficeRoutine } from '@/features/automation/officeRoutineTemplates';
import { checkBingo, readBingoState, validBingoFields, bingoBoard } from '@/features/team-rituals/bingo';
import { isValidFunFacts } from '@/features/team-rituals/twoTruths';
import type { TestScenario } from '../types';
import { berlinDay, berlinWeek, canManageTeamRituals, upcomingAnniversaries, isValidWeeklyAnswer, pickNextQuestion, upcomingTeamEvents, type TeamProfile } from '@/features/team-rituals/logic';
export const teamRitualsScenario: TestScenario = {
  id: 'team-rituals', title: 'Freiwillige Team-Rituale',
  description: 'Fragenrotation und Team-Ereignisse ohne Datenbankzugriff.',
  features: ['dashboard'], touches: [],
  limitations: ['RLS, Rollen, parallele RPC-Aufrufe, Freigaben und GDPR-Löschung mit Anmeldung separat prüfen.'],
  steps: [
    { id: 'ritual-history', label: 'Wiederverwendbare Wochenfragen und getrenntes Archiv', kind: 'logic', run: async () => {
      const groups = partitionQuestions([{ id: 'used', active: true, usage_count: 3 }, { id: 'paused', active: false, usage_count: 1 }]);
      return { ok: groups.active[0]?.id === 'used' && groups.archived[0]?.id === 'paused'
        && ritualMonth('2026-11-01') === 'November 2026',
        message: 'Bereits gestellte aktive Wochenfragen bleiben in der Rotation; pausierte Fragen werden getrennt angezeigt. Quiz-Einsatzmonate sind sichtbar. SQL-Auswahlsperre und Archivberechtigungen separat prüfen.' };
    } },
    { id: 'weekly-answer-reveal', label: 'Teamantworten erst nach eigenem Beitrag anzeigen', kind: 'logic', run: async () => {
      const answers = [{ user_id: 'other' }, { user_id: 'self' }];
      return { ok: visibleWeeklyAnswers(answers, 'new').length === 0
        && visibleWeeklyAnswers(answers).length === 0
        && visibleWeeklyAnswers(answers, 'self').length === 2
        && visibleWeeklyAnswers(answers.filter(a => a.user_id !== 'self'), 'self').length === 0,
        message: 'Nur ein gespeicherter eigener Beitrag öffnet die Übersicht; nach Löschen oder Wochenwechsel bleibt sie wieder verborgen.' };
    } },
    {id:'dashboard-discovery',label:'Team-Rituale bleiben im Dashboard auffindbar, ohne automatische Teilnahme',kind:'logic',run:async()=>({ok:ritualDashboardState(false,false,false,false)==='disabled'&&ritualDashboardState(false,false,true,false)==='join'&&ritualDashboardState(false,true,false,false)==='unavailable'&&ritualDashboardState(false,false,true,true)==='ready',message:'Bürofreigabe, persönliche Zustimmung und Datenfehler haben eigene sichtbare Einstiegszustände.'})},

    { id: 'team-routine-templates', label: 'Editierbare freiwillige Team-Vorlagen', kind: 'logic', run: async () => {
      const ids = ['team-walk-talk', 'team-regional-snack', 'team-constituency-trip'];
      const templates = OFFICE_ROUTINE_TEMPLATES.filter(template => ids.includes(template.id));
      return { ok: templates.length === 3 && templates.every(template =>
        parseRoutineSteps(template.steps).length === 4 && validateOfficeRoutine({ routineDeadlineMonth: template.deadlineMonth, routineDeadlineDay: template.deadlineDay, routineSteps: template.steps }) === null
        && template.description.toLowerCase().includes('freiwillig')),
        message: 'Alle drei Vorlagen verwenden den vorhandenen Routine-Assistenten, valide Arbeitsschritte und freiwillige Teilnahme.' };
    } },
    { id: 'bingo-rules', label: 'Bingo-Reihen und lokaler Wochenzustand', kind: 'logic', run: async () => {
      const fields = Array.from({ length: 12 }, (_, index) => `Feld ${index}`);
      return { ok: checkBingo([0, 1, 2]) && checkBingo([0, 4, 8]) && !checkBingo([0, 0, 0])
        && validBingoFields(fields) && bingoBoard(fields, 'same').length === 9
        && JSON.stringify(bingoBoard(fields, 'same')) === JSON.stringify(bingoBoard(fields, 'same'))
        && !readBingoState('{invalid', 'current').started
        && !readBingoState(JSON.stringify({ scope: 'old', started: true, selected: [0, 1, 2] }), 'current').started,
        message: 'Reihen, Spalten und Diagonalen; lokale Auswahl ist an Person, Mandant, Kalenderwoche und Konfiguration gebunden.' };
    } },
    { id: 'two-truths-profile', label: 'Drei verschiedene Aussagen und genau eine Lüge', kind: 'logic', run: async () => ({
      ok: isValidFunFacts(['Wahrheit A', 'Wahrheit B', 'Erfunden'], 2)
        && !isValidFunFacts(['Gleich', 'gleich', 'Erfunden'], 2) && !isValidFunFacts(['A', 'B', 'C'], 3),
      message: 'Aussagen sind verschieden, begrenzt und genau eine wird als erfunden markiert. Serverseitige Geheimhaltung separat angemeldet prüfen.',
    }) },
    { id: 'employee-access-anniversary', label: 'Leitungsrollen und automatische Eintrittsjubiläen', kind: 'logic', run: async () => ({
      ok: canManageTeamRituals('abgeordneter') && canManageTeamRituals('bueroleitung') && !canManageTeamRituals('mitarbeiter')
        && upcomingAnniversaries([{ user_id: 'a', display_name: 'Team', joined_on: '2020-12-31' }], new Date('2025-12-31T12:00Z'))[0]?.years === 5,
      message: 'Beide Leitungsrollen können verwalten; Eintrittsjubiläen benötigen keine Spiel-/Geburtstagsfreigabe.',
    }) },
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
