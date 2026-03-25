export type MessageStatus = 'active' | 'archived';

export interface ParticipantSummary {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ThreadMeta {
  totalRecipients: number;
  acknowledgedRecipients: number;
  isBroadcast: boolean;
}

export interface MessageRecipient {
  recipientId: string;
  hasRead: boolean;
  readAt: string | null;
  profile: ParticipantSummary | null;
}

export interface MessageConfirmation {
  userId: string;
  confirmedAt: string;
  profile: ParticipantSummary | null;
}

export interface MessageItem {
  id: string;
  title: string;
  content: string;
  authorId: string;
  status: MessageStatus;
  createdAt: string;
  isForAllUsers: boolean;
  hasRead: boolean;
  author: ParticipantSummary | null;
  recipients: ReadonlyArray<MessageRecipient>;
  confirmations: ReadonlyArray<MessageConfirmation>;
  threadMeta: ThreadMeta;
}

export type MessageSectionKey = 'received' | 'sent' | 'archived';

export interface MessageSection {
  key: MessageSectionKey;
  title: string;
  count: number;
}

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
