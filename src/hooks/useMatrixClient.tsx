import { useMatrixClient as useMatrixClientContext } from '@/contexts/MatrixClientContext';
import type {
  MatrixClientContextType,
  MatrixClientSessionState,
  MatrixPresenceState,
  MatrixClientState,
} from '@/contexts/MatrixClientContext';

// Re-export the hook from the context for convenience
export const useMatrixClient = (): MatrixClientContextType => useMatrixClientContext();

export const useMatrixSession = (): MatrixClientSessionState => {
  const matrix = useMatrixClientContext();
  return {
    credentials: matrix.credentials,
    connectionState: matrix.connectionError
      ? 'error'
      : matrix.isConnected
        ? 'connected'
        : matrix.isConnecting
          ? 'connecting'
          : 'disconnected',
    connectionError: matrix.connectionError,
    cryptoEnabled: matrix.cryptoEnabled,
    e2eeDiagnostics: matrix.e2eeDiagnostics,
  };
};

export const useMatrixPresence = (): MatrixPresenceState => {
  const matrix = useMatrixClientContext();
  return {
    typingUsers: matrix.typingUsers,
    sendTypingNotification: matrix.sendTypingNotification,
  };
};

export const useMatrixClientState = (): MatrixClientState => {
  const matrix = useMatrixClientContext();
  return {
    client: matrix.client,
    isConnected: matrix.isConnected,
    isConnecting: matrix.isConnecting,
    connectionError: matrix.connectionError,
    cryptoEnabled: matrix.cryptoEnabled,
    e2eeDiagnostics: matrix.e2eeDiagnostics,
    rooms: matrix.rooms,
    roomMessages: matrix.roomMessages,
    roomHistoryState: matrix.roomHistoryState,
  };
};

export { useMatrixUnread } from '@/contexts/MatrixUnreadContext';
