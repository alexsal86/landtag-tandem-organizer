export interface CaseItemIntakePayload extends Record<string, unknown> {
  category?: string | null;
  assignee_ids?: string[];
  timeline_events?: unknown[];
  contact_name?: string | null;
  contact_detail?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  matched_contact_id?: string | null;
}


export interface CaseItemListEntry {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  channel: string | null;
  follow_up_at: string | null;
  due_date: string | null;
  assigned_to: string | null;
  user_id: string | null;
  case_file_id: string | null;
  created_at: string;
  updated_at: string | null;
  meeting_id?: string | null;
  pending_for_jour_fixe?: boolean | null;
}

export interface EscalationSuggestion {
  id: string;
  suggested_case_file_id: string | null;
  case_items: {
    id: string;
  };
}
