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
  sub_items?: any[];
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
  template_items: any;
  default_participants?: string[];
  default_recurrence?: any;
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
