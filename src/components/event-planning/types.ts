export interface EventPlanning {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  background_info?: string | null;
  confirmed_date?: string | null;
  is_private: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_digital?: boolean | null;
  digital_platform?: string | null;
  digital_link?: string | null;
  digital_access_info?: string | null;
  is_completed?: boolean | null;
  completed_at?: string | null;
  is_archived?: boolean | null;
  archived_at?: string | null;
  contact_person?: string | null;
  creator?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface EventPlanningContact {
  id: string;
  event_planning_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventPlanningSpeaker {
  id: string;
  event_planning_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  bio?: string | null;
  topic?: string | null;
  order_index: number | null;
  created_at: string;
  updated_at: string;
}

export interface EventPlanningTimelineAssignment {
  id: string;
  event_planning_id: string;
  checklist_item_id: string;
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface EventPlanningDate {
  id: string;
  event_planning_id: string;
  date_time: string;
  is_confirmed: boolean;
  appointment_id?: string | null;
  created_at?: string;
}

export interface ChecklistItem {
  id: string;
  event_planning_id: string;
  title: string;
  is_completed: boolean;
  order_index: number;
  type?: string | null;
  color?: string | null;
  relative_due_days?: number | null;
  sub_items?: Array<{
    title: string;
    is_completed: boolean;
  }>;
}

export type EventPayloadStatus = 'draft' | 'in_progress' | 'planned' | 'active' | 'completed' | 'cancelled';

export interface RSVPEvent {
  type: 'rsvp_event';
  status: EventPayloadStatus;
  id: string;
  event_planning_id: string;
  title: string;
  description?: string | null;
  confirmed_date?: string | null;
}

export interface PlanningTask {
  type: 'planning_task';
  status: EventPayloadStatus;
  id: string;
  event_planning_id: string;
  title: string;
  due_date?: string | null;
  checklist_item_id?: string | null;
}

export interface AppointmentPreparationSection {
  type: 'appointment_preparation_section';
  status: EventPayloadStatus;
  id: string;
  title: string;
  content?: string | null;
}

export interface PlanningSubtask {
  id: string;
  planning_item_id: string;
  user_id: string;
  description: string;
  assigned_to?: string | null;
  due_date?: string | null;
  is_completed: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  result_text?: string | null;
  completed_at?: string | null;
}

export interface PlanningComment {
  id: string;
  planning_item_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface PlanningDocument {
  id: string;
  planning_item_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  file_type?: string | null;
  created_at: string;
}

export interface GeneralPlanningDocument {
  id: string;
  event_planning_id: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  file_type?: string | null;
  uploaded_by: string;
  tenant_id: string;
  created_at: string;
}

export interface Collaborator {
  id: string;
  event_planning_id: string;
  user_id: string;
  can_edit: boolean;
  profiles?: {
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface Profile {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  badge_color?: string | null;
}

export interface AppointmentPreparation {
  id: string;
  title: string;
  appointment_id?: string | null;
  status: EventPayloadStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  archived_at?: string | null;
  checklist_items?: ReadonlyArray<{
    id: string;
    label: string;
    completed: boolean;
  }>;
  preparation_data?: {
    social_media_planned?: boolean;
    press_planned?: boolean;
    visit_reason?: 'einladung' | 'eigeninitiative' | 'fraktionsarbeit' | 'pressetermin';
    conversation_partners?: ReadonlyArray<{
      id: string;
      name: string;
      avatar_url?: string;
      role?: string;
      organization?: string;
      note?: string;
    }>;
    companions?: ReadonlyArray<{
      id: string;
      name: string;
      type: 'mitarbeiter' | 'fraktion' | 'partei' | 'presse' | 'sonstige';
      note?: string;
    }>;
    has_parking?: boolean;
    program?: ReadonlyArray<{
      id: string;
      time: string;
      item: string;
      notes: string;
    }>;
    sections?: ReadonlyArray<AppointmentPreparationSection>;
    [key: string]: unknown;
  };
  template_id?: string | null;
  tenant_id?: string;
  created_by?: string;
}
