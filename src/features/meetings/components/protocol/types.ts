export interface ProtocolAgendaItem {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  result_text?: string | null;
  assigned_to?: string[] | null;
  order_index: number;
  parent_id?: string | null;
  system_type?: string | null;
  is_completed?: boolean;
  task_id?: string | null;
}

export interface ProtocolMeeting {
  id: string;
  title: string;
  description?: string | null;
  meeting_date: string;
  meeting_time?: string | null;
  location?: string | null;
  status: string;
  user_id?: string | null;
}

export interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
}

export interface StarredAppointment {
  id: string;
  title: string;
  start_time: string;
}

export interface ProtocolQuickNote {
  id: string;
  title?: string | null;
  content: string;
  meeting_result?: string | null;
  category?: string | null;
}

export interface ProtocolCaseItem {
  id: string;
  subject: string | null;
  status: string;
  meeting_result?: string;
}

export interface ProtocolDecision {
  id: string;
  title: string;
  status: string;
  response_deadline?: string | null;
  result_text?: string | null;
}

export interface ProtocolParticipant {
  user_id: string;
  role: string;
  display_name: string | null;
}

export interface CreatedTask {
  id: string;
  title: string;
  assigned_to?: string | null;
  parent_task_id?: string | null;
}
