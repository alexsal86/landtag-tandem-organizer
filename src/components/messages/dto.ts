export interface MessageItem {
  id: string;
  subject?: string;
  body?: string;
  sender_name?: string;
  sender_email?: string;
  received_at?: string;
  is_read?: boolean;
  is_archived?: boolean;
  attachments?: { name: string; url?: string }[];
}
