import type { LinkedQuickNote, LinkedTask, LinkedCaseItem, RelevantDecision, MeetingUpcomingAppointment } from '../types';

export interface AgendaItem {
  id?: string;
  title: string;
  description?: string | null;
  assigned_to?: string[] | null;
  notes?: string | null;
  is_completed: boolean;
  result_text?: string | null;
  carry_over_to_next?: boolean | null;
  order_index: number;
  parent_id?: string | null;
  parentLocalKey?: string;
  system_type?: string | null;
}

export interface Meeting {
  id?: string;
  title: string;
  meeting_date: string | Date;
  meeting_time?: string | null;
}

export interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
}

export interface NavigableItem {
  item: AgendaItem;
  isSubItem: boolean;
  parentItem: AgendaItem | null;
  globalIndex: number;
  isSystemSubItem?: boolean;
  sourceId?: string;
  sourceType?: 'quick_note' | 'appointment' | 'task' | 'decision';
  sourceData?: unknown;
}

export type SystemSubItemResultEntry = string | { result?: string; completed?: boolean };

export interface FocusModeViewProps {
  meeting: Meeting;
  agendaItems: AgendaItem[];
  profiles: Profile[];
  linkedQuickNotes?: LinkedQuickNote[];
  linkedTasks?: LinkedTask[];
  linkedCaseItems?: LinkedCaseItem[];
  relevantDecisions?: RelevantDecision[];
  upcomingAppointments?: MeetingUpcomingAppointment[];
  starredAppointmentIds?: Set<string>;
  onToggleStar?: (appt: MeetingUpcomingAppointment) => void;
  onClose: () => void;
  onUpdateItem: (index: number, field: keyof AgendaItem, value: unknown) => void;
  onUpdateResult: (itemId: string, field: 'result_text' | 'carry_over_to_next', value: unknown) => void;
  onUpdateNoteResult?: (noteId: string, result: string) => void;
  onArchive: () => void;
}

// Helper function to format time without seconds
export const formatMeetingTime = (time: string | undefined) => {
  if (!time) return null;
  return time.substring(0, 5);
};
