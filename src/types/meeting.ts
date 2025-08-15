export interface AgendaItem {
  id?: string;
  title: string;
  description?: string;
  assigned_to?: string | null;
  notes?: string | null;
  is_completed: boolean;
  is_recurring: boolean;
  task_id?: string | null;
  order_index: number;
  parent_id?: string | null;
  file_path?: string | null;
  result_text?: string | null;
  carry_over_to_next?: boolean;
  // lokale Hilfskeys für Hierarchie vor dem Speichern
  localKey?: string;
  parentLocalKey?: string;
}

export interface AgendaDocument {
  id: string;
  meeting_agenda_item_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id?: string;
  user_id?: string;
  title: string;
  description?: string;
  meeting_date: string | Date;
  location?: string;
  status: string;
  template_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MeetingTemplate {
  id: string;
  name: string;
  description?: string;
  template_items: any;
}

export interface Profile {
  user_id: string;
  display_name: string | null;
}