// Type for archived info from database (JSON)
type ArchivedInfo = { id: string; title: string; archived_at: string } | null;

export interface QuickNote {
  id: string;
  tenant_id?: string;
  revision?: number;
  sync_status?: "pending" | "conflict" | "error";
  sync_error?: string;
  title: string | null;
  content: string;
  topic_backlog_id?: string | null;
  color: string | null;
  color_full_card?: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  task_id?: string;
  meeting_id?: string;
  decision_id?: string;
  case_item_id?: string;
  priority_level?: number;
  follow_up_date?: string;
  is_archived?: boolean;
  user_id?: string;
  is_shared?: boolean;
  share_count?: number;
  pending_for_jour_fixe?: boolean;
  can_edit?: boolean;
  task_archived_info?: ArchivedInfo | unknown;
  decision_archived_info?: ArchivedInfo | unknown;
  meeting_archived_info?: ArchivedInfo | unknown;
  shared_with_users?: Array<{
    id: string;
    display_name: string | null;
  }>;
  owner?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  meetings?: {
    title: string;
    meeting_date: string;
    status: string | null;
  } | null;
}
