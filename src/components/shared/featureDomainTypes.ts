export interface AppUserRef {
  id: string;
  email?: string | null;
}

export interface TenantRef {
  id: string;
}

export interface ProfileSummary {
  user_id: string;
  display_name?: string;
  avatar_url?: string | null;
}

export interface ChecklistSubItem {
  title: string;
  is_completed: boolean;
}

export interface TaskDocumentInfo {
  id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}
