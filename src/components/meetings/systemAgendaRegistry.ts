import { PencilSparkles } from "@/components/icons/PencilSparkles";
import { CalendarDays, ListTodo, Heart, Scale, Briefcase, CalendarClock, Megaphone, Users, CalendarCheck, FileCheck, Radar, History } from 'lucide-react';
import type { SystemAgendaType } from './types';

export const SYSTEM_AGENDA_OPTIONS = [
  { type: 'upcoming_appointments', label: 'Kommende Termine', Icon: CalendarDays, emptyDescription: undefined },
  { type: 'quick_notes', label: 'Meine Notizen', Icon: PencilSparkles, emptyDescription: undefined },
  { type: 'tasks', label: 'Aufgaben', Icon: ListTodo, emptyDescription: undefined },
  { type: 'birthdays', label: 'Geburtstage', Icon: Heart, emptyDescription: 'Kein Geburtstag im Zeitraum' },
  { type: 'decisions', label: 'Entscheidungen', Icon: Scale, emptyDescription: undefined },
  { type: 'case_items', label: 'Vorgänge', Icon: Briefcase, emptyDescription: undefined },
  { type: 'appointment_requests', label: 'Terminanfragen & Briefing-Bedarf', Icon: CalendarClock, emptyDescription: 'Keine Terminanfrage und kein Briefing-Bedarf' },
  { type: 'redaktion', label: 'Redaktions-Wochenschau', Icon: Megaphone, emptyDescription: 'Keine Freigabe steht aus' },
  { type: 'leave_requests', label: 'Abwesenheiten & Vertretungen', Icon: Users, emptyDescription: 'Keine Abwesenheit im Zeitraum' },
  { type: 'event_plannings', label: 'Veranstaltungsplanung', Icon: CalendarCheck, emptyDescription: 'Keine Veranstaltungsplanung vorhanden' },
  { type: 'letters_for_signature', label: 'Briefe zur Freigabe', Icon: FileCheck, emptyDescription: 'Kein Brief zur Freigabe' },
  { type: 'critical_radar', label: 'Fristen & Stafetten-Radar', Icon: Radar, emptyDescription: 'Keine kritische Frist oder Aufgabe vorhanden' },
  { type: 'past_appointments', label: 'Termin-Rückschau (7 Tage)', Icon: History, emptyDescription: 'Kein vergangener Termin im Zeitraum' },
] satisfies { type: SystemAgendaType; label: string; emptyDescription?: string; Icon: typeof CalendarDays }[];

export const PLATFORM_AGENDA_TYPES = ['appointment_requests', 'redaktion', 'leave_requests', 'event_plannings', 'letters_for_signature', 'critical_radar', 'past_appointments'] as const;
export type PlatformAgendaType = typeof PLATFORM_AGENDA_TYPES[number];
export const isPlatformAgendaType = (type?: string | null): type is PlatformAgendaType =>
  PLATFORM_AGENDA_TYPES.some(value => value === type);
export const systemAgendaOption = (type?: string | null) => SYSTEM_AGENDA_OPTIONS.find(option => option.type === type);