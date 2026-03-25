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

export interface MessageItem {
  id: string;
  title: string;
  content: string;
  authorId: string;
  status: "active" | "archived";
  createdAt: string;
  isForAllUsers: boolean;
  hasRead: boolean;
  author: ParticipantSummary | null;
  recipients: ReadonlyArray<{
    recipientId: string;
    hasRead: boolean;
    readAt: string | null;
    profile: ParticipantSummary | null;
  }>;
  confirmations: ReadonlyArray<{
    userId: string;
    confirmedAt: string;
    profile: ParticipantSummary | null;
  }>;
  threadMeta: ThreadMeta;
}

export interface PreparationSection {
  key: "received" | "sent" | "archived";
  title: string;
  count: number;
}
