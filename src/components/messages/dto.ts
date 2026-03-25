export interface MessageItemAuthor {
  displayName?: string;
  avatarUrl?: string | null;
}

export interface MessageRecipient {
  recipientId: string;
  hasRead: boolean;
  readAt?: string;
  profile?: {
    displayName?: string;
    avatarUrl?: string | null;
  };
}

export interface MessageConfirmation {
  userId: string;
  confirmedAt: string;
  profile?: {
    displayName?: string;
    avatarUrl?: string | null;
  };
}

export interface MessageItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  authorId?: string;
  author?: MessageItemAuthor;
  isForAllUsers: boolean;
  recipients: MessageRecipient[];
  confirmations: MessageConfirmation[];
}
