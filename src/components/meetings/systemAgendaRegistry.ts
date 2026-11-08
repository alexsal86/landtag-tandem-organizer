import { CalendarDays, StickyNote, ListTodo, Cake, Scale, Briefcase, CalendarClock, Megaphone, Users, CalendarCheck, FileCheck, Radar } from 'lucide-react';
import type { SystemAgendaType } from './types';

export const SYSTEM_AGENDA_OPTIONS = [
  { type: 'upcoming_appointments', label: 'Kommende Termine', Icon: CalendarDays },
  { type: 'quick_notes', label: 'Meine Notizen', Icon: StickyNote },
  { type: 'tasks', label: 'Aufgaben', Icon: ListTodo },
  { type: 'birthdays', label: 'Geburtstage', Icon: Cake },
  { type: 'decisions', label: 'Entscheidungen', Icon: Scale },
  { type: 'case_items', label: 'Vorgänge', Icon: Briefcase },
  { type: 'appointment_requests', label: 'Terminanfragen & Briefing-Bedarf', Icon: CalendarClock },
  { type: 'redaktion', label: 'Redaktions-Wochenschau', Icon: Megaphone },
  { type: 'leave_requests', label: 'Abwesenheiten & Vertretungen', Icon: Users },
  { type: 'event_plannings', label: 'Veranstaltungsplanung', Icon: CalendarCheck },
  { type: 'letters_for_signature', label: 'Briefe zur Freigabe', Icon: FileCheck },
  { type: 'critical_radar', label: 'Fristen & Stafetten-Radar', Icon: Radar },
] satisfies { type: SystemAgendaType; label: string; Icon: typeof CalendarDays }[];

export const PLATFORM_AGENDA_TYPES = ['appointment_requests', 'redaktion', 'leave_requests', 'event_plannings', 'letters_for_signature', 'critical_radar'] as const;
export type PlatformAgendaType = typeof PLATFORM_AGENDA_TYPES[number];
export const isPlatformAgendaType = (type?: string | null): type is PlatformAgendaType =>
  PLATFORM_AGENDA_TYPES.some(value => value === type);
export const systemAgendaOption = (type?: string | null) => SYSTEM_AGENDA_OPTIONS.find(option => option.type === type);