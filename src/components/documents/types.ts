export interface DocumentFolder {
  id: string;
  user_id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  parent_folder_id?: string | null;
  color: string | null;
  icon: string | null;
  order_index: number | null;
  created_at: string;
  updated_at: string;
  documentCount?: number;
}

export interface Document {
  id: string;
  title: string;
  description?: string | null;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  file_type?: string | null;
  category: string | null;
  tags?: string[] | null;
  status: string;
  user_id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  document_type?: string | null;
  source_letter_id?: string | null;
  archived_attachments?: unknown[];
  folder_id?: string | null;
}

export interface Letter {
  id?: string;
  title: string;
  content: string;
  content_html?: string;
  template_id?: string;
  sender_info_id?: string;
  information_block_ids?: string[];
  recipient_name?: string;
  recipient_address?: string;
  contact_id?: string;
  user_id?: string;
  status: 'draft' | 'review' | 'approved' | 'sent' | 'archived';
  sent_date?: string;
  sent_method?: 'post' | 'email' | 'both';
  expected_response_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  show_pagination?: boolean;
  archived_at?: string;
  archived_by?: string;
}

export interface ParentTaskOption {
  id: string;
  title: string;
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  review: "Überprüfung",
  approved: "Genehmigt",
  archived: "Archiviert"
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'archived': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  }
};

export const formatFileSize = (bytes?: number) => {
  if (!bytes) return "Unbekannt";
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};
