// Barrel re-export — preserves all existing import paths
export type {
  MatrixCredentials,
  ConnectOptions,
  MatrixRoom,
  MatrixE2EEDiagnostics,
  MatrixSasVerificationState,
  MatrixRoomId,
  MatrixRoomHistoryState,
  MatrixRoomMessagesMap,
  MatrixRoomHistoryMap,
  MatrixTypingUsersMap,
  MatrixConnectionState,
  MatrixClientSessionState,
  MatrixPresenceState,
  MatrixClientState,
  MatrixClientContextType,
} from './matrix/types';

export { MatrixClientProvider, useMatrixClient } from './matrix/MatrixClientProvider';
