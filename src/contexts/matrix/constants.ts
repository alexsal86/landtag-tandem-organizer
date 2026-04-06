import { getCoiCapabilityStatus } from '@/lib/coiRuntime';
import type { MatrixMessage } from '@/types/matrix';
import type {
  MatrixClientContextType,
  MatrixE2EEDiagnostics,
  MatrixRoomHistoryState,
  MatrixRoomId,
} from './types';

export const MAX_CACHED_MESSAGES = 200;
export const MAX_CACHED_ROOMS = 60;
export const SCROLLBACK_BATCH_LIMIT = 40;
export const MAX_SCROLLBACK_LOOPS = 6;

export const MATRIX_CONSOLE_NOISE_PATTERNS = [
  'Error decrypting event',
  'matrix_sdk_crypto::machine: Failed to decrypt a room event',
  'This message was sent before this device logged in',
  "Can't find the room key to decrypt the event",
  '/_matrix/client/v3/keys/upload',
  'Failed to process outgoing request',
  'One time key signed_curve25519',
  'already exists. Old key:',
  'Missing default global override push rule',
  'Adding default global override push rule',
  'Adding default global underride push rule',
  'Missing default global underride push rule',
  '[PerSessionKeyBackupDownloader]',
  '/_matrix/client/v3/keys/upload 400',
] as const;

const noopAsync = async (..._args: unknown[]): Promise<void> => {};
const noopRejectSas = () => {};
const noopRefreshMessages = (_roomId: string, _limit?: number) => {};
const noopTyping = (_roomId: string, _isTyping: boolean) => {};

export const createDefaultE2EEDiagnostics = (): MatrixE2EEDiagnostics => {
  if (typeof window === 'undefined') {
    return {
      secureContext: false,
      crossOriginIsolated: false,
      sharedArrayBuffer: false,
      serviceWorkerControlled: false,
      secretStorageReady: null,
      crossSigningReady: null,
      keyBackupEnabled: null,
      cryptoError: null,
      coiBlockedReason: null,
    };
  }

  return {
    secureContext: window.isSecureContext,
    crossOriginIsolated: window.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
    secretStorageReady: null,
    crossSigningReady: null,
    keyBackupEnabled: null,
    cryptoError: null,
    coiBlockedReason: getCoiCapabilityStatus().reason,
  };
};

export const defaultMatrixClientContext: MatrixClientContextType = {
  client: null,
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  cryptoEnabled: false,
  e2eeDiagnostics: createDefaultE2EEDiagnostics(),
  rooms: [],
  credentials: null,
  connect: noopAsync,
  disconnect: noopRejectSas,
  sendMessage: noopAsync,
  refreshMessages: noopRefreshMessages,
  loadOlderMessages: noopAsync,
  totalUnreadCount: 0,
  roomMessages: new Map<MatrixRoomId, import('@/types/matrix').MatrixMessage[]>(),
  roomHistoryState: new Map<MatrixRoomId, MatrixRoomHistoryState>(),
  typingUsers: new Map<MatrixRoomId, string[]>(),
  sendTypingNotification: noopTyping,
  sendReadReceiptForLatestVisibleEvent: noopAsync,
  addReaction: noopAsync,
  removeReaction: noopAsync,
  createRoom: async () => '',
  requestSelfVerification: noopAsync,
  activeSasVerification: null,
  confirmSasVerification: noopAsync,
  rejectSasVerification: noopRejectSas,
  lastVerificationError: null,
  resetCryptoStore: noopAsync,
};
