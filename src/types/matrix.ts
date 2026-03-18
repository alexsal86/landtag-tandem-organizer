export type MatrixMessageStatus = "sending" | "sent" | "delivered" | "read" | "error";

export interface MatrixReplyPreview {
  eventId: string;
  sender: string;
  content: string;
}

export interface MatrixReactionSummary {
  count: number;
  userReacted: boolean;
}

export interface MatrixMessageMediaInfo {
  mimetype?: string;
  size?: number;
  w?: number;
  h?: number;
  duration?: number;
  thumbnail_url?: string;
}

export interface MatrixMediaContent {
  msgtype: string;
  body: string;
  url?: string;
  info?: MatrixMessageMediaInfo;
}

export interface MatrixMessage {
  eventId: string;
  roomId: string;
  sender: string;
  senderDisplayName: string;
  content: string;
  timestamp: number;
  type: string;
  status: MatrixMessageStatus;
  replyTo?: MatrixReplyPreview;
  reactions: Map<string, MatrixReactionSummary>;
  mediaContent?: MatrixMediaContent;
}

export interface MatrixCreateRoomOptions {
  name: string;
  topic?: string;
  isPrivate: boolean;
  enableEncryption: boolean;
  inviteUserIds?: string[];
}
