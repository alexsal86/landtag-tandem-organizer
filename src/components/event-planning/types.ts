export interface EventPlanning {
  id: string;
  title: string;
  description?: string;
  location?: string;
  background_info?: string;
  confirmed_date?: string;
  is_private: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_digital?: boolean;
  digital_platform?: string;
  digital_link?: string;
  digital_access_info?: string;
  is_completed?: boolean;
  completed_at?: string;
  is_archived?: boolean;
  archived_at?: string;
  creator?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface EventPlanningContact {
  id: string;
  event_planning_id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface EventPlanningSpeaker {
  id: string;
  event_planning_id: string;
  name: string;
  email?: string;
  phone?: string;
  bio?: string;
  topic?: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface EventPlanningDate {
  id: string;
  event_planning_id: string;
  date_time: string;
  is_confirmed: boolean;
  appointment_id?: string;
}

export interface ChecklistItem {
  id: string;
  event_planning_id: string;
  title: string;
  is_completed: boolean;
  order_index: number;
  type?: string;
  sub_items?: Array<{
    title: string;
    is_completed: boolean;
  }>;
}

export interface PlanningSubtask {
  id: string;
  planning_item_id: string;
  user_id: string;
  description: string;
  assigned_to?: string;
  due_date?: string;
  is_completed: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  result_text?: string;
  completed_at?: string;
}

export interface PlanningComment {
  id: string;
  planning_item_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    display_name?: string;
    avatar_url?: string;
  };
}

export interface PlanningDocument {
  id: string;
  planning_item_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
  created_at: string;
}

export interface GeneralPlanningDocument {
  id: string;
  event_planning_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
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
    display_name?: string;
    avatar_url?: string;
  };
}

export interface Profile {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
}

export interface AppointmentPreparation {
  id: string;
  title: string;
  appointment_id?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  archived_at?: string;
}
