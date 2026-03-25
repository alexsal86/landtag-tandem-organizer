export type MessageStatus = 'active' | 'archived';

export interface RpcMessageRow {
  id: string;
  title: string;
  content: string;
  author_id: string;
  is_for_all_users: boolean;
  status: MessageStatus;
  created_at: string;
  has_read?: boolean;
  author_name?: string | null;
  author_avatar?: string | null;
}

export interface ProfileRow {
  display_name: string | null;
  avatar_url: string | null;
}

export interface RecipientRow {
  recipient_id: string;
  has_read: boolean;
  read_at: string | null;
}

export interface ConfirmationRow {
  user_id: string;
  confirmed_at: string;
}
