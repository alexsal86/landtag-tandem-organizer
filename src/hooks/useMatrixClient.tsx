import { useMatrixClient as useMatrixClientContext } from '@/contexts/MatrixClientContext';
import type { MatrixClientContextType } from '@/contexts/MatrixClientContext';

// Re-export the hook from the context for convenience
export const useMatrixClient = (): MatrixClientContextType => useMatrixClientContext();
export { useMatrixUnread } from '@/contexts/MatrixUnreadContext';
