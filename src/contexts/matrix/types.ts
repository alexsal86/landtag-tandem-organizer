import * as sdk from 'matrix-js-sdk';
import { CryptoEvent } from 'matrix-js-sdk';
import { VerificationPhase, type Verifier } from 'matrix-js-sdk/lib/crypto-api/verification';
import type { MatrixCreateRoomOptions, MatrixMessage, MatrixReactionSummary, MatrixReplyPreview } from '@/types/matrix';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface MatrixCredentials {
  userId: string;
  accessToken: string;
  homeserverUrl: string;
  deviceId?: string;
}

export interface ConnectOptions {
  uiaPassword?: string;
}

export interface MatrixRoom {
  roomId: string;
  name: string;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  unreadCount: number;
  isDirect: boolean;
  memberCount: number;
  isEncrypted: boolean;
}

export interface MatrixE2EEDiagnostics {
  secureContext: boolean;
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
  serviceWorkerControlled: boolean;
  secretStorageReady: boolean | null;
  crossSigningReady: boolean | null;
  keyBackupEnabled: boolean | null;
  cryptoError: string | null;
  coiBlockedReason: 'iframe' | 'preview-host' | 'iframe-preview' | null;
}

export interface MatrixSasVerificationState {
  transactionId?: string;
  otherDeviceId?: string;
  emojis: Array<{ symbol: string; description: string }>;
  decimals: [number, number, number] | null;
  confirm: () => Promise<void>;
  mismatch: () => void;
  cancel: () => void;
}

export type MatrixRoomId = string;

export interface MatrixRoomHistoryState {
  isLoadingMore: boolean;
  hasMoreHistory: boolean;
}

export type MatrixRoomMessagesMap = Map<MatrixRoomId, MatrixMessage[]>;
export type MatrixRoomHistoryMap = Map<MatrixRoomId, MatrixRoomHistoryState>;
export type MatrixTypingUsersMap = Map<MatrixRoomId, string[]>;

export type MatrixConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MatrixClientSessionState {
  credentials: MatrixCredentials | null;
  connectionState: MatrixConnectionState;
  connectionError: string | null;
  cryptoEnabled: boolean;
  e2eeDiagnostics: MatrixE2EEDiagnostics;
}

export interface MatrixPresenceState {
  typingUsers: MatrixTypingUsersMap;
  sendTypingNotification: (roomId: string, isTyping: boolean) => void;
}

export interface MatrixClientState {
  client: sdk.MatrixClient | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  cryptoEnabled: boolean;
  e2eeDiagnostics: MatrixE2EEDiagnostics;
  rooms: MatrixRoom[];
  roomMessages: MatrixRoomMessagesMap;
  roomHistoryState: MatrixRoomHistoryMap;
}

export interface MatrixEventWithStatus extends Omit<sdk.MatrixEvent, 'status'> {
  status?: unknown;
}

export interface MatrixSasData {
  sas: {
    emoji?: Array<[string, string]>;
    decimal?: [number, number, number] | null;
  };
  confirm: () => Promise<void>;
  mismatch: () => void;
  cancel: () => void;
}

export type MatrixClientEventName = (typeof sdk.ClientEvent)[keyof typeof sdk.ClientEvent]
  | (typeof sdk.RoomEvent)[keyof typeof sdk.RoomEvent]
  | (typeof sdk.RoomMemberEvent)[keyof typeof sdk.RoomMemberEvent]
  | (typeof sdk.MatrixEventEvent)[keyof typeof sdk.MatrixEventEvent]
  | (typeof CryptoEvent)[keyof typeof CryptoEvent];

export interface MatrixEventListener {
  event: MatrixClientEventName;
  handler: (...args: unknown[]) => void;
}

export interface MatrixReplyRelationPayload {
  event_id: string;
}

export interface MatrixRelatesToBasePayload {
  rel_type?: string;
  event_id?: string;
  key?: string;
  'm.in_reply_to'?: MatrixReplyRelationPayload;
}

export interface MatrixMessageContentPayload {
  msgtype?: string;
  body?: string;
  url?: string;
  info?: unknown;
  format?: string;
  formatted_body?: string;
  'm.relates_to'?: MatrixRelatesToBasePayload;
}

export interface MatrixReactionPayload {
  'm.relates_to'?: MatrixRelatesToBasePayload;
}

export interface MatrixTypingPayload {
  user_ids?: string[];
}

export type MatrixRealtimePayload = MatrixMessageContentPayload | MatrixReactionPayload;
export type MatrixPresencePayload = MatrixTypingPayload;
export type MatrixEventPayload = MatrixRealtimePayload | MatrixPresencePayload;

export interface MatrixVerificationRequest {
  transactionId?: string;
  otherDeviceId?: string;
  initiatedByMe?: boolean;
  phase: VerificationPhase;
  verifier?: Verifier;
  accept: () => Promise<void>;
  startVerification: (method: 'm.sas.v1') => Promise<Verifier>;
  cancel: () => Promise<void>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
}

export interface MatrixReadMarkersClient extends Omit<sdk.MatrixClient, 'setRoomReadMarkers'> {
  setRoomReadMarkers: (roomId: string, eventId: string, rrEventId: string) => Promise<unknown>;
}

export interface MatrixClientProviderProps {
  children: React.ReactNode;
}

export interface MatrixClientContextType {
  client: sdk.MatrixClient | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  cryptoEnabled: boolean;
  e2eeDiagnostics: MatrixE2EEDiagnostics;
  rooms: MatrixRoom[];
  credentials: MatrixCredentials | null;
  connect: (credentials: MatrixCredentials, options?: ConnectOptions) => Promise<void>;
  disconnect: () => void;
  sendMessage: (roomId: string, message: string, replyToEventId?: string) => Promise<void>;
  refreshMessages: (roomId: string, limit?: number) => void;
  loadOlderMessages: (roomId: string, pages?: number) => Promise<void>;
  totalUnreadCount: number;
  roomMessages: MatrixRoomMessagesMap;
  roomHistoryState: MatrixRoomHistoryMap;
  typingUsers: MatrixTypingUsersMap;
  sendTypingNotification: (roomId: string, isTyping: boolean) => void;
  sendReadReceiptForLatestVisibleEvent: (roomId: string) => Promise<void>;
  addReaction: (roomId: string, eventId: string, emoji: string) => Promise<void>;
  removeReaction: (roomId: string, eventId: string, emoji: string) => Promise<void>;
  createRoom: (options: MatrixCreateRoomOptions) => Promise<string>;
  requestSelfVerification: (otherDeviceId?: string) => Promise<void>;
  activeSasVerification: MatrixSasVerificationState | null;
  confirmSasVerification: () => Promise<void>;
  rejectSasVerification: () => void;
  lastVerificationError: string | null;
  resetCryptoStore: () => Promise<void>;
}
