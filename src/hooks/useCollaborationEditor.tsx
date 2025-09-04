import { useContext, useEffect, useCallback } from 'react';
import { CollaborationContext } from '@/contexts/CollaborationContext';
import { useCollaborationPersistence } from './useCollaborationPersistence';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

interface CollaborationUser {
  id: string;
  name?: string;
  avatar?: string;
  color?: string;
}

interface UseCollaborationEditorProps {
  documentId?: string;
  enableCollaboration?: boolean;
}

interface UseCollaborationEditorReturn {
  yDoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  isConnected: boolean;
  users: CollaborationUser[];
  currentUser: CollaborationUser | null;
  isReady: boolean;
  initializeCollaboration: (documentId: string) => void;
  destroyCollaboration: () => void;
}

/**
 * Hook to integrate Lexical editor with collaboration context
 */
export const useCollaborationEditor = ({
  documentId,
  enableCollaboration = false
}: UseCollaborationEditorProps): UseCollaborationEditorReturn => {
  const context = useContext(CollaborationContext);
  
  if (!context) {
    throw new Error('useCollaborationEditor must be used within a CollaborationProvider');
  }

  const {
    yDoc,
    provider,
    isConnected,
    users,
    currentUser,
    initializeCollaboration,
    destroyCollaboration,
    isReady
  } = context;

  // Set up persistence
  useCollaborationPersistence({
    documentId,
    yDoc,
    enableCollaboration,
    debounceMs: 3000
  });

  // Initialize collaboration when documentId and enableCollaboration are set
  useEffect(() => {
    if (enableCollaboration && documentId) {
      initializeCollaboration(documentId);
      
      return () => {
        // Add delay to prevent race conditions
        setTimeout(() => {
          destroyCollaboration();
        }, 100);
      };
    } else {
      // Cleanup if collaboration not available
      destroyCollaboration();
    }
  }, [enableCollaboration, documentId, initializeCollaboration, destroyCollaboration]);

  return {
    yDoc,
    provider,
    isConnected,
    users,
    currentUser,
    isReady,
    initializeCollaboration,
    destroyCollaboration
  };
};