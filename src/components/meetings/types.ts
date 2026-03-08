export interface RecurrenceData {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  weekdays: number[];
  endDate?: string;
}

export interface NewMeetingParticipant {
  userId: string;
  role: 'organizer' | 'participant' | 'optional';
  user?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
}

export interface AgendaItem {
  id?: string;
  meeting_id?: string;
  title: string;
  description?: string;
  assigned_to?: string[] | null;
  notes?: string | null;
  is_completed: boolean;
  is_recurring: boolean;
  task_id?: string | null;
  order_index: number;
  parent_id?: string | null;
  file_path?: string | null;
  result_text?: string | null;
  carry_over_to_next?: boolean;
  sub_items?: AgendaItem[] | unknown;
  source_meeting_id?: string | null;
  carried_over_from?: string | null;
  original_meeting_date?: string | null;
  original_meeting_title?: string | null;
  carryover_notes?: string | null;
  system_type?: string | null;
  is_optional?: boolean;
  is_visible?: boolean;
  // lokale Hilfskeys für Hierarchie vor dem Speichern
  localKey?: string;
  parentLocalKey?: string;
}

/** A quick note linked to a meeting (from quick_notes table) */
export interface LinkedQuickNote {
  id: string;
  content: string;
  title?: string | null;
  category?: string | null;
  color?: string | null;
  color_full_card?: boolean | null;
  is_pinned?: boolean | null;
  meeting_id?: string | null;
  meeting_result?: string | null;
  meeting_archived_info?: unknown;
  user_id: string;
  created_at: string;
  updated_at: string;
  tags?: string[] | null;
  priority_level?: number | null;
  follow_up_date?: string | null;
  task_id?: string | null;
  decision_id?: string | null;
  pending_for_jour_fixe?: boolean | null;
  added_to_meeting_at?: string | null;
  is_archived?: boolean | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  permanent_delete_at?: string | null;
  task_archived_info?: unknown;
  decision_archived_info?: unknown;
}

/** A task linked to a meeting (select subset from tasks table) */
export interface LinkedTask {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority: string;
  status: string;
  user_id: string;
}

/** A case item linked to a meeting (select subset from case_items table) */
export interface LinkedCaseItem {
  id: string;
  subject: string;
  status: string;
  priority?: string | null;
  due_at?: string | null;
  owner_user_id?: string | null;
  meeting_result?: string;
}

/** A task decision relevant to a meeting */
export interface RelevantDecision {
  id: string;
  title: string;
  description?: string | null;
  response_deadline?: string | null;
  priority?: number | null;
  created_by: string;
  status: string;
}

/** An upcoming appointment for the meeting sidebar */
export interface MeetingUpcomingAppointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  category?: string | null;
  status?: string | null;
  isExternal: boolean;
  calendarName?: string;
  calendarColor?: string;
}

/** A participant in a meeting */
export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  role: string;
  created_at?: string;
}

/** An agenda document attached to an agenda item */
export interface AgendaDocument {
  id: string;
  meeting_agenda_item_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type?: string | null;
  file_size?: number | null;
  created_at?: string;
}

/** A template item inside a meeting template */
export interface MeetingTemplateItem {
  title: string;
  description?: string;
  is_recurring?: boolean;
  is_optional?: boolean;
  is_visible?: boolean;
  system_type?: string | null;
  children?: MeetingTemplateItem[];
}

export interface Meeting {
  id?: string;
  tenant_id?: string;
  user_id?: string;
  title: string;
  description?: string;
  meeting_date: string | Date;
  meeting_time?: string;
  location?: string;
  status: string;
  template_id?: string;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
  lastUpdate?: number;
}

export interface MeetingTemplate {
  id: string;
  name: string;
  description?: string;
  template_items: MeetingTemplateItem[] | unknown;
  default_participants?: string[] | null;
  default_recurrence?: RecurrenceData | unknown;
  is_default?: boolean;
  auto_create_count?: number;
}

export interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
}

/** Vordefinierte Unterpunkte für bestimmte Hauptpunkte */
export const SUBPOINT_OPTIONS: Record<string, string[]> = {
  'Aktuelles aus dem Landtag': [
    'Rückblick auf vergangene Plenarsitzungen, Ausschusssitzungen, Fraktionssitzungen',
    'Wichtige Beschlüsse, Gesetze, Debatten',
    'Anstehende Termine und Fraktionspositionen',
    'Offene Punkte, bei denen Handlungsbedarf besteht',
  ],
  'Politische Schwerpunktthemen & Projekte': [
    'Laufende politische Initiativen (z. B. Gesetzesvorhaben, Anträge, Kleine Anfragen)',
    'Vorbereitung auf anstehende Reden, Stellungnahmen, Medienbeiträge',
    'Strategische Planung zu Kernthemen des Abgeordneten',
    'Recherche- und Hintergrundaufträge an Mitarbeiter',
  ],
  'Wahlkreisarbeit': [
    'Aktuelle Anliegen aus dem Wahlkreis (Bürgeranfragen, Vereine, Unternehmen, Kommunen)',
    'Geplante Wahlkreisbesuche und Gesprächstermine',
    'Veranstaltungen im Wahlkreis (Planung, Teilnahme, Redeinhalte)',
    'Presse- und Öffentlichkeitsarbeit vor Ort',
  ],
  'Kommunikation & Öffentlichkeitsarbeit': [
    'Social Media: Planung und Freigabe von Beiträgen, Abstimmung von Inhalten',
    'Pressearbeit: Pressemeldungen, Interviews, Pressegespräche',
    'Newsletter, Website-Updates',
    'Abstimmung mit Fraktions-Pressestelle',
  ],
  'Organisation & Bürointerna': [
    'Aufgabenverteilung im Team',
    'Rückmeldung zu laufenden Projekten und Deadlines',
    'Büroorganisation, Urlaubsplanung, Vertretungsregelungen',
    'Technische und administrative Fragen',
  ],
};
