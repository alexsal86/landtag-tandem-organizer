export interface CaseItemIntakePayload extends Record<string, unknown> {
  category?: string | null;
  assignee_ids?: string[];
  timeline_events?: unknown[];
  contact_name?: string | null;
  contact_detail?: string | null;
}

